# OceanGuard

OceanGuard is a hackathon MVP shell for building ocean-risk visualizations on a daytime 3D globe.

## Stack

- React + Vite
- Tailwind CSS
- ArcGIS Maps SDK for JavaScript
- Node.js + Express

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The frontend runs at `http://localhost:5173`.
The Express API runs at `http://localhost:4000`.

For the optional MarineTraffic ship layer, install the Flask dependencies, add
`MARINETRAFFIC_API_KEY` to `.env`, then run the ship API in a second terminal:

```bash
python3 -m pip install -r requirements.txt
npm run dev:ships
```

The MarineTraffic Flask API runs at `http://localhost:5000`, and Vite proxies
`/api/ships` to it during local development.

In GitHub Codespaces or github.dev forwarded ports, open the URL ending in `-5173.app.github.dev` for the dashboard. A URL ending in `-4000.app.github.dev` is only the backend API.
