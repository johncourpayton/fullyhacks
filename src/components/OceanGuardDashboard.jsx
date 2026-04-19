import { useEffect, useRef, useState } from "react";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import Map from "@arcgis/core/Map.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";
import SceneView from "@arcgis/core/views/SceneView.js";

const NASA_GIBS_CHLOROPHYLL_LAYER = "VIIRS_NOAA20_Chlorophyll_a_v2022.0_NRT";
const GARBAGE_PATCHES_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "North Pacific Garbage Patch",
        ocean: "North Pacific",
        description: "Approximate subtropical gyre accumulation region between Hawaii and California."
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-171, 25],
            [-162, 33],
            [-148, 38],
            [-132, 37],
            [-121, 30],
            [-126, 22],
            [-141, 18],
            [-158, 19],
            [-171, 25]
          ]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "South Pacific Garbage Patch",
        ocean: "South Pacific",
        description: "Approximate subtropical gyre accumulation region west of South America."
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-156, -20],
            [-140, -12],
            [-119, -16],
            [-99, -26],
            [-89, -38],
            [-105, -47],
            [-132, -46],
            [-153, -36],
            [-164, -27],
            [-156, -20]
          ]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "North Atlantic Garbage Patch",
        ocean: "North Atlantic",
        description: "Approximate subtropical gyre accumulation region between North America and Europe."
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-72, 25],
            [-62, 35],
            [-45, 40],
            [-27, 37],
            [-18, 29],
            [-27, 21],
            [-45, 18],
            [-63, 19],
            [-72, 25]
          ]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "South Atlantic Garbage Patch",
        ocean: "South Atlantic",
        description: "Approximate subtropical gyre accumulation region between South America and southern Africa."
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-42, -22],
            [-28, -14],
            [-7, -16],
            [12, -25],
            [18, -36],
            [3, -44],
            [-20, -43],
            [-39, -34],
            [-48, -27],
            [-42, -22]
          ]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "Indian Ocean Garbage Patch",
        ocean: "Indian Ocean",
        description: "Approximate subtropical gyre accumulation region in the southern Indian Ocean."
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [45, -20],
            [60, -12],
            [82, -14],
            [105, -23],
            [112, -35],
            [97, -44],
            [72, -43],
            [50, -34],
            [39, -26],
            [45, -20]
          ]
        ]
      }
    }
  ]
};

function getGibsDate(daysBack = 2) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysBack);

  return date.toISOString().slice(0, 10);
}

