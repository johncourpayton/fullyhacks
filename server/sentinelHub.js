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
  { name: "South China Sea", bbox: [104.0, 4.0, 121.0, 23.0] },
  { name: "Malacca Strait", bbox: [95.0, 0.0, 104.5, 7.0] },
  { name: "Singapore Strait", bbox: [102.5, 0.8, 105.0, 2.0] },
  { name: "Mediterranean Sea", bbox: [-6.0, 30.0, 36.0, 46.0] },
  { name: "Red Sea Suez Corridor", bbox: [32.0, 12.0, 44.0, 30.5] },
  { name: "Black Sea", bbox: [27.0, 40.0, 42.5, 47.5] },
  { name: "Baltic Sea", bbox: [9.0, 53.0, 31.0, 66.0] },
  { name: "Caribbean Basin", bbox: [-88.0, 9.0, -58.0, 23.0] },
  { name: "Venezuela Trinidad Coast", bbox: [-73.0, 8.0, -58.0, 14.0] },
  { name: "Brazil Santos Basin", bbox: [-50.0, -30.0, -36.0, -20.0] },
  { name: "Brazil Campos Basin", bbox: [-44.0, -24.0, -36.0, -18.0] },
  { name: "Angola Offshore", bbox: [5.0, -18.0, 15.5, -4.0] },
  { name: "Mozambique Channel", bbox: [35.0, -26.0, 50.0, -10.0] },
  { name: "East China Sea", bbox: [118.0, 24.0, 132.0, 34.0] },
  { name: "Yellow Sea", bbox: [118.0, 32.0, 126.5, 40.5] },
  { name: "Japan Korea Shipping Lanes", bbox: [127.0, 31.0, 143.0, 41.0] },
  { name: "Bay of Bengal", bbox: [80.0, 5.0, 96.0, 22.0] },
  { name: "Arabian Sea", bbox: [52.0, 8.0, 75.0, 25.0] },
  { name: "Gulf of Oman", bbox: [55.0, 22.0, 63.5, 27.5] },
  { name: "Caspian Sea", bbox: [46.0, 36.0, 54.5, 47.5] },
  { name: "Alaska North Pacific", bbox: [-170.0, 50.0, -135.0, 61.0] },
  { name: "Bering Sea", bbox: [165.0, 52.0, -160.0, 66.0] },
  { name: "Canadian Atlantic Offshore", bbox: [-66.0, 42.0, -45.0, 55.0] },
  { name: "US Atlantic Seaboard", bbox: [-82.0, 25.0, -66.0, 42.0] },
  { name: "Patagonia South Atlantic", bbox: [-68.0, -55.0, -50.0, -38.0] },
  { name: "West Australia Offshore", bbox: [110.0, -34.0, 123.0, -12.0] },
  { name: "Timor Sea", bbox: [120.0, -15.0, 134.0, -8.0] },
  { name: "Java Sea", bbox: [105.0, -8.0, 119.0, -2.0] },
  { name: "Arafura Sea", bbox: [130.0, -13.0, 143.0, -5.0] },
  { name: "Great Barrier Reef Shipping Lane", bbox: [145.0, -25.0, 154.0, -10.0] },
  { name: "New Zealand Coastal Shipping", bbox: [165.0, -48.0, 180.0, -34.0] },
  { name: "South Africa Cape Route", bbox: [12.0, -38.0, 32.0, -28.0] },
  { name: "Namibia Offshore", bbox: [8.0, -29.0, 16.0, -17.0] },
  { name: "Morocco Canary Shipping", bbox: [-18.5, 25.0, -5.0, 36.5] },
  { name: "North Atlantic Shipping Lane", bbox: [-60.0, 40.0, -10.0, 58.0] },
  { name: "Eastern Mediterranean Levant", bbox: [24.0, 30.0, 37.5, 37.5] }
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
      rx: width * 0.045,
      ry: height * 0.02,
      confidence: "demo"
    },
    {
      id: "demo-oil-spill-002",
      cx: minLon + width * 0.64,
      cy: minLat + height * 0.42,
      rx: width * 0.035,
      ry: height * 0.016,
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
