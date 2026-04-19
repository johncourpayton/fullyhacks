import * as turf from "@turf/turf";

const PROXIMITY_RISK_DISTANCE_KM = 750;

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

function getLineToZoneDistanceKm(lineFeature, zoneFeature) {
  try {
    const points = [
      turf.centroid(zoneFeature),
      ...turf.coordAll(zoneFeature).map((coordinate) => turf.point(coordinate))
    ];

    return Math.min(
      ...points.map((point) => turf.pointToLineDistance(point, lineFeature, { units: "kilometers" }))
    );
  } catch {
    return Infinity;
  }
}

/**
 * Analyzes the impact of ocean trash on a specific whale migration path.
 * @param {Object} whaleFeature - A single GeoJSON Feature (LineString)
 * @param {Object} garbageGeoJson - FeatureCollection of garbage patches
 * @returns {Object} Deep analysis results.
 */
export function analyzeSpecificPodImpact(whaleFeature, garbageGeoJson) {
  if (!whaleFeature) return { overallRiskScore: 0, garbageIntersections: [] };

  const whaleName = whaleFeature.properties?.name || "Target Pod";
  const garbageIntersections = [];

  if (garbageGeoJson && garbageGeoJson.features) {
    garbageGeoJson.features.forEach((zone) => {
      const intersect = turf.lineIntersect(whaleFeature, zone);
      if (intersect.features.length > 0) {
        garbageIntersections.push({
          patch: zone.properties.name,
          risk: zone.properties.risk_level || "High",
          points: intersect.features.length,
          distanceKm: 0
        });
        return;
      }

      const distanceKm = getLineToZoneDistanceKm(whaleFeature, zone);
      if (distanceKm <= PROXIMITY_RISK_DISTANCE_KM) {
        garbageIntersections.push({
          patch: zone.properties.name,
          risk: zone.properties.risk_level || "High",
          points: 0,
          distanceKm
        });
      }
    });
  }

  const rawRiskScore = garbageIntersections.reduce((score, item) => {
    const proximityMultiplier = item.distanceKm
      ? Math.max(0.25, 1 - (item.distanceKm / PROXIMITY_RISK_DISTANCE_KM))
      : 1;

    return score + (getRiskWeight(item.risk) * proximityMultiplier);
  }, 0);

  return {
    whaleName,
    garbageIntersections,
    overallRiskScore: clampRiskScore(rawRiskScore)
  };
}

/**
 * AI Agent prompt generator and report formatter.
 */
export function generateAgenticReport(analysis) {
  const { overallRiskScore, garbageIntersections } = analysis;
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
        label: "Trash Exposure",
        value: garbageIntersections.length > 0 ? `${garbageIntersections.length} Trash Risk Zones Detected` : "No Trash Zone Detected",
        details: garbageIntersections.map(g => g.distanceKm
          ? `${g.patch} is within ${Math.round(g.distanceKm)} km (${g.risk} zone). Monitor this migration route.`
          : `Crosses ${g.patch} (${g.risk} zone). High microplastic density detected.`),
        isAlert: garbageIntersections.length > 0
      },
      {
        id: "rec",
        label: "Agent Recommendation",
        value: "Protocol Assigned",
        details: [
          riskScore > 5
            ? "High trash exposure detected. Prioritize cleanup monitoring and flag this route for conservation review."
            : "Continued observation recommended. Keep tracking this migration path against ocean trash zones."
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
    garbageIntersections: analysis.garbageIntersections || []
  });
}

// Keep the old functions for compatibility
export function analyzeImpact(whaleGeoJson, garbageGeoJson) {
  const whaleFeatures = whaleGeoJson?.features || [];
  const garbageFeatures = garbageGeoJson?.features || [];
  const garbageIntersections = [];
  const intersectingPaths = new Set();

  whaleFeatures.forEach((whaleFeature, whaleIndex) => {
    if (!whaleFeature?.geometry) return;

    garbageFeatures.forEach((zone) => {
      if (!zone?.geometry) return;

      const intersect = turf.lineIntersect(whaleFeature, zone);
      if (intersect.features.length > 0) {
        const patch = zone.properties?.name || "Trash Zone";
        const risk = zone.properties?.risk_level || "High";

        intersectingPaths.add(whaleIndex);
        garbageIntersections.push({
          patch,
          risk,
          points: intersect.features.length,
          distanceKm: 0
        });
        return;
      }

      const distanceKm = getLineToZoneDistanceKm(whaleFeature, zone);
      if (distanceKm <= PROXIMITY_RISK_DISTANCE_KM) {
        const patch = zone.properties?.name || "Trash Zone";
        const risk = zone.properties?.risk_level || "High";

        intersectingPaths.add(whaleIndex);
        garbageIntersections.push({
          patch,
          risk,
          points: 0,
          distanceKm
        });
      }
    });
  });

  const exposureScore = whaleFeatures.length > 0
    ? (intersectingPaths.size / whaleFeatures.length) * 7
    : 0;
  const severityScore = garbageIntersections.reduce((score, item) => {
    const proximityMultiplier = item.distanceKm
      ? Math.max(0.25, 1 - (item.distanceKm / PROXIMITY_RISK_DISTANCE_KM))
      : 1;

    return score + (getRiskWeight(item.risk) * proximityMultiplier);
  }, 0);

  return {
    riskScore: clampRiskScore(exposureScore + severityScore),
    garbageIntersections,
    totalIntersections: garbageIntersections.length
  };
}
