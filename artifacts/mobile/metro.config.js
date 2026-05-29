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

module.exports = config;
