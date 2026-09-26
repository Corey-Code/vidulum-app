module.exports = {
  testEnvironment: 'jsdom',
  transform: { '^.+\.(ts|tsx|js|jsx)$': 'babel-jest' },
  moduleNameMapper: {
    '\\.(css|less|png|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  testMatch: ['<rootDir>/src/**/*.test.(ts|tsx)'],
  collectCoverageFrom: ['src/**/*.(ts|tsx)', '!src/**/*.d.ts'],
};
