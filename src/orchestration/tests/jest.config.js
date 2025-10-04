module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    '../src/**/*.ts',
    '!../src/main.ts',
    '!../src/types.ts',
    '!**/*.d.ts'
  ],
  coverageDirectory: './coverage',
  verbose: true,
  testTimeout: 30000
};
