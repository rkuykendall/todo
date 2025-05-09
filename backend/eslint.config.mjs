import base from '@todo/shared/eslint.config.mjs';

export default [
  ...base,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Add overrides for test files
  {
    files: ['**/__tests__/**', 'test-*.js'],
    rules: {
      'no-undef': 'off', // Allow undefined globals like console in test files
      'no-console': 'off', // Allow console.log in test files
    },
    languageOptions: {
      globals: {
        // Add Jest globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        test: 'readonly',
        jest: 'readonly',
        console: 'readonly',
      },
    },
  },
];
