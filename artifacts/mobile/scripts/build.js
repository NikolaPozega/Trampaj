const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist", "web");

console.log("Building Expo web export...");

// Remove old dist/web to guarantee a clean build (avoids stale Metro cache
// in persistent production environments reusing the previous deployment dir).
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
  console.log("Cleared old dist/web");
}

// For the web build, we intentionally leave EXPO_PUBLIC_DOMAIN empty so
// AuthContext/ListingsContext fall back to the relative "/api" base URL.
// The Expo web app is served from the same domain as the API server, so
// relative URLs work correctly on every deployment domain (trampaj.hr, staging, etc.)
execSync(
  `pnpm exec expo export --platform web --output-dir dist/web --clear`,
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_DOMAIN: "",
      EXPO_PUBLIC_OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "",
    },
  }
);
console.log("Web build complete.");
