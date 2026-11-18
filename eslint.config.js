// Regras de lint: as recomendadas do ESLint, em três ambientes (servidor, testes e navegador).
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/**", "evidencias/**", "coverage/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "server.js", "scripts/**/*.js", "tests/**/*.js", "eslint.config.js"],
    languageOptions: { sourceType: "commonjs", globals: globals.node }
  },
  {
    // Os testes e2e também escrevem funções que rodam dentro do navegador (page.evaluate).
    files: ["tests/e2e/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node, ...globals.browser } }
  },
  {
    files: ["js/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser, AvalieAPI: "readonly", APP_CONFIG: "readonly", Chart: "readonly" }
    }
  },
  {
    // api.js é quem declara AvalieAPI; as outras páginas só usam.
    files: ["js/api.js"],
    languageOptions: { globals: { AvalieAPI: "off" } }
  },
  {
    files: ["sw.js"],
    languageOptions: { sourceType: "script", globals: globals.serviceworker }
  }
];
