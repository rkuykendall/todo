import base from '@todo/shared/eslint.config.mjs';
import reactDom from 'eslint-plugin-react-dom';
import reactx from 'eslint-plugin-react-x';

export default [
  ...base,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-dom': reactDom,
      'react-x': reactx,
    },
    rules: {
      ...reactDom.configs.recommended.rules,
      ...reactx.configs.recommended.rules,
    },
  },
];
