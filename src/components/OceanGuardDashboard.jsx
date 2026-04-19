import { useEffect, useRef, useState } from "react";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import Map from "@arcgis/core/Map.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";
import SceneView from "@arcgis/core/views/SceneView.js";
import { analyzeImpact, generateMockAIReport, analyzeSpecificPodImpact, generateAgenticReport } from "../utils/ImpactAnalysis.js";
import Papa from "papaparse";

const NASA_GIBS_CHLOROPHYLL_LAYER = "VIIRS_NOAA20_Chlorophyll_a_v2022.0_NRT";

function getGibsDate(daysBack = 2) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

function getFirstGeometryType(geojson) {
  const firstFeature = geojson?.features?.find((feature) => feature.geometry);
  return firstFeature?.geometry?.type || "LineString";
}

function getWhaleSymbol(color = [0, 240, 255]) {
  return {
    type: "simple-line",
    color: [...color, 0.9],
    width: 3,
    cap: "round",
    join: "round"
  };
}

function getGeoJsonRenderer(geometryType, title) {
  const isGarbage = geometryType.includes("Polygon") || title?.toLowerCase().includes("garbage");
  
  if (isGarbage) {
    return {
      type: "unique-value",
      field: "risk_level",
      defaultSymbol: {
        type: "simple-fill",
        color: [255, 69, 0, 0.15],
        outline: { color: [255, 20, 147, 0.7], width: 1.5, style: "dash" }
      },
      uniqueValueInfos: [
        {
          value: "Critical",
          symbol: {
            type: "simple-fill",
            color: [220, 38, 38, 0.35],
            outline: { color: [255, 255, 255, 0.8], width: 2, style: "short-dash" }
          }
        },
        {
          value: "High",
          symbol: {
            type: "simple-fill",
            color: [249, 115, 22, 0.25],
            outline: { color: [255, 255, 255, 0.6], width: 1.5, style: "dot" }
          }
        }
      ]
    };
  }

  // Professional teal for whales, gold for ships
  return {
    type: "simple",
    symbol: title?.toLowerCase().includes("shipping") 
      ? { type: "simple-line", color: [255, 165, 0, 0.8], width: 2, cap: "round" }
      : getWhaleSymbol([0, 240, 255])
  };
}

