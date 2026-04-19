import { PNG } from "pngjs";

const SENTINEL_AUTH_URL =
  "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token";
const SENTINEL_PROCESS_URL = "https://services.sentinel-hub.com/api/v1/process";

let tokenCache = {
  accessToken: null,
  expiresAt: 0
};

export const oilSpillRegions = [
  { name: "California Coast", bbox: [-126.5, 33.0, -120.5, 38.5] },
  { name: "Gulf of Mexico", bbox: [-98.5, 18.0, -80.0, 31.0] },
  { name: "North Sea", bbox: [-5.5, 51.0, 9.5, 61.5] },
  { name: "Persian Gulf", bbox: [47.0, 24.0, 57.5, 30.5] },
  { name: "Gulf of Guinea", bbox: [-8.0, -2.5, 10.5, 7.0] },
  { name: "South China Sea", bbox: [104.0, 4.0, 121.0, 23.0] }
];

function fallbackOilSpillGeoJson(bbox, timeRange, reason, regionName = "Custom Region") {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const width = maxLon - minLon;
  const height = maxLat - minLat;

  const slicks = [
    {
      id: "demo-oil-spill-001",
      cx: minLon + width * 0.38,
      cy: minLat + height * 0.58,
      rx: width * 0.08,
      ry: height * 0.035,
      confidence: "demo"
    },
    {
      id: "demo-oil-spill-002",
      cx: minLon + width * 0.64,
      cy: minLat + height * 0.42,
      rx: width * 0.06,
      ry: height * 0.028,
      confidence: "demo"
    }
  ];

  return {
    type: "FeatureCollection",
    features: slicks.map((slick) => ({
      type: "Feature",
      properties: {
        id: `${regionName.toLowerCase().replaceAll(" ", "-")}-${slick.id}`,
        region: regionName,
        type: "Possible Oil Spill",
        confidence: slick.confidence,
        detectionMode: "demo-fallback",
        reason
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [slick.cx - slick.rx, slick.cy],
            [slick.cx - slick.rx * 0.45, slick.cy - slick.ry],
            [slick.cx + slick.rx * 0.65, slick.cy - slick.ry * 0.7],
            [slick.cx + slick.rx, slick.cy],
            [slick.cx + slick.rx * 0.45, slick.cy + slick.ry],
            [slick.cx - slick.rx * 0.65, slick.cy + slick.ry * 0.7],
            [slick.cx - slick.rx, slick.cy]
          ]
        ]
      }
    })),
    properties: {
      bbox,
      timeRange,
      region: regionName,
      source: "Demo fallback oil spill polygons",
      method: "Synthetic slick polygons returned when Sentinel-1 detections are unavailable",
      fallbackReason: reason
    }
  };
}

export function parseBbox(rawBbox) {
  if (!rawBbox) {
    return [-126.5, 33.0, -120.5, 38.5];
  }

  const bbox = rawBbox.split(",").map((value) => Number(value.trim()));

  if (bbox.length !== 4 || bbox.some((value) => Number.isNaN(value))) {
    throw new Error("bbox must be minLon,minLat,maxLon,maxLat");
  }

  const [minLon, minLat, maxLon, maxLat] = bbox;

  if (minLon >= maxLon || minLat >= maxLat) {
    throw new Error("bbox minimums must be less than maximums");
  }

  return bbox;
}

