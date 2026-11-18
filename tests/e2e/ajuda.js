// Apoio dos testes e2e: banco de apoio, login do gestor e uma página que reprova o teste
// quando aparece erro de JavaScript, erro no console ou violação da CSP.

const base = require("@playwright/test");
const { AMBIENTE } = require("./ambiente");

const { expect } = base;

// ------------------------------------------------------------------ banco de apoio

async function chamarControle(metodo, rota, corpo) {
  const resposta = await fetch(AMBIENTE.controle + rota, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo)
  });
  if (!resposta.ok) throw new Error(`controle ${metodo} ${rota} -> ${resposta.status}`);
  return resposta.json();
}

const banco = {
  // Recria as tabelas e os quatro serviços (banco/schema.sql): cada teste começa do zero.
  reiniciar: () => chamarControle("POST", "/reiniciar"),
  semear: (lista) => chamarControle("POST", "/semear", lista),
  avaliacoes: () => chamarControle("GET", "/avaliacoes"),
  total: async () => (await chamarControle("GET", "/avaliacoes")).length
};

// ------------------------------------------------------------------ página instrumentada

const test = base.test.extend({
  page: async ({ page }, use) => {
    const problemas = [];
    const ignorados = [];

    // Padrões de mensagem esperados num teste específico (ex.: 401 de uma senha errada).
    page.ignorarErros = (...padroes) => ignorados.push(...padroes);

    page.on("console", (mensagem) => {
      if (mensagem.type() === "error") problemas.push(`console: ${mensagem.text()}`);
    });
    page.on("pageerror", (erro) => problemas.push(`erro de JavaScript: ${erro.message}`));

    // Violação da CSP real do servidor (o teste NÃO injeta CSP nenhuma).
    await page.exposeFunction("registrarViolacaoCsp", (texto) => problemas.push(`violação da CSP: ${texto}`));
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (evento) => {
        window.registrarViolacaoCsp(`${evento.violatedDirective} bloqueou ${evento.blockedURI || "inline"}`);
      });
    });

    await use(page);

    const reais = problemas.filter((texto) => !ignorados.some((padrao) => padrao.test(texto)));
    expect(reais, "erros de JavaScript, de console ou da CSP durante o teste").toEqual([]);
  }
});

// ------------------------------------------------------------------ gestor

// Login pela API no mesmo contexto do navegador: o cookie de sessão fica no navegador, como no uso real.
async function entrarComoGestor(page) {
  const resposta = await page.context().request.post(`${AMBIENTE.base}/api/admin/login`, {
    data: { usuario: AMBIENTE.usuario, senha: AMBIENTE.senha }
  });
  expect(resposta.status(), "login do gestor de teste").toBe(200);
}

// ------------------------------------------------------------------ formulário público

// Escolhe a nota pelo teclado: foca a primeira estrela e avança com a seta para a direita.
async function escolherNotaPorTeclado(page, nota) {
  const primeira = page.locator("#nota-1");
  await primeira.focus();
  for (let passo = 1; passo < nota; passo++) await page.keyboard.press("ArrowRight");
  if (nota === 1) await page.keyboard.press("Space");
  await expect(page.locator(`#nota-${nota}`)).toBeChecked();
}

module.exports = { test, expect, banco, entrarComoGestor, escolherNotaPorTeclado, AMBIENTE };
