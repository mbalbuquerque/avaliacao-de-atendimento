/*
 * Avalie o Atendimento
 * Configuração do front-end.
 *
 * O navegador fala só com o servidor da mesma origem (/api), que valida tudo e
 * grava no PostgreSQL. Não existe dado guardado no navegador.
 */
window.APP_CONFIG = Object.freeze({
  apiBaseUrl: "/api",
  requestTimeout: 10000
});
