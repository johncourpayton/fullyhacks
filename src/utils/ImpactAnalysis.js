import * as turf from "@turf/turf";

function clampRiskScore(score) {
  const numericScore = Number(score) || 0;
  return Math.min(10, Math.max(0, numericScore));
}

function getRiskWeight(riskLevel) {
  switch ((riskLevel || "").toLowerCase()) {
    case "critical":
      return 3.5;
    case "high":
      return 2.5;
    case "medium":
      return 1.5;
    default:
      return 1;
  }
}

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

  const rawRiskScore = garbageIntersections.reduce((score, item) => score + getRiskWeight(item.risk), 0) + (shippingRisks.length * 1.5);

  return {
    whaleName,
    garbageIntersections,
    shippingRisks,
    overallRiskScore: clampRiskScore(rawRiskScore)
  };
}

/**
 * AI Agent prompt generator and report formatter.
 */
export function generateAgenticReport(analysis) {
  const { overallRiskScore, garbageIntersections, shippingRisks } = analysis;
  const riskScore = clampRiskScore(overallRiskScore);
  
  let status = "OPTIMAL";
  let statusColor = "text-teal-400";
  if (riskScore > 7) {
    status = "CRITICAL";
    statusColor = "text-red-500";
  } else if (riskScore > 3) {
    status = "WARNING";
    statusColor = "text-orange-400";
  }

  return {
    title: "Ecosystem Impact Assessment",
    status,
    statusColor,
    riskScore,
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
          riskScore > 5
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
  const whaleFeatures = whaleGeoJson?.features || [];
  const contaminationFeatures = contaminationGeoJson?.features || [];
  const garbageIntersections = [];
  const intersectingPaths = new Set();

  whaleFeatures.forEach((whaleFeature, whaleIndex) => {
    if (!whaleFeature?.geometry) return;

    contaminationFeatures.forEach((zone) => {
      if (!zone?.geometry) return;

      const intersect = turf.lineIntersect(whaleFeature, zone);
      if (intersect.features.length > 0) {
        const patch = zone.properties?.name || "Contamination Zone";
        const risk = zone.properties?.risk_level || "High";

        intersectingPaths.add(whaleIndex);
        garbageIntersections.push({
          patch,
          risk,
          points: intersect.features.length
        });
      }
    });
  });

  const exposureScore = whaleFeatures.length > 0
    ? (intersectingPaths.size / whaleFeatures.length) * 7
    : 0;
  const severityScore = garbageIntersections.reduce((score, item) => score + getRiskWeight(item.risk), 0);

  return {
    riskScore: clampRiskScore(exposureScore + severityScore),
    garbageIntersections,
    totalIntersections: garbageIntersections.length
  };
}
