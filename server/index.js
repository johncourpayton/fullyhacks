import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { contaminationPockets, migrationPaths } from "./mockData.js";
import { fetchOilSpillGeoJson, parseBbox } from "./sentinelHub.js";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    service: "OceanGuard API",
    message: "This is the backend API. Open the Vite frontend on port 5173 to view the dashboard.",
    endpoints: ["/api/health", "/api/contamination", "/api/migration", "/api/oil-spills"]
  });
});

async function queryOrMock(queryFn, fallback) {
  try {
    return await queryFn();
  } catch (error) {
    console.warn("Database unavailable, serving mock data:", error.message);
    return fallback;
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "OceanGuard API" });
});

app.get("/api/contamination", async (_req, res, next) => {
  try {
    const data = await queryOrMock(
      () =>
        prisma.contaminationPocket.findMany({
          orderBy: [{ severity: "desc" }, { createdAt: "desc" }]
        }),
      contaminationPockets
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/migration", async (_req, res, next) => {
  try {
    const data = await queryOrMock(
      () =>
        prisma.migrationPath.findMany({
          orderBy: { timestamp: "desc" }
        }),
      migrationPaths
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/oil-spills", async (req, res, next) => {
  try {
    const bbox = parseBbox(req.query.bbox);
    const hoursBack = Number(req.query.hoursBack || 48);

    if (!Number.isFinite(hoursBack) || hoursBack <= 0 || hoursBack > 168) {
      res.status(400).json({ error: "hoursBack must be a number between 1 and 168" });
      return;
    }

    const geoJson = await fetchOilSpillGeoJson({ bbox, hoursBack });

    res.json(geoJson);
  } catch (error) {
    if (error.message.includes("bbox")) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (error.message.includes("Sentinel Hub OAuth credentials")) {
      res.status(503).json({ error: error.message });
      return;
    }

    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "production" ? undefined : error.message
  });
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`OceanGuard API listening on http://localhost:${port}`);
});
