import { useEffect, useRef, useState } from "react";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import Map from "@arcgis/core/Map.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";
import SceneView from "@arcgis/core/views/SceneView.js";

const NASA_GIBS_CHLOROPHYLL_LAYER = "VIIRS_NOAA20_Chlorophyll_a_v2022.0_NRT";
import { analyzeImpact, generateMockAIReport } from "../utils/ImpactAnalysis.js";
import Papa from "papaparse";

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
    },
    {
      type: "Feature",
      properties: {
        name: "Southern Ocean Microplastic Accumulation",
        ocean: "Southern Ocean",
        description: "High density microplastic zone detected near whale feeding grounds."
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [165, -60],
            [180, -60],
            [180, -70],
            [165, -70],
            [165, -60]
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

function getFirstGeometryType(geojson) {
  const firstFeature = geojson?.features?.find((feature) => feature.geometry);
  return firstFeature?.geometry?.type || "LineString";
}

function getGeoJsonRenderer(geometryType) {
  if (geometryType.includes("Point")) {
    return {
      type: "simple",
      symbol: {
        type: "simple-marker",
        color: [37, 99, 235, 0.9],
        outline: {
          color: [255, 255, 255, 0.95],
          width: 0.8
        },
        size: 6
      }
    };
  }

  if (geometryType.includes("Polygon")) {
    return {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [37, 99, 235, 0.22],
        outline: {
          color: [37, 99, 235, 0.9],
          width: 1.2
        }
      }
    };
  }

  return {
    type: "simple",
    symbol: {
      type: "simple-line",
      color: [37, 99, 235, 0.95],
      width: 3
    }
  };
}

async function createDataGeoJsonLayer({ url, title }) {
  const response = await fetch(url);
  const geojson = await response.json();

  return new GeoJSONLayer({
    url,
    title,
    renderer: getGeoJsonRenderer(getFirstGeometryType(geojson))
  });
}

async function getDataGeoJsonFiles() {
  const response = await fetch("/api/geojson-files");
  const data = await response.json();

  return data.files || [];
}

export default function OceanGuardDashboard() {
  const mapRef = useRef(null);
  const viewRef = useRef(null);
  const chlorophyllLayerRef = useRef(null);
  const garbagePatchLayerRef = useRef(null);
  const shipTrafficLayerRef = useRef(null);
  const dataGeoJsonLayersRef = useRef([]);
  const dataGeoJsonVisibleRef = useRef(true);
  const fileInputRef = useRef(null);
  const [chlorophyllVisible, setChlorophyllVisible] = useState(true);
  const [garbagePatchesVisible, setGarbagePatchesVisible] = useState(false);
  const [shipTrafficVisible, setShipTrafficVisible] = useState(false);
  const [dataGeoJsonVisible, setDataGeoJsonVisible] = useState(true);
  const [impactReport, setImpactReport] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [whaleData, setWhaleData] = useState(null);

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

    createDataGeoJsonLayers(map);

    return () => {
      view.destroy();
      viewRef.current = null;
      chlorophyllLayerRef.current = null;
      garbagePatchLayerRef.current = null;
      shipTrafficLayerRef.current = null;
      dataGeoJsonLayersRef.current = [];
      URL.revokeObjectURL(garbagePatchUrl);
    };
  }, []);

  const createDataGeoJsonLayers = async (map) => {
    const dataGeoJsonFiles = await getDataGeoJsonFiles();
    const dataGeoJsonLayers = await Promise.all(dataGeoJsonFiles.map(createDataGeoJsonLayer));

    dataGeoJsonLayers.forEach((layer) => {
      layer.visible = dataGeoJsonVisibleRef.current;
    });

    dataGeoJsonLayersRef.current = dataGeoJsonLayers;
    map.addMany(dataGeoJsonLayers);

    // Specifically look for whale data for impact analysis
    const whaleFile = dataGeoJsonFiles.find(f => f.url.includes("whales"));
    if (whaleFile) {
      const res = await fetch(whaleFile.url);
      const data = await res.json();
      setWhaleData(data);
    }
  };

  const handleGenerateReport = async () => {
    if (!whaleData) {
      alert("No whale migration data loaded yet.");
      return;
    }

    setIsAnalyzing(true);
    // Simulate a bit of processing time for "AI" feel
    setTimeout(() => {
      const analysis = analyzeImpact(whaleData, GARBAGE_PATCHES_GEOJSON);
      const report = generateMockAIReport(analysis);
      setImpactReport(report);
      setIsAnalyzing(false);
    }, 1500);
  };

  const handleCsvUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(), // Lowercase for easier matching
      complete: async (results) => {
        const headers = results.meta.fields;
        
        // Smart Detection: Find columns that look like coordinates
        const latHeader = headers.find(h => h.includes("lat") || h === "y");
        const lonHeader = headers.find(h => h.includes("lon") || h.includes("long") || h === "x");

        if (!latHeader || !lonHeader) {
          alert(`Could not find coordinate columns. Detected headers: ${headers.join(", ")}`);
          return;
        }

        const data = results.data.filter(row => {
          const lat = row[latHeader];
          const lon = row[lonHeader];
          return lat !== null && lat !== undefined && lat !== "" && 
                 lon !== null && lon !== undefined && lon !== "";
        });

        console.log(`Smart Upload: Using '${latHeader}' and '${lonHeader}'. Found ${data.length} valid points.`);

        if (data.length === 0) {
          alert("No valid coordinate data found in those columns.");
          return;
        }

        const coordinates = data.map(row => [
          parseFloat(row[lonHeader]), 
          parseFloat(row[latHeader])
        ]);

        const geojson = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { 
                name: file.name.replace(".csv", ""),
                id: "uploaded-migration"
              },
              geometry: {
                type: "LineString",
                coordinates
              }
            }
          ]
        };

        // Update whaleData so the AI Impact Report analyzes this new data!
        setWhaleData(geojson);

        const blob = new Blob([JSON.stringify(geojson)], { type: "application/geo+json" });
        const url = URL.createObjectURL(blob);
        
        const newLayer = new GeoJSONLayer({
          url,
          title: `Uploaded: ${file.name}`,
          renderer: {
            type: "simple",
            symbol: {
              type: "simple-line",
              color: [255, 0, 150, 0.9], // Bright pink for uploaded paths
              width: 4
            }
          }
        });

        if (viewRef.current?.map) {
          viewRef.current.map.add(newLayer);
          viewRef.current.goTo(newLayer.fullExtent);
          alert(`Successfully uploaded ${file.name} and mapped ${data.length} points!`);
        }
      }
    });
  };

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

  const toggleDataGeoJsonLayers = () => {
    const nextVisible = !dataGeoJsonVisible;
    setDataGeoJsonVisible(nextVisible);
    dataGeoJsonVisibleRef.current = nextVisible;

    dataGeoJsonLayersRef.current.forEach((layer) => {
      layer.visible = nextVisible;
    });
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
          <button
            type="button"
            onClick={toggleDataGeoJsonLayers}
            className={`mt-3 w-full rounded-md border px-4 py-3 text-sm font-semibold transition ${
              dataGeoJsonVisible
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            Toggle GeoJSON Layers
          </button>
        </div>

        <div className="border-b border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-800">Impact Analysis</h2>
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={isAnalyzing}
            className={`mt-4 w-full rounded-md border px-4 py-3 text-sm font-semibold transition ${
              isAnalyzing
                ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                : "border-teal-700 bg-white text-teal-700 hover:bg-teal-50"
            }`}
          >
            {isAnalyzing ? "Analyzing Ecosystem..." : "Generate AI Impact Report"}
          </button>

          {impactReport && (
            <div className="mt-4 rounded-lg bg-zinc-50 p-4 border border-zinc-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Analysis Result</span>
                <button 
                  onClick={() => setImpactReport("")}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  Clear
                </button>
              </div>
              <div className="text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap max-h-64 overflow-y-auto font-serif">
                {impactReport}
              </div>
            </div>
          )}
        </div>

        <div className="border-b border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-800">Data Management</h2>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleCsvUpload}
            accept=".csv"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            className="mt-4 w-full rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Upload Migration CSV
          </button>
          <p className="mt-2 text-xs text-zinc-500 text-center">
            Upload CSV with latitude and longitude columns
          </p>
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
