// Flat ESLint config (ESLint v9+).
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  ...(Array.isArray(expoConfig) ? expoConfig : [expoConfig]),
  eslintConfigPrettier,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'expo-env.d.ts'],
  },
];
