module.exports = {
  collectCoverageFrom: ['src/**/*.js'],
  coverageReporters: ['lcov', 'text'],
  coveragePathIgnorePatterns: ['.fixture.', '/fixtures/'],
  moduleFileExtensions: ['js', 'ts', 'json'],
  moduleDirectories: ['node_modules'],
  testResultsProcessor: 'jest-sonar-reporter',
  testMatch: [
    '<rootDir>/test/unit/**/*.test.js'
  ],
  testTimeout: 20000,
};
