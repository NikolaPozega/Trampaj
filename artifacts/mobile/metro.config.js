const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.projectRoot = projectRoot;

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

const existingGetModules =
  config.serializer && config.serializer.getModulesRunBeforeMainModule
    ? config.serializer.getModulesRunBeforeMainModule
    : () => [require.resolve("react-native/Libraries/Core/InitializeCore")];

config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule: (entryFilePath) => {
    const existing = existingGetModules(entryFilePath);
    return [
      require.resolve("./src/polyfills/domException.js"),
      ...existing,
    ];
  },
};

module.exports = config;