export function getRecentTimeRange(hoursBack = 48) {
  const to = new Date();
  const from = new Date(to.getTime() - hoursBack * 60 * 60 * 1000);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

export async function getSentinelHubAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.SENTINEL_HUB_CLIENT_ID;
  const clientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Sentinel Hub OAuth credentials");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
  });

  const response = await fetch(SENTINEL_AUTH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Sentinel Hub auth failed: ${response.status}`);
  }

  const token = await response.json();
  tokenCache = {
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in - 60) * 1000
  };

  return tokenCache.accessToken;
}

export async function fetchSentinel1OilMask({ bbox, timeRange, width = 256, height = 256 }) {
  const accessToken = await getSentinelHubAccessToken();

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: [{ bands: ["VV", "dataMask"] }],
        output: { bands: 1, sampleType: "UINT8" }
      };
    }

    function evaluatePixel(sample) {
      if (sample.dataMask === 0 || sample.VV <= 0) {
        return [0];
      }

      var vvDb = 10 * Math.log(sample.VV) / Math.LN10;
      return [vvDb < -22 ? 255 : 0];
    }
  `;

  const response = await fetch(SENTINEL_PROCESS_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "image/png"
    },
    body: JSON.stringify({
      input: {
        bounds: {
          bbox,
          properties: {
            crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
          }
        },
        data: [
          {
            type: "sentinel-1-grd",
            dataFilter: {
              timeRange,
              acquisitionMode: "IW"
            },
            processing: {
              backCoeff: "GAMMA0_ELLIPSOID"
            }
          }
        ]
      },
      output: {
        width,
        height,
        responses: [
          {
            identifier: "default",
            format: { type: "image/png" }
          }
        ]
      },
      evalscript
    })
  });

  if (!response.ok) {
    throw new Error(`Sentinel Hub process failed: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export function oilMaskToGeoJson(pngBuffer, bbox, { threshold = 128, minPixels = 8 } = {}) {
  const png = PNG.sync.read(pngBuffer);
  const visited = new Uint8Array(png.width * png.height);
  const features = [];

  function pixelValue(x, y) {
    return png.data[(y * png.width + x) * 4];
  }

  function pixelToLonLat(x, y) {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const lon = minLon + (x / png.width) * (maxLon - minLon);
    const lat = maxLat - (y / png.height) * (maxLat - minLat);

    return [lon, lat];
  }

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const startIndex = y * png.width + x;

      if (visited[startIndex] || pixelValue(x, y) < threshold) {
        continue;
      }

      const stack = [[x, y]];
      let count = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      visited[startIndex] = 1;

      while (stack.length) {
        const [cx, cy] = stack.pop();
        count += 1;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1]
        ].forEach(([nx, ny]) => {
          if (nx < 0 || ny < 0 || nx >= png.width || ny >= png.height) {
            return;
          }

          const nextIndex = ny * png.width + nx;

          if (!visited[nextIndex] && pixelValue(nx, ny) >= threshold) {
            visited[nextIndex] = 1;
            stack.push([nx, ny]);
          }
        });
      }

      if (count < minPixels) {
        continue;
      }

      const [west, north] = pixelToLonLat(minX, minY);
      const [east, south] = pixelToLonLat(maxX + 1, maxY + 1);

      features.push({
        type: "Feature",
        properties: {
          type: "Possible Oil Spill",
          confidence: "low",
          pixelCount: count
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south]
            ]
          ]
        }
      });
    }
  }

  return {
    type: "FeatureCollection",
    features
  };
}

export async function fetchOilSpillGeoJson({ bbox, hoursBack = 48, regionName = "Custom Region" }) {
  const timeRange = getRecentTimeRange(hoursBack);

  try {
    const mask = await fetchSentinel1OilMask({ bbox, timeRange });
    const geoJson = oilMaskToGeoJson(mask, bbox);

    if (geoJson.features.length === 0) {
      return fallbackOilSpillGeoJson(
        bbox,
        timeRange,
        "No dark Sentinel-1 regions detected",
        regionName
      );
    }

    return {
      ...geoJson,
      features: geoJson.features.map((feature, index) => ({
        ...feature,
        properties: {
          ...feature.properties,
          id: `${regionName.toLowerCase().replaceAll(" ", "-")}-sentinel-${index}`,
          region: regionName,
          detectionMode: "sentinel-1-threshold"
        }
      })),
      properties: {
        bbox,
        timeRange,
        region: regionName,
        source: "Sentinel-1 GRD via Sentinel Hub Process API",
        method: "VV backscatter threshold below -22 dB, connected components to coarse polygons"
      }
    };
  } catch (error) {
    console.warn(`Using demo oil spill fallback for ${regionName}:`, error.message);
    return fallbackOilSpillGeoJson(bbox, timeRange, error.message, regionName);
  }
}

export async function fetchRegionalOilSpillGeoJson({ hoursBack = 48, limit = oilSpillRegions.length }) {
  const boundedLimit = Math.min(Math.max(limit, 1), oilSpillRegions.length);
  const regions = oilSpillRegions.slice(0, boundedLimit);
  const collections = await Promise.all(
    regions.map((region) =>
      fetchOilSpillGeoJson({
        bbox: region.bbox,
        hoursBack,
        regionName: region.name
      })
    )
  );

  return {
    type: "FeatureCollection",
    features: collections.flatMap((collection) => collection.features),
    properties: {
      source: "Regional Sentinel-1 oil spill scan",
      regions: oilSpillRegions,
      activeRegions: regions,
      regionCount: oilSpillRegions.length,
      activeRegionCount: regions.length,
      featureCount: collections.reduce((total, collection) => total + collection.features.length, 0)
    }
  };
}
