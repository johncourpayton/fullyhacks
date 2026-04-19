import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { contaminationPockets, migrationPaths } from "./mockData.js";

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
    endpoints: ["/api/health", "/api/contamination", "/api/migration"]
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
