import { useEffect, useMemo, useRef, useState } from "react";
import Graphic from "@arcgis/core/Graphic.js";
import Polygon from "@arcgis/core/geometry/Polygon.js";
import Polyline from "@arcgis/core/geometry/Polyline.js";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import Map from "@arcgis/core/Map.js";
import SceneView from "@arcgis/core/views/SceneView.js";

function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  const { hostname, protocol } = window.location;

  if (hostname.includes("-5173.app.github.dev")) {
    return `${protocol}//${hostname.replace("-5173.app.github.dev", "-4000.app.github.dev")}`;
  }

  if (hostname.includes("-5173.githubpreview.dev")) {
    return `${protocol}//${hostname.replace("-5173.githubpreview.dev", "-4000.githubpreview.dev")}`;
  }

  return "http://localhost:4000";
}

const apiBaseUrl = resolveApiBaseUrl();

function polygonFromGeoJson(geometry) {
  const rings =
    geometry.type === "MultiPolygon"
      ? geometry.coordinates.flatMap((polygon) => polygon)
      : geometry.coordinates;

  return new Polygon({
    rings,
    spatialReference: { wkid: 4326 }
  });
}

function polylineFromGeoJson(path) {
  return new Polyline({
    paths: [path.coordinates],
    spatialReference: { wkid: 4326 }
  });
}

function findIntersections(contamination, migrations) {
  return contamination.flatMap((pocket) => {
    const polygon = polygonFromGeoJson(pocket.geometry);

    return migrations
      .filter((migration) => geometryEngine.intersects(polylineFromGeoJson(migration.path), polygon))
      .map((migration) => ({
        id: `${pocket.id}-${migration.id}`,
        pocketId: pocket.id,
        pocketType: pocket.type,
        severity: pocket.severity,
        speciesName: migration.speciesName,
        timestamp: migration.timestamp
      }));
  });
}

