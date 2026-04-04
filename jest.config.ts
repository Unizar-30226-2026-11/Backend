import type { Config } from 'jest';

// Usamos require en lugar de import para que Node.js no lance la advertencia de ES Modules
const { createDefaultPreset } = require('ts-jest');

const tsJestTransformCfg = createDefaultPreset().transform;

const config: Config = {

  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },

  roots: ['<rootDir>/src'],
  testMatch: [
    "**/__tests__/**/*.+(ts|tsx|js)",     // Busca en cualquier carpeta __tests__
    "**/?(*.)+(spec|test).+(ts|tsx|js)"   // Y cualquier archivo que termine en .test.ts o .spec.ts
  ],
};

module.exports = config;