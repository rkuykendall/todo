import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import stylisticJsx from '@stylistic/eslint-plugin-jsx';

/** @type {import("eslint").Linter.Config[]} */
const baseConfig = [
  {
    ignores: ['**/dist', '**/node_modules', '**/.vite/deps/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        // Not sure why globals.node is not working here
        // eslint-disable-next-line no-undef
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      '@typescript-eslint': tseslint.plugin,
      '@stylistic/jsx': stylisticJsx,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      ...stylisticJsx.configs.all.rules,
      '@stylistic/jsx/jsx-one-expression-per-line': 'off',
      '@stylistic/jsx/jsx-newline': 'off',
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
];

export default baseConfig;