async function createDataGeoJsonLayer({ url, title }) {
  const response = await fetch(url);
  const geojson = await response.json();

  return new GeoJSONLayer({
    url,
    title,
    outFields: ["*"],
    renderer: getGeoJsonRenderer(getFirstGeometryType(geojson), title),
    popupTemplate: {
      title: "{name}",
      content: [
        { type: "text", text: "<b>Location:</b> {ocean}<br/><b>Risk:</b> {risk_level}" },
        { type: "text", text: "<hr/>{description}" }
      ]
    }
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
  const dataGeoJsonLayersRef = useRef([]);
  const fileInputRef = useRef(null);
  
  const [chlorophyllVisible, setChlorophyllVisible] = useState(true);
  const [dataGeoJsonVisible, setDataGeoJsonVisible] = useState(true);
  const [impactReport, setImpactReport] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [whaleData, setWhaleData] = useState(null);
  const [shippingData, setShippingData] = useState(null);
  const [garbageData, setGarbageData] = useState(null);

  const [hoveredWhale, setHoveredWhale] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!mapRef.current || viewRef.current) return;

    const chlorophyllLayer = new WebTileLayer({
      urlTemplate: `https://gibs-a.earthdata.nasa.gov/wmts/epsg3857/all/${NASA_GIBS_CHLOROPHYLL_LAYER}/default/${getGibsDate()}/GoogleMapsCompatible_Level7/{level}/{row}/{col}.png`,
      opacity: 0.4,
      visible: true
    });
    chlorophyllLayerRef.current = chlorophyllLayer;

    const map = new Map({ basemap: "dark-gray-vector", layers: [chlorophyllLayer] });
    const view = new SceneView({
      container: mapRef.current,
      map,
      viewingMode: "global",
      camera: { position: { longitude: -155, latitude: 15, z: 12000000 }, heading: 0, tilt: 15 },
      environment: { atmosphereEnabled: true, starsEnabled: true, lighting: { type: "virtual" } },
      ui: { components: ["attribution"] }
    });

    view.on("click", async (event) => {
      const response = await view.hitTest(event);
      const results = response.results.filter(r => r.graphic?.layer?.title?.includes("Whale") || r.graphic?.layer?.title?.includes("Uploaded"));
      if (results.length > 0) handleAnalyzeSpecificPath(results[0].graphic.geometry.toJSON());
    });

    view.on("pointer-move", async (event) => {
      setMousePos({ x: event.x, y: event.y });
      const response = await view.hitTest(event);
      
      // Check for whale paths
      const whaleResult = response.results.find(r => 
        r.graphic?.layer?.title?.toLowerCase().includes("whale") || 
        r.graphic?.layer?.title?.toLowerCase().includes("uploaded")
      );

      if (whaleResult) {
        setHoveredWhale(whaleResult.graphic.attributes.name || whaleResult.graphic.attributes.whale_id || "Active Migration Path");
      } else {
        setHoveredWhale(null);
      }

      // Handle garbage patch popups separately if needed
      const garbageResult = response.results.find(r => r.graphic?.layer?.title?.toLowerCase().includes("garbage"));
      if (garbageResult) {
        view.popup.open({ location: view.toMap(event), features: [garbageResult.graphic] });
      } else if (!whaleResult) {
        view.popup.close();
      }
    });

    viewRef.current = view;
    loadDynamicLayers(map);

    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  const loadDynamicLayers = async (map) => {
    const files = await getDataGeoJsonFiles();
    const layers = await Promise.all(files.map(createDataGeoJsonLayer));
    layers.forEach(l => l.visible = true);
    dataGeoJsonLayersRef.current = layers;
    map.addMany(layers);

    const whaleFile = files.find(f => f.url.includes("whales"));
    if (whaleFile) fetch(whaleFile.url).then(r => r.json()).then(setWhaleData);
    const shipFile = files.find(f => f.url.includes("shipping_lanes"));
    if (shipFile) fetch(shipFile.url).then(r => r.json()).then(setShippingData);
    const garbageFile = files.find(f => f.url.includes("garbage_patches"));
    if (garbageFile) fetch(garbageFile.url).then(r => r.json()).then(setGarbageData);
  };

  const handleAnalyzeSpecificPath = (geometry) => {
    setIsAnalyzing(true);
    setImpactReport({ status: "SYNTHESIZING", statusColor: "text-teal-400", riskScore: 0, sections: [] });
    
    setTimeout(() => {
      try {
        const whaleFeature = { type: "Feature", geometry: { type: "LineString", coordinates: geometry.paths[0] }, properties: { name: "Target Pod" } };
        const analysis = analyzeSpecificPodImpact(whaleFeature, garbageData, shippingData);
        setImpactReport(generateAgenticReport(analysis));
      } catch (err) {
        console.error("Analysis Error:", err);
        setImpactReport({ status: "ERROR", statusColor: "text-red-500", riskScore: 0, sections: [] });
      } finally {
        setIsAnalyzing(false);
      }
    }, 1200);
  };

  const handleGenerateReport = () => {
    if (!whaleData) return alert("No whale migration data loaded.");
    setIsAnalyzing(true);
    setImpactReport({ status: "PROCESSING", statusColor: "text-zinc-500", riskScore: 0, sections: [] });
    
    setTimeout(() => {
      try {
        const analysis = analyzeImpact(whaleData, garbageData);
        setImpactReport(generateMockAIReport(analysis));
      } catch (err) {
        console.error("Global Report Error:", err);
        setImpactReport({ status: "ERROR", statusColor: "text-red-500", riskScore: 0, sections: [] });
      } finally {
        setIsAnalyzing(false);
      }
    }, 1500);
  };

  return (
    <div className="flex h-screen w-screen bg-black text-white overflow-hidden font-sans">
      {/* Cinematic Sidebar */}
      <aside className="relative z-20 flex w-[380px] flex-col border-r border-white/10 bg-black/80 backdrop-blur-2xl">
        {/* Header Branding */}
        <div className="border-b border-white/10 p-8">
          <h2 className="text-3xl font-bold tracking-tighter">OceanGuard</h2>
          <p className="mt-1 font-serif italic text-zinc-400 text-lg">Saving Whale Lives</p>
          
          <button 
            onClick={() => fileInputRef.current.click()}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg bg-white py-4 text-xs font-black uppercase tracking-[0.2em] text-black transition hover:bg-teal-400"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import Migration CSV
          </button>
          <input type="file" ref={fileInputRef} onChange={(e) => {
            const file = e.target.files[0];
            if (!file) return;
            Papa.parse(file, { header: true, dynamicTyping: true, complete: (res) => {
              try {
                const headers = Object.keys(res.data[0]);
                const latH = headers.find(k => k === "location-lat") || headers.find(k => k.toLowerCase().includes("lat"));
                const lonH = headers.find(k => k === "location-long") || headers.find(k => k.toLowerCase().includes("lon"));
                const timeH = headers.find(k => k === "timestamp") || headers.find(k => k.toLowerCase().includes("time"));
                const individualH = headers.find(k => k === "individual-local-identifier") || headers.find(k => k.toLowerCase().includes("individual")) || headers.find(k => k.toLowerCase().includes("id"));
                
                const formatWhaleName = (name) => {
                  return name.replace(/\.csv$/i, "").replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/migration/i, "").replace(/path/i, "").trim().replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
                };

                function haversineDistance(p1, p2) {
                  const R = 6371;
                  const toRad = d => d * Math.PI / 180;

                  const dLat = toRad(p2[1] - p1[1]);
                  const dLon = toRad(p2[0] - p1[0]);

                  const lat1 = toRad(p1[1]);
                  const lat2 = toRad(p2[1]);

                  const a =
                    Math.sin(dLat / 2) ** 2 +
                    Math.cos(lat1) * Math.cos(lat2) *
                    Math.sin(dLon / 2) ** 2;

                  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                }

                const species = formatWhaleName(file.name);
                const groupedRows = res.data.reduce((groups, row) => {
                  const key = individualH ? row[individualH] || "Unknown Individual" : "Migration Path";
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(row);
                  return groups;
                }, {});

                const createFeaturesFromGroups = (groups) => Object.entries(groups).flatMap(([individual, rows]) => {
                  const sortedRows = timeH
                    ? [...rows].sort((a, b) => new Date(a[timeH]) - new Date(b[timeH]))
                    : rows;
                  const features = [];
                  let coords = [];
                  let lastPoint = null;
                  let segmentIndex = 1;

                  sortedRows.forEach((row) => {
                    const longitude = parseFloat(row[lonH]);
                    const latitude = parseFloat(row[latH]);

                    if (Number.isNaN(longitude) || Number.isNaN(latitude)) {
                      return;
                    }

                    const currentPoint = [longitude, latitude];

                    if (lastPoint) {
                      const distanceKm = haversineDistance(lastPoint, currentPoint);
                      if (distanceKm > 300) {
                        if (coords.length > 1) {
                          features.push({
                            type: "Feature",
                            geometry: { type: "LineString", coordinates: coords },
                            properties: {
                              name: species,
                              file_source: file.name,
                              whale_id: individual,
                              individual,
                              segment_index: segmentIndex
                            }
                          });
                          segmentIndex += 1;
                        }
                        coords = [];
                      }
                    }

                    coords.push(currentPoint);
                    lastPoint = currentPoint;
                  });

                  if (coords.length > 1) {
                    features.push({
                      type: "Feature",
                      geometry: { type: "LineString", coordinates: coords },
                      properties: {
                        name: species,
                        file_source: file.name,
                        whale_id: individual,
                        individual,
                        segment_index: segmentIndex
                      }
                    });
                  }

                  return features;
                });
                const features = createFeaturesFromGroups(groupedRows);

                const geojson = {
                  type: "FeatureCollection",
                  features
                };
                setWhaleData(geojson);
                const layer = new GeoJSONLayer({ 
                  url: URL.createObjectURL(new Blob([JSON.stringify(geojson)], { type: "application/geo+json" })), 
                  title: `Uploaded: ${file.name}`, 
                  renderer: { type: "simple", symbol: getWhaleSymbol([37, 99, 235]) }
                });
                viewRef.current.map.add(layer);
                layer.when(() => {
                  if (layer.fullExtent) {
                    viewRef.current.goTo(layer.fullExtent);
                  }
                });
              } catch (err) {
                console.error("CSV Import Error:", err);
                alert("Failed to parse CSV. Please ensure it has Latitude/Longitude headers.");
              }
            }});
          }} accept=".csv" className="hidden" />
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {/* Layer Toggles */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">Ocean Intelligence</h3>
            <div className="space-y-3">
              <button 
                onClick={() => { setChlorophyllVisible(!chlorophyllVisible); chlorophyllLayerRef.current.visible = !chlorophyllVisible; }}
                className={`flex w-full items-center justify-between rounded-lg border px-5 py-4 transition-all ${chlorophyllVisible ? "border-teal-500/50 bg-teal-500/10 text-teal-400" : "border-white/10 bg-white/5 text-zinc-500"}`}
              >
                <span className="text-sm font-semibold tracking-wide">NASA Chlorophyll-a</span>
                <div className={`h-2 w-2 rounded-full ${chlorophyllVisible ? "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" : "bg-zinc-700"}`} />
              </button>
              
              <button 
                onClick={() => { setDataGeoJsonVisible(!dataGeoJsonVisible); dataGeoJsonLayersRef.current.forEach(l => l.visible = !dataGeoJsonVisible); }}
                className={`flex w-full items-center justify-between rounded-lg border px-5 py-4 transition-all ${dataGeoJsonVisible ? "border-blue-500/50 bg-blue-500/10 text-blue-400" : "border-white/10 bg-white/5 text-zinc-500"}`}
              >
                <span className="text-sm font-semibold tracking-wide">Ecosystem Analytics</span>
                <div className={`h-2 w-2 rounded-full ${dataGeoJsonVisible ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" : "bg-zinc-700"}`} />
              </button>
            </div>
          </section>

          {/* AI Analysis Feed */}
          <section className="flex flex-col h-[500px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Agentic Insights</h3>
              {impactReport && (
                <button 
                  onClick={() => setImpactReport(null)}
                  className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-white transition"
                >
                  Reset
                </button>
              )}
            </div>
            
            <div className="flex-1 rounded-xl border border-white/10 bg-white/5 p-6 overflow-y-auto custom-scrollbar">
              {impactReport ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  {/* Status Header */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded border border-current ${impactReport.statusColor}`}>
                      {impactReport.status}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">SCORE: {impactReport.riskScore.toFixed(1)}/10</span>
                  </div>

                  {/* Risk Meter */}
                  <div className="space-y-2">
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${impactReport.riskScore > 5 ? "bg-red-500" : "bg-teal-400"}`}
                        style={{ width: `${impactReport.riskScore * 10}%` }}
                      />
                    </div>
                  </div>

                  {/* Sections */}
                  {impactReport.sections.map((section) => (
                    <div key={section.id} className={`space-y-3 ${section.isSpecial ? "pt-6 border-t border-white/10" : ""}`}>
                      <div className="flex items-center gap-2">
                        <div className={`h-1 w-1 rounded-full ${section.isAlert ? "bg-orange-400 animate-pulse" : "bg-zinc-600"}`} />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{section.label}</h4>
                      </div>
                      <p className={`text-sm font-bold ${section.isSpecial ? "font-serif italic text-teal-400 text-lg" : "text-white"}`}>
                        {section.value}
                      </p>
                      <ul className="space-y-2">
                        {section.details.map((detail, idx) => (
                          <li key={idx} className="text-xs leading-relaxed text-zinc-500 pl-3 border-l border-white/5">
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                  <div className="h-12 w-12 rounded-full border border-dashed border-white/30 animate-spin-slow" />
                  <p className="text-xs uppercase tracking-tighter leading-relaxed">
                    Intelligence Feed Offline<br/>
                    <span className="text-[10px] text-zinc-600">Select a migration path to initialize agent</span>
                  </p>
                </div>
              )}
            </div>
            
            <button 
              onClick={handleGenerateReport}
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-lg border border-white/20 bg-white/5 py-4 text-sm font-bold uppercase tracking-widest transition hover:bg-white hover:text-black"
            >
              Analyze Global Risk
            </button>
          </section>
        </div>
        
        {/* Footer Status */}
        <div className="border-t border-white/10 p-8 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
          System Online // Global Data Discovery Active
        </div>
      </aside>

      {/* Fullscreen Map */}
      <main className="relative flex-1 bg-[#1a1a1a]">
        <div ref={mapRef} className="h-full w-full" />
        
        {/* Floating Intelligence HUD */}
        {hoveredWhale && (
          <div 
            className="pointer-events-none absolute z-50 rounded-lg border border-teal-500/30 bg-black/80 px-4 py-2 backdrop-blur-md shadow-[0_0_20px_rgba(20,184,166,0.2)] animate-in fade-in zoom-in-95 duration-200"
            style={{ left: mousePos.x + 20, top: mousePos.y - 20 }}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400 mb-0.5">Tracking Pod</div>
            <div className="text-sm font-bold text-white whitespace-nowrap">{hoveredWhale}</div>
          </div>
        )}

        <div className="absolute top-8 right-8 z-30 flex flex-col gap-4">
          {isAnalyzing && (
            <div className="flex items-center gap-3 rounded-full bg-black/60 px-6 py-3 backdrop-blur-md border border-teal-500/30">
              <div className="h-2 w-2 animate-pulse rounded-full bg-teal-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">Agent Processing</span>
            </div>
          )}
          
          {hoveredWhale && (
            <div className="flex items-center gap-3 rounded-full bg-black/60 px-6 py-3 backdrop-blur-md border border-white/10">
              <div className="h-2 w-2 rounded-full bg-white shadow-[0_0_10px_white]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">{hoveredWhale}</span>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
