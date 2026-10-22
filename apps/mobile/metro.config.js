const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Monorepo root and project root
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (e.g. packages/shared)
config.watchFolders = [monorepoRoot];

// 2. Let Metro resolve packages from both project and monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
