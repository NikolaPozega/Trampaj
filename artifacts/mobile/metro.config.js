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

const existingGetPolyfills =
  config.serializer && config.serializer.getPolyfills
    ? config.serializer.getPolyfills
    : () => [];

config.serializer = {
  ...config.serializer,
  getPolyfills: (ctx) => [
    require.resolve("./src/polyfills/startupRuntime.js"),
    ...existingGetPolyfills(ctx),
  ],
};

// Paketi koji MORAJU proći kroz Babel (sadrže ES6+ sintaksu koju Hermes ne podržava)
// @react-navigation šalje class sintaksu koja pada na Hermes JIT-kompajleru
const PACKAGES_TO_TRANSFORM = [
  "react-native",
  "@react-native",
  "@react-navigation",
  "expo",
  "@expo",
  "expo-router",
  "@unimodules",
  "unimodules",
  "@sentry/react-native",
  "native-base",
  "react-native-reanimated",
  "react-native-screens",
  "react-native-gesture-handler",
  "react-native-safe-area-context",
  "react-native-svg",
].join("|");

config.transformer = {
  ...config.transformer,
  transformIgnorePatterns: [
    `/node_modules/(?!(${PACKAGES_TO_TRANSFORM})/)`,
  ],
};

module.exports = config;
