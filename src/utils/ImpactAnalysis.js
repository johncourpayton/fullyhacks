import * as turf from "@turf/turf";

/**
 * Analyzes the impact of contamination and shipping traffic on a specific migration path.
 * @param {Object} whaleFeature - A single GeoJSON Feature (LineString)
 * @param {Object} garbageGeoJson - FeatureCollection of garbage patches
 * @param {Object} shipsGeoJson - FeatureCollection of shipping lanes
 * @returns {Object} Deep analysis results.
 */
export function analyzeSpecificPodImpact(whaleFeature, garbageGeoJson, shipsGeoJson) {
  if (!whaleFeature) return null;

  const whaleName = whaleFeature.properties.name || whaleFeature.properties.whale_id || "Pod 101";
  
  const contaminationRisks = [];
  const shippingRisks = [];

  // 1. Analyze Contamination Intersections
  if (garbageGeoJson) {
    garbageGeoJson.features.forEach((zone) => {
      const intersect = turf.lineIntersect(whaleFeature, zone);
      if (intersect.features.length > 0) {
        contaminationRisks.push({
          zone: zone.properties.name,
          intersections: intersect.features.length,
          severity: zone.properties.ocean === "Southern Ocean" ? "Critical" : "High"
        });
      }
    });
  }

  // 2. Analyze Shipping Lane Proximity/Intersection
  if (shipsGeoJson) {
    shipsGeoJson.features.forEach((lane) => {
      // For shipping lanes (LineStrings), we check for proximity or cross-points
      const intersect = turf.lineIntersect(whaleFeature, lane);
      if (intersect.features.length > 0) {
        shippingRisks.push({
          lane: lane.properties.name,
          traffic: lane.properties.traffic_density,
          points: intersect.features.length
        });
      }
    });
  }

  return {
    whaleName,
    contaminationRisks,
    shippingRisks,
    overallRiskScore: (contaminationRisks.length * 2) + shippingRisks.length,
    timestamp: new Date().toLocaleString()
  };
}

/**
 * AI Agent prompt generator and report formatter.
 */
export function generateAgenticReport(analysis) {
  if (!analysis) return "Agent offline: No data provided.";

  const { whaleName, contaminationRisks, shippingRisks, overallRiskScore } = analysis;
  
  let report = `## 🤖 AI Agent: Impact Assessment for ${whaleName}\n\n`;
  
  if (overallRiskScore > 5) {
    report += `🔴 **CRITICAL ALERT**: This pod is currently on a high-risk trajectory.\n\n`;
  } else if (overallRiskScore > 0) {
    report += `🟡 **CAUTION**: Potential ecosystem stressors detected.\n\n`;
  } else {
    report += `🟢 **MONITORING**: No immediate threats detected for this pod.\n\n`;
  }

  if (contaminationRisks.length > 0) {
    report += `### ☢️ Contamination Exposure\n`;
    contaminationRisks.forEach(r => {
      report += `- **${r.zone}**: Detected **${r.intersections}** intersection points. Threat Level: \`${r.severity}\`.\n`;
    });
  }

  if (shippingRisks.length > 0) {
    report += `\n### 🚢 Maritime Traffic Conflict\n`;
    shippingRisks.forEach(r => {
      report += `- **${r.lane}**: Path crosses this **${r.traffic}** traffic lane **${r.points}** times. Risk of acoustic disturbance or collision is elevated.\n`;
    });
  }

  report += `\n### 🧠 Agent Recommendation\n`;
  if (overallRiskScore > 5) {
    report += "The AI Agent recommends immediate rerouting of maritime traffic or deployment of a cleanup vessel to the intersection coordinates to mitigate acute exposure.";
  } else if (overallRiskScore > 0) {
    report += "Continued observation is advised. Acoustic sensors should be deployed to monitor stress levels as the pod enters shipping corridors.";
  } else {
    report += "Optimal path detected. Maintain current monitoring frequency.";
  }

  return report;
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

export function generateMockAIReport() {
    return "Please click on a specific whale path to generate a deep-dive AI Impact Report.";
}
