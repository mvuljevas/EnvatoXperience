module.exports = {
  testDir: __dirname,
  testMatch: /extension-regression\.spec\.cjs$/,
  workers: 1,
  timeout: 10000,
  globalTimeout: 45000,
  reporter: 'line',
  outputDir: '../test-results/regression',
};
