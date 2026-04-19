export default function handler(req, res) {
  // Hardcoded list for Vercel deployment since serverless functions 
  // cannot easily scan the public directory at runtime.
  const geojsonFiles = [
    {
      url: "/data/garbage_patches.geojson",
      title: "Great Garbage Patches"
    }
  ];

  res.status(200).json({ files: geojsonFiles });
}
