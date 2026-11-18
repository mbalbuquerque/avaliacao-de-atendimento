// Playwright: testes ponta a ponta do painel em navegador real (Chromium).
// Rodar: npm run test:e2e   (E2E_CANAL=chrome usa o Chrome instalado, só para uso local)

const path = require("path");
const { defineConfig } = require("@playwright/test");
const { AMBIENTE } = require("./ambiente");

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: "**/*.spec.js",
  // Um único banco compartilhado: os testes rodam em série e cada um começa com o banco recriado.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30000,
  expect: { timeout: 8000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: path.join(__dirname, "..", "..", "playwright-report") }]]
    : [["list"]],
  outputDir: path.join(__dirname, "..", "..", "test-results"),
  use: {
    baseURL: AMBIENTE.base,
    locale: "pt-BR",
    channel: process.env.E2E_CANAL || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "node tests/e2e/servidor.js",
    cwd: path.join(__dirname, "..", ".."),
    url: `${AMBIENTE.base}/health`,
    reuseExistingServer: false,
    timeout: 60000,
    stdout: "pipe",
    stderr: "pipe"
  }
});
