import type { Config } from 'jest';

// Usamos require en lugar de import para que Node.js no lance la advertencia de ES Modules
const { createDefaultPreset } = require('ts-jest');

const tsJestTransformCfg = createDefaultPreset().transform;

const config: Config = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
};

module.exports = config;