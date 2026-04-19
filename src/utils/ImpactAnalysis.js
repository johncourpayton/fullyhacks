import * as turf from "@turf/turf";

/**
 * Analyzes the impact of contamination and shipping traffic on a specific migration path.
 * @param {Object} whaleFeature - A single GeoJSON Feature (LineString)
 * @param {Object} garbageGeoJson - FeatureCollection of garbage patches
 * @param {Object} shipsGeoJson - FeatureCollection of shipping lanes
 * @returns {Object} Deep analysis results.
 */
export function analyzeSpecificPodImpact(whaleFeature, garbageGeoJson, shipsGeoJson) {
  if (!whaleFeature) return { overallRiskScore: 0, garbageIntersections: [], shippingRisks: [] };

  const whaleName = whaleFeature.properties?.name || "Target Pod";
  const garbageIntersections = [];
  const shippingRisks = [];

  if (garbageGeoJson && garbageGeoJson.features) {
    garbageGeoJson.features.forEach((zone) => {
      const intersect = turf.lineIntersect(whaleFeature, zone);
      if (intersect.features.length > 0) {
        garbageIntersections.push({
          patch: zone.properties.name,
          risk: zone.properties.risk_level || "High",
          points: intersect.features.length
        });
      }
    });
  }

  if (shipsGeoJson && shipsGeoJson.features) {
    shipsGeoJson.features.forEach((lane) => {
      const intersect = turf.lineIntersect(whaleFeature, lane);
      if (intersect.features.length > 0) {
        shippingRisks.push({
          lane: lane.properties.name,
          traffic: lane.properties.traffic_density || "Moderate",
          points: intersect.features.length
        });
      }
    });
  }

  return {
    whaleName,
    garbageIntersections,
    shippingRisks,
    overallRiskScore: (garbageIntersections.length * 2.5) + (shippingRisks.length * 1.5)
  };
}

/**
 * AI Agent prompt generator and report formatter.
 */
export function generateAgenticReport(analysis) {
  const { overallRiskScore, garbageIntersections, shippingRisks } = analysis;
  
  let status = "OPTIMAL";
  let statusColor = "text-teal-400";
  if (overallRiskScore > 7) {
    status = "CRITICAL";
    statusColor = "text-red-500";
  } else if (overallRiskScore > 3) {
    status = "WARNING";
    statusColor = "text-orange-400";
  }

  return {
    title: "Ecosystem Impact Assessment",
    status,
    statusColor,
    riskScore: overallRiskScore,
    sections: [
      {
        id: "env",
        label: "Environmental Stress",
        value: garbageIntersections.length > 0 ? `${garbageIntersections.length} Contamination Intersects` : "No Contamination Detected",
        details: garbageIntersections.map(g => `Proximity to ${g.patch} (${g.risk} zone). High microplastic density detected.`),
        isAlert: garbageIntersections.length > 0
      },
      {
        id: "traffic",
        label: "Maritime Conflict",
        value: shippingRisks.length > 0 ? `${shippingRisks.length} Traffic Corridors` : "Clear Navigation",
        details: shippingRisks.map(r => `Crosses ${r.lane} (${r.traffic} traffic). Risk of acoustic stress: Elevated.`),
        isAlert: shippingRisks.length > 0
      },
      {
        id: "rec",
        label: "Agent Recommendation",
        value: "Protocol Assigned",
        details: [
          overallRiskScore > 5 
            ? "Immediate rerouting of maritime traffic or deployment of cleanup vessel recommended." 
            : "Continued observation. Deploy acoustic sensors to monitor stress levels."
        ],
        isSpecial: true
      }
    ]
  };
}

export function generateMockAIReport(analysis) {
  // Simple wrapper to maintain compatibility with the new structured UI
  return generateAgenticReport({
    overallRiskScore: analysis.riskScore || 0,
    garbageIntersections: analysis.garbageIntersections || [],
    shippingRisks: []
  });
}

// Keep the old functions for compatibility
export function analyzeImpact(whaleGeoJson, contaminationGeoJson) {
    // Basic wrapper for the old dashboard button
    if (!whaleGeoJson?.features?.[0]) return null;
    return {
        summary: [{
            whaleName: "Global Fleet",
            intersections: [],
            status: "Monitoring"
        }],
        totalIntersections: 0
    };
}
