// Cabeçalhos de segurança, CSP e compatibilidade do front-end com ela, e limite geral de requisições.

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { criarBancoDeTeste, iniciar } = require("./ajuda");

const RAIZ = path.join(__dirname, "..");
const PAGINAS = ["index.html", "dashboard.html", "admin.html", "admin-login.html", "offline.html"];

function lerCsp(resposta) {
  const csp = resposta.headers.get("content-security-policy");
  assert.ok(csp, "falta o Content-Security-Policy");
  return Object.fromEntries(csp.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
    const [nome, ...valores] = d.split(/\s+/);
    return [nome, valores];
  }));
}

describe("cabeçalhos de segurança", () => {
  let db;
  let api;

  beforeEach(async () => {
    db = await criarBancoDeTeste();
    api = await iniciar(db);
  });

  afterEach(async () => {
    await api.parar();
    await db.fechar();
  });

  test("a CSP só aceita o próprio servidor: sem inline, sem eval, sem frame, sem CDN", async () => {
    const csp = lerCsp(await fetch(`${api.base}/`));
    assert.deepEqual(csp["default-src"], ["'none'"]);
    assert.deepEqual(csp["script-src"], ["'self'"]);
    assert.deepEqual(csp["style-src"], ["'self'"]);
    assert.deepEqual(csp["connect-src"], ["'self'"]);
    assert.deepEqual(csp["form-action"], ["'self'"]);
    assert.deepEqual(csp["frame-ancestors"], ["'none'"]);
    assert.deepEqual(csp["base-uri"], ["'none'"]);
    assert.deepEqual(csp["object-src"], ["'none'"]);
    const tudo = Object.values(csp).flat().join(" ");
    for (const proibido of ["'unsafe-inline'", "'unsafe-eval'", "http:", "https:", "*"]) {
      assert.ok(!tudo.includes(proibido), `a CSP não pode conter ${proibido}`);
    }
  });

  test("páginas, API e 404 trazem HSTS, anti-clickjacking, COOP/CORP/COEP e Permissions-Policy", async () => {
    for (const rota of ["/", "/dashboard.html", "/api/servicos", "/health", "/nao-existe", "/api/nao-existe"]) {
      const r = await fetch(api.base + rota);
      const hsts = r.headers.get("strict-transport-security");
      assert.match(hsts, /max-age=31536000/, rota);
      assert.match(hsts, /includeSubDomains/, rota);
      assert.equal(r.headers.get("x-frame-options"), "DENY", rota);
      assert.equal(r.headers.get("x-content-type-options"), "nosniff", rota);
      assert.equal(r.headers.get("referrer-policy"), "no-referrer", rota);
      assert.equal(r.headers.get("cross-origin-opener-policy"), "same-origin", rota);
      assert.equal(r.headers.get("cross-origin-resource-policy"), "same-origin", rota);
      assert.equal(r.headers.get("cross-origin-embedder-policy"), "require-corp", rota);
      assert.match(r.headers.get("permissions-policy"), /camera=\(\)/, rota);
      assert.equal(r.headers.get("x-powered-by"), null, rota);
    }
  });

  test("cache: páginas são revalidadas, a API nunca é guardada", async () => {
    for (const rota of ["/", "/index.html", "/manifest.webmanifest", "/sw.js"]) {
      assert.equal((await fetch(api.base + rota)).headers.get("cache-control"), "no-cache", rota);
    }
    for (const rota of ["/api/servicos", "/api/indicadores", "/health"]) {
      assert.equal((await fetch(api.base + rota)).headers.get("cache-control"), "no-store", rota);
    }
  });

  test("Chart.js sai do próprio servidor; nenhum outro arquivo de /vendor ou node_modules", async () => {
    const chart = await fetch(`${api.base}/vendor/chart.umd.js`);
    assert.equal(chart.status, 200);
    assert.match(chart.headers.get("content-type"), /javascript/);
    assert.ok((await chart.text()).length > 10000);
    for (const rota of ["/vendor/outro.js", "/vendor/", "/vendor/../package.json", "/vendor/%2e%2e/package.json",
      "/node_modules/chart.js/package.json", "/vendor/chart.umd.js.map"]) {
      assert.ok([403, 404].includes((await fetch(api.base + rota)).status), rota);
    }
  });
});

describe("limite geral de requisições", () => {
  test("acima do limite por minuto responde 429; a sonda /health nunca é limitada", async () => {
    const db = await criarBancoDeTeste();
    const api = await iniciar(db, { limiteGeralPorMinuto: 5 });
    try {
      for (let i = 0; i < 5; i++) assert.equal((await api.get("/api/servicos")).status, 200);
      const bloqueada = await api.get("/api/servicos");
      assert.equal(bloqueada.status, 429);
      assert.ok(bloqueada.json.message);
      assert.ok(bloqueada.cabecalhos.get("ratelimit") || bloqueada.cabecalhos.get("ratelimit-policy"));
      for (let i = 0; i < 20; i++) assert.equal((await api.get("/health")).status, 200);
    } finally {
      await api.parar();
      await db.fechar();
    }
  });
});

// O front-end precisa funcionar sob a CSP acima: estes testes leem os arquivos de verdade.
describe("front-end compatível com a CSP", () => {
  const html = (arquivo) => fs.readFileSync(path.join(RAIZ, arquivo), "utf8");

  test("nenhuma página tem script inline, manipulador on*, estilo inline ou <style>", () => {
    for (const arquivo of PAGINAS) {
      const texto = html(arquivo);
      assert.doesNotMatch(texto, /<script(?![^>]*\bsrc=)[^>]*>/i, `${arquivo}: script inline`);
      assert.doesNotMatch(texto, /\son[a-z]+\s*=/i, `${arquivo}: manipulador de evento inline`);
      assert.doesNotMatch(texto, /\sstyle\s*=/i, `${arquivo}: atributo style`);
      assert.doesNotMatch(texto, /<style[\s>]/i, `${arquivo}: bloco <style>`);
      assert.doesNotMatch(texto, /javascript:/i, `${arquivo}: URL javascript:`);
    }
  });

  test("nenhuma página carrega recurso de outro endereço (CDN, fonte externa)", () => {
    for (const arquivo of PAGINAS) {
      const texto = html(arquivo);
      assert.doesNotMatch(texto, /(src|href)\s*=\s*["']\s*(https?:)?\/\//i, `${arquivo}: recurso externo`);
    }
  });

  test("todo formulário tem method post e action: sem JavaScript nada vai para a URL", () => {
    for (const arquivo of PAGINAS) {
      for (const [forma] of html(arquivo).matchAll(/<form\b[^>]*>/gi)) {
        assert.match(forma, /method\s*=\s*["']post["']/i, `${arquivo}: ${forma}`);
        assert.match(forma, /action\s*=\s*["'][^"']+["']/i, `${arquivo}: ${forma}`);
      }
    }
  });

  test("o JavaScript do front não usa eval, new Function nem escreve HTML da API com innerHTML", () => {
    for (const arquivo of fs.readdirSync(path.join(RAIZ, "js"))) {
      const texto = fs.readFileSync(path.join(RAIZ, "js", arquivo), "utf8");
      assert.doesNotMatch(texto, /\beval\s*\(/, `${arquivo}: eval`);
      assert.doesNotMatch(texto, /new\s+Function\s*\(/, `${arquivo}: new Function`);
      assert.doesNotMatch(texto, /\.(innerHTML|outerHTML)\s*[+]?=/, `${arquivo}: innerHTML/outerHTML`);
      assert.doesNotMatch(texto, /document\.write\s*\(/, `${arquivo}: document.write`);
    }
  });
});
