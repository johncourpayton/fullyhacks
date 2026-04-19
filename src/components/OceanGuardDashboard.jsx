import { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";
import SceneView from "@arcgis/core/views/SceneView.js";

const NASA_GIBS_CHLOROPHYLL_LAYER = "VIIRS_NOAA20_Chlorophyll_a_v2022.0_NRT";

function getGibsDate(daysBack = 2) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysBack);

  return date.toISOString().slice(0, 10);
}

export default function OceanGuardDashboard() {
  const mapRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || viewRef.current) {
      return undefined;
    }

    const chlorophyllDate = getGibsDate();
    const chlorophyllLayer = new WebTileLayer({
      urlTemplate:
        `https://gibs-a.earthdata.nasa.gov/wmts/epsg3857/all/${NASA_GIBS_CHLOROPHYLL_LAYER}` +
        `/default/${chlorophyllDate}/GoogleMapsCompatible_Level7/{level}/{row}/{col}.png`,
      title: `NASA GIBS Chlorophyll-a (${chlorophyllDate})`,
      opacity: 0.82,
      visible: true,
      copyright: "NASA GIBS / OB.DAAC"
    });

    const map = new Map({
      basemap: "oceans",
      layers: [chlorophyllLayer]
    });

    const view = new SceneView({
      container: mapRef.current,
      map,
      viewingMode: "global",
      qualityProfile: "high",
      camera: {
        position: {
          longitude: -155.0,
          latitude: 15.0,
          z: 14500000
        },
        heading: 0,
        tilt: 18
      },
      environment: {
        atmosphereEnabled: true,
        starsEnabled: false,
        lighting: {
          type: "virtual"
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

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return (
    <main className="flex h-screen bg-zinc-50 text-zinc-950">
      <aside className="flex w-[30%] min-w-[320px] flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            OceanGuard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Data Insights</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            A clean starting point for ocean risk layers and globe-based exploration.
          </p>
        </div>

        <div className="border-b border-zinc-200 px-6 py-4">
          <span className="text-sm font-medium text-zinc-700">Globe view ready</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <p className="text-sm leading-6 text-zinc-600">
            Add the next OceanGuard layer here.
          </p>
        </div>
      </aside>

      <section className="relative h-screen flex-1">
        <div ref={mapRef} className="h-full w-full" />
      </section>
    </main>
  );
}