export default function OceanGuardDashboard() {
  const mapRef = useRef(null);
  const viewRef = useRef(null);
  const contaminationLayerRef = useRef(null);
  const migrationLayerRef = useRef(null);
  const [contamination, setContamination] = useState([]);
  const [migrations, setMigrations] = useState([]);
  const [selectedPocketId, setSelectedPocketId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [contaminationResponse, migrationResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/contamination`),
          fetch(`${apiBaseUrl}/api/migration`)
        ]);

        if (!contaminationResponse.ok || !migrationResponse.ok) {
          throw new Error("OceanGuard API returned an error");
        }

        const [contaminationData, migrationData] = await Promise.all([
          contaminationResponse.json(),
          migrationResponse.json()
        ]);

        if (active) {
          setContamination(contaminationData);
          setMigrations(migrationData);
        }
      } catch (requestError) {
        if (active) {
          setError(`${requestError.message}. API: ${apiBaseUrl}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const alerts = useMemo(
    () => findIntersections(contamination, migrations),
    [contamination, migrations]
  );

  const visibleAlerts = selectedPocketId
    ? alerts.filter((alert) => alert.pocketId === selectedPocketId)
    : alerts;

  useEffect(() => {
    if (!mapRef.current || viewRef.current) {
      return undefined;
    }

    const contaminationLayer = new GraphicsLayer({ title: "Contamination Pockets" });
    const migrationLayer = new GraphicsLayer({ title: "Animal Migration Paths" });
    const map = new Map({
      basemap: "oceans",
      layers: [contaminationLayer, migrationLayer]
    });

    const view = new SceneView({
      container: mapRef.current,
      map,
      viewingMode: "global",
      qualityProfile: "high",
      camera: {
        position: {
          longitude: -124.5,
          latitude: 35.3,
          z: 2500000
        },
        heading: 12,
        tilt: 42
      },
      environment: {
        atmosphereEnabled: true,
        starsEnabled: true,
        lighting: {
          directShadowsEnabled: true,
          date: new Date()
        }
      },
      popup: {
        dockEnabled: true,
        dockOptions: {
          position: "top-right",
          breakpoint: false
        }
      }
    });

    const clickHandle = view.on("click", async (event) => {
      const hit = await view.hitTest(event);
      const pocketHit = hit.results.find(
        (result) => result.graphic?.attributes?.layerType === "contamination"
      );

      if (!pocketHit) {
        setSelectedPocketId(null);
        view.popup.close();
        return;
      }

      const graphic = pocketHit.graphic;
      setSelectedPocketId(graphic.attributes.id);
      view.popup.open({
        title: `${graphic.attributes.type} pocket`,
        location: event.mapPoint,
        content: `
          <strong>Type:</strong> ${graphic.attributes.type}<br />
          <strong>Severity:</strong> ${graphic.attributes.severity}/10<br />
          ${graphic.attributes.description}
        `
      });
    });

    viewRef.current = view;
    contaminationLayerRef.current = contaminationLayer;
    migrationLayerRef.current = migrationLayer;

    return () => {
      clickHandle.remove();
      view.destroy();
      viewRef.current = null;
      contaminationLayerRef.current = null;
      migrationLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const contaminationLayer = contaminationLayerRef.current;
    const migrationLayer = migrationLayerRef.current;

    if (!contaminationLayer || !migrationLayer) {
      return;
    }

    contaminationLayer.removeAll();
    migrationLayer.removeAll();

    contamination.forEach((pocket) => {
      const selected = selectedPocketId === pocket.id;

      contaminationLayer.add(
        new Graphic({
          geometry: polygonFromGeoJson(pocket.geometry),
          attributes: {
            ...pocket,
            layerType: "contamination"
          },
          symbol: {
            type: "simple-fill",
            color: selected ? [255, 102, 0, 0.55] : [232, 72, 45, 0.35],
            outline: {
              color: selected ? [172, 52, 0, 1] : [184, 53, 33, 0.9],
              width: selected ? 2 : 1
            }
          }
        })
      );
    });

    migrations.forEach((migration) => {
      migrationLayer.add(
        new Graphic({
          geometry: polylineFromGeoJson(migration.path),
          attributes: {
            ...migration,
            layerType: "migration"
          },
          symbol: {
            type: "simple-line",
            color: [0, 116, 217, 0.9],
            width: 2
          }
        })
      );
    });
  }, [contamination, migrations, selectedPocketId]);

  return (
    <main className="flex h-screen bg-zinc-50 text-zinc-950">
      <aside className="flex w-[30%] min-w-[320px] flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            OceanGuard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Data Insights</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Active alerts where tagged animal migrations intersect modeled
            contamination pockets.
          </p>
        </div>

        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <span className="text-sm font-medium text-zinc-700">
            {selectedPocketId ? "Filtered pocket" : "All active intersections"}
          </span>
          {selectedPocketId && (
            <button
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100"
              type="button"
              onClick={() => setSelectedPocketId(null)}
            >
              Clear
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading && <p className="text-sm text-zinc-600">Loading migration telemetry...</p>}
          {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          {!loading && !error && visibleAlerts.length === 0 && (
            <p className="text-sm leading-6 text-zinc-600">
              No migration intersections detected for the current selection.
            </p>
          )}

          <div className="space-y-3">
            {visibleAlerts.map((alert) => (
              <article
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
                key={alert.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{alert.speciesName}</h2>
                    <p className="mt-1 text-sm text-zinc-600">{alert.pocketType} exposure</p>
                  </div>
                  <span className="rounded-md bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">
                    {alert.severity}/10
                  </span>
                </div>
                <p className="mt-3 text-xs uppercase tracking-wide text-zinc-500">
                  {new Date(alert.timestamp).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        </div>
      </aside>

      <section className="relative h-screen flex-1">
        <div ref={mapRef} className="h-full w-full" />
      </section>
    </main>
  );
}
