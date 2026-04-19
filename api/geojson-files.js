export default function handler(req, res) {
  // Hardcoded list for Vercel deployment since serverless functions 
  // cannot easily scan the public directory at runtime.
  const geojsonFiles = [
    {
      url: "/data/whales.geojson",
      title: "Whale Migration Paths"
    },
    {
      url: "/data/AustralianHumpBack.geojson",
      title: "Australian HumpBack"
    },
    {
      url: "/data/shipping_lanes.geojson",
      title: "Global Shipping Lanes"
    },
    {
      url: "/data/garbage_patches.geojson",
      title: "Great Garbage Patches"
    }
  ];

  res.status(200).json({ files: geojsonFiles });
}
