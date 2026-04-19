# OceanGuard

OceanGuard is a hackathon MVP for visualizing whale migration paths against major ocean trash accumulation zones on an interactive 3D globe.

The goal is simple: help conservation teams quickly see where whale routes may overlap with plastic pollution risk zones, then generate a lightweight risk summary for the selected migration path.

## What It Does

- Displays a cinematic ArcGIS globe with NASA chlorophyll satellite imagery.
- Shows approximate global garbage patch regions as GeoJSON overlays.
- Lets users import whale migration CSV files.
- Converts imported CSV points into segmented GeoJSON migration paths.
- Prevents unrealistic long-distance line jumps in whale tracks.
- Analyzes selected whale paths against ocean trash zones.
- Produces a score out of 10 and a short conservation-focused recommendation.

## Demo Flow

1. Open the app.
2. Launch the OceanGuard dashboard.
3. Click **Import Migration CSV**.
4. Upload `sample_migration.csv` or another whale tracking CSV.
5. Click a rendered whale migration line.
6. Review the trash exposure score and recommendation in the sidebar.

## CSV Format

The importer works best with Movebank-style column names:

- `individual-local-identifier`
- `timestamp`
- `location-lat`
- `location-long`

The app groups points by whale ID, sorts them by time, and breaks the route into separate line segments when consecutive points jump more than 300 km.

## Tech Stack

- React
- Vite
- Tailwind CSS
- ArcGIS Maps SDK for JavaScript
- Turf.js
- Papa Parse
- Node.js + Express

## Data Used

- Mock whale migration CSV data for upload demos.
- Approximate GeoJSON polygons for the 5 major ocean garbage patch regions.
- NASA GIBS chlorophyll imagery as a contextual ocean layer.

This MVP is structured so real whale telemetry and higher-resolution trash datasets can be added later.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The Vite frontend runs at:

```text
http://localhost:5173
```

The Express API runs at:

```text
http://localhost:4000
```

In GitHub Codespaces, open the forwarded URL ending in `-5173.app.github.dev` to view the app. The URL ending in `-4000.app.github.dev` is only the backend API.

## Project Structure

```text
src/
  components/
    LandingPage.jsx
    OceanGuardDashboard.jsx
  utils/
    ImpactAnalysis.js
public/
  data/
    garbage_patches.geojson
server/
  index.js
sample_migration.csv
```

## Hackathon Notes

OceanGuard focuses on a narrow, demo-ready conservation story: whale migration plus ocean trash exposure. The current data is intentionally lightweight and local so the project can run reliably during judging without external API keys.
