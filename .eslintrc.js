module.exports = {
  extends: ['airbnb-typescript', 'prettier'],
  ignorePatterns: ['node_modules/', '.webpack/', '_warmup/', '.vscode/'],
  parser: '@typescript-eslint/parser',
  plugins: ['eslint-plugin-import'],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    'arrow-body-style': 'off',
    'import/order': [
      'error',
      {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object'],
        'newlines-between': 'always',
      },
    ],
    'no-restricted-imports': ['error', { paths: ['src'], patterns: ['../*'] }],
    'no-restricted-modules': ['error', { paths: ['src'], patterns: ['../*'] }],
    'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
    'import/prefer-default-export': 'off',
  },
  settings: {
    'import/resolver': {
      node: {
        paths: ['src'],
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
};
