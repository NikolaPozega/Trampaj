const { execSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function getDeploymentDomain() {
  const d =
    process.env.REPLIT_INTERNAL_APP_DOMAIN ||
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.EXPO_PUBLIC_DOMAIN;
  if (!d) {
    console.error("ERROR: No deployment domain found.");
    process.exit(1);
  }
  return d.replace(/^https?:\/\//, "");
}

const domain = getDeploymentDomain();

console.log("Building Expo web export...");
execSync(
  `pnpm exec expo export --platform web --output-dir dist/web`,
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_DOMAIN: domain,
    },
  }
);
console.log("Web build complete.");
