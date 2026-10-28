import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**'
    ]
  },
  {
    files: ['assets/js/**/*.js', 'tests/**/*.js', 'scripts/**/*.mjs', '*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
        cluster: 'readonly',
        REPLICATION_FACTOR: 'readonly',
        uploadFile: 'readonly',
        uploadLargeFile: 'readonly',
        resetCluster: 'readonly',
        renderCluster: 'readonly',
        runMapReduce: 'readonly',
        simulateFailure: 'readonly',
        simulateNodeFailure: 'readonly',
        submitJob: 'readonly',
        submitBigJob: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'valid-typeof': 'error'
    }
  }
];