export default function OceanGuardDashboard() {
  const mapRef = useRef(null);
  const viewRef = useRef(null);
  const chlorophyllLayerRef = useRef(null);
  const garbagePatchLayerRef = useRef(null);
  const shipTrafficLayerRef = useRef(null);
  const [chlorophyllVisible, setChlorophyllVisible] = useState(true);
  const [garbagePatchesVisible, setGarbagePatchesVisible] = useState(false);
  const [shipTrafficVisible, setShipTrafficVisible] = useState(false);

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
      opacity: 0.42,
      visible: true,
      copyright: "NASA GIBS / OB.DAAC"
    });
    chlorophyllLayerRef.current = chlorophyllLayer;

    const garbagePatchUrl = URL.createObjectURL(
      new Blob([JSON.stringify(GARBAGE_PATCHES_GEOJSON)], {
        type: "application/geo+json"
      })
    );
    const garbagePatchLayer = new GeoJSONLayer({
      url: garbagePatchUrl,
      title: "Approximate Global Garbage Patches",
      visible: false,
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: [245, 113, 39, 0.3],
          outline: {
            color: [173, 65, 20, 0.95],
            width: 1.2
          }
        }
      },
      labelingInfo: [
        {
          labelExpressionInfo: {
            expression: "$feature.name"
          },
          symbol: {
            type: "label-3d",
            symbolLayers: [
              {
                type: "text",
                material: {
                  color: [92, 45, 12, 255]
                },
                halo: {
                  color: [255, 255, 255, 230],
                  size: 1.2
                },
                font: {
                  family: "Arial",
                  weight: "bold"
                },
                size: 10
              }
            ]
          }
        }
      ],
      popupTemplate: {
        title: "{name}",
        content: [
          {
            type: "fields",
            fieldInfos: [
              {
                fieldName: "ocean",
                label: "Ocean"
              },
              {
                fieldName: "description",
                label: "Notes"
              }
            ]
          }
        ]
      }
    });
    garbagePatchLayerRef.current = garbagePatchLayer;

    const shipTrafficLayer = new GeoJSONLayer({
      url: "/api/ships?minLat=25&maxLat=50&minLon=-130&maxLon=-105",
      title: "MarineTraffic Ship Traffic",
      visible: false,
      outFields: ["*"],
      renderer: {
        type: "unique-value",
        field: "vesselTypeGroup",
        defaultSymbol: {
          type: "simple-marker",
          color: [103, 116, 142, 0.92],
          outline: {
            color: [255, 255, 255, 0.95],
            width: 0.8
          },
          size: 6
        },
        uniqueValueInfos: [
          {
            value: "Tanker",
            label: "Tankers",
            symbol: {
              type: "simple-marker",
              color: [220, 38, 38, 0.95],
              outline: {
                color: [255, 255, 255, 0.95],
                width: 0.8
              },
              size: 7
            }
          },
          {
            value: "Cargo",
            label: "Cargo",
            symbol: {
              type: "simple-marker",
              color: [37, 99, 235, 0.95],
              outline: {
                color: [255, 255, 255, 0.95],
                width: 0.8
              },
              size: 7
            }
          },
          {
            value: "Other",
            label: "Other vessels",
            symbol: {
              type: "simple-marker",
              color: [82, 82, 91, 0.92],
              outline: {
                color: [255, 255, 255, 0.95],
                width: 0.8
              },
              size: 6
            }
          }
        ]
      },
      popupTemplate: {
        title: "{name}",
        content: [
          {
            type: "fields",
            fieldInfos: [
              {
                fieldName: "vesselType",
                label: "Ship type"
              },
              {
                fieldName: "mmsi",
                label: "MMSI"
              },
              {
                fieldName: "timestamp",
                label: "Last update"
              }
            ]
          }
        ]
      }
    });
    shipTrafficLayerRef.current = shipTrafficLayer;

    const map = new Map({
      basemap: "oceans",
      layers: [chlorophyllLayer, garbagePatchLayer, shipTrafficLayer]
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
      chlorophyllLayerRef.current = null;
      garbagePatchLayerRef.current = null;
      shipTrafficLayerRef.current = null;
      URL.revokeObjectURL(garbagePatchUrl);
    };
  }, []);

  const toggleChlorophyll = () => {
    const nextVisible = !chlorophyllVisible;
    setChlorophyllVisible(nextVisible);

    if (chlorophyllLayerRef.current) {
      chlorophyllLayerRef.current.visible = nextVisible;
    }
  };

  const toggleGarbagePatches = () => {
    const nextVisible = !garbagePatchesVisible;
    setGarbagePatchesVisible(nextVisible);

    if (garbagePatchLayerRef.current) {
      garbagePatchLayerRef.current.visible = nextVisible;
    }
  };

  const toggleShipTraffic = () => {
    const nextVisible = !shipTrafficVisible;
    setShipTrafficVisible(nextVisible);

    if (shipTrafficLayerRef.current) {
      shipTrafficLayerRef.current.visible = nextVisible;
    }
  };

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

        <div className="border-b border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-800">Ocean layers</h2>
          <button
            type="button"
            onClick={toggleChlorophyll}
            className={`mt-4 w-full rounded-md border px-4 py-3 text-sm font-semibold transition ${
              chlorophyllVisible
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            Chlorophyll {chlorophyllVisible ? "On" : "Off"}
          </button>
          <button
            type="button"
            onClick={toggleGarbagePatches}
            className={`mt-3 w-full rounded-md border px-4 py-3 text-sm font-semibold transition ${
              garbagePatchesVisible
                ? "border-orange-700 bg-orange-600 text-white"
                : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            Toggle Garbage Patches
          </button>
          <button
            type="button"
            onClick={toggleShipTraffic}
            className={`mt-3 w-full rounded-md border px-4 py-3 text-sm font-semibold transition ${
              shipTrafficVisible
                ? "border-sky-700 bg-sky-700 text-white"
                : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            Toggle Ship Traffic
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <p className="text-sm leading-6 text-zinc-600">
            Global chlorophyll-a from NASA GIBS is shown as a transparent satellite
            overlay.
          </p>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Garbage patch regions are approximate gyre-scale polygons for visual
            planning and demo use.
          </p>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Ship traffic is loaded from the MarineTraffic Flask endpoint for the
            current demo bounding box.
          </p>
        </div>
      </aside>

      <section className="relative h-screen flex-1">
        <div ref={mapRef} className="h-full w-full" />
      </section>
    </main>
  );
}
