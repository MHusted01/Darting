/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/?(*.)+(test).[tj]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/dist/'],
};
