import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const isNgrok = baseURL.includes("ngrok");

export default defineConfig({
  testDir: "./",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
      ...(isNgrok && { "ngrok-skip-browser-warning": "1" }),
    },
  },
  projects: [
    { name: "api", testMatch: /api\/.*\.spec\.ts/ },
  ],
});
