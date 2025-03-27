// frontend/eslint.config.js
import base from '../eslint.config.js'
import reactDom from 'eslint-plugin-react-dom'
import reactx from 'eslint-plugin-react-x'

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
      ...base[1].plugins,
      'react-dom': reactDom,
      'react-x': reactx,
    },
    extends: [
      ...base[1].extends,
      reactDom.configs.recommended,
      reactx.configs.recommended,
    ],
  },
]
