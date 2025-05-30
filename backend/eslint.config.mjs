import base from '@todo/shared/eslint.config.mjs';
import js from '@eslint/js';
import globals from 'globals';

export default [
  // Include the recommended ESLint rules
  js.configs.recommended,

  // Include base config from shared
  ...base,

  // TypeScript-specific configuration for all TS files
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Configuration for TypeScript test files
  {
    files: ['**/__tests__/**/*.ts'],
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off', // Often needed in test files for mocking
    },
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.jest,
        ...globals.node,
        console: 'readonly',
      },
    },
  },

  // Configuration for JS configuration files (which are the only JS files in the project)
  {
    files: ['*.config.js', '.*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
