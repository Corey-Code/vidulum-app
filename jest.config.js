export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
        },
      },
    ],
    // Transform ES modules from @noble packages
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: [
    // Transform @noble packages which use ES modules
    'node_modules/(?!(@noble|@scure)/)',
  ],
};
