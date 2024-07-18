module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transformIgnorePatterns: ['node_modules/(?!lodash-es)'],
  transform: {
    '^.+\\.(js|mjs)$': [
      'babel-jest',
      {
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
  },
};
