const { execSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

console.log("Building Expo web export...");
// For the web build, we intentionally leave EXPO_PUBLIC_DOMAIN empty so
// AuthContext/ListingsContext fall back to the relative "/api" base URL.
// The Expo web app is served from the same domain as the API server, so
// relative URLs work correctly on every deployment domain (trampaj.hr, staging, etc.)
execSync(
  `pnpm exec expo export --platform web --output-dir dist/web`,
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_DOMAIN: "",
    },
  }
);
console.log("Web build complete.");
