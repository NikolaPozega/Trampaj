const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Prati i workspace root (zbog dijeljenih node_modules u pnpm virtual store)
config.watchFolders = [workspaceRoot];

// Traži module prvo u projektu, pa u workspace root-u
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Eksplicitno postavi projectRoot da Metro ne koristi process.cwd()
config.projectRoot = projectRoot;

// Custom middleware: rewritea /mobile -> / jer Replit shared proxy
// prosljeđuje puni path na Metro bez strippanja /mobile prefiksa.
// Metro manifest/manifest je dostupan samo na /, a Expo Go šalje zahtjev
// na /mobile (via shared proxy). Uvijek rewriteaj /mobile u /.
config.server = {
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      const url = req.url || "";
      if (url === "/mobile" || url === "/mobile/" || url.startsWith("/mobile?") || url.startsWith("/mobile/__")) {
        req.url = url.replace(/^\/mobile/, "") || "/";
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
