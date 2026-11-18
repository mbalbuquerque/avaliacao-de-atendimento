/*
 * Avalie o Atendimento
 * Configuração de modo
 *
 * - "api" (padrão): o front-end fala com o servidor da mesma origem (/api),
 *   que grava no PostgreSQL. É o modo do ambiente integrado e da Azure.
 * - "demo": os dados ficam só no navegador (localStorage). Só é ativado de
 *   forma explícita: abrindo o arquivo direto do disco (file://) ou com
 *   ?modo=demo na URL (volta ao normal com ?modo=api).
 *
 * O modo demo NUNCA liga sozinho quando a API falha: dados locais apresentados
 * como se fossem do servidor enganariam o usuário. Se a API não responder, as
 * telas mostram o erro e oferecem o link da demonstração.
 */
(function () {
  const CHAVE = "avalie-modo";
  let escolhido = null;

  try {
    const pedido = new URLSearchParams(window.location.search).get("modo");
    if (pedido === "demo" || pedido === "api") {
      sessionStorage.setItem(CHAVE, pedido);
    }
    escolhido = sessionStorage.getItem(CHAVE);
  } catch {
    // sessionStorage bloqueado: segue o padrão.
  }

  const semServidor = window.location.protocol === "file:";

  window.APP_CONFIG = Object.freeze({
    mode: semServidor || escolhido === "demo" ? "demo" : "api",
    apiBaseUrl: "/api",
    requestTimeout: 10000
  });
})();
