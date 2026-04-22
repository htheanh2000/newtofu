#!/usr/bin/env node
/**
 * Check Device whitelist and Composition in Neon DB (uses Prisma, no psql).
 * Usage: node scripts/neon-check-device-and-composition.mjs [deviceId] [compositionId]
 * From repo root: cd margiela-fe && node scripts/neon-check-device-and-composition.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const deviceId = process.argv[2] || "e404d10b-c553-420e-9a6b-431ba5b74c11";
const compositionId = process.argv[3] || "1773127527971-ecmc22s96";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL not set. Set in .env or use: neon connection-string --pooled --prisma");
    process.exit(1);
  }

  console.log("=== Device whitelist (deviceId =", deviceId, ") ===");
  const device = await prisma.device.findUnique({
    where: { deviceId },
    select: { deviceId: true, name: true, registeredAt: true },
  });
  if (device) {
    console.log(JSON.stringify(device, null, 2));
  } else {
    console.log("(not found – device chưa được đăng ký trong whitelist)");
  }

  console.log("\n=== Composition (id =", compositionId, ") ===");
  const comp = await prisma.composition.findUnique({
    where: { id: compositionId },
    select: { id: true, instrument: true, pdfUrl: true, createdAt: true },
  });
  if (comp) {
    console.log(JSON.stringify({ ...comp, hasPdf: !!comp.pdfUrl }, null, 2));
  } else {
    console.log("(not found – composition chưa được lưu)");
  }

  console.log("\n=== Last 5 devices ===");
  const devices = await prisma.device.findMany({
    orderBy: { registeredAt: "desc" },
    take: 5,
    select: { deviceId: true, name: true, registeredAt: true },
  });
  console.log(JSON.stringify(devices, null, 2));

  console.log("\n=== Last 3 compositions with PDF ===");
  const withPdf = await prisma.composition.findMany({
    where: { pdfUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, pdfUrl: true },
  });
  console.log(JSON.stringify(withPdf, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
