// XSS armazenado: o texto das avaliações vem de qualquer estudante e aparece no painel público,
// no dashboard e na moderação. Aqui provamos as duas metades que dá para provar sem navegador:
//  1. a API devolve o texto exatamente como foi enviado, como JSON (nunca como HTML);
//  2. o front-end não tem nenhum ponto onde texto vira HTML (o navegador real exibe como texto;
//     isso é conferido no teste ponta a ponta com o navegador, issue #17).

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { criarBancoDeTeste, iniciar, logarGestor } = require("./ajuda");

const CARGAS = [
  "<img src=x onerror=window.__xss=1>",
  "<script>window.__xss=1</script>",
  "\"><svg onload=window.__xss=1>",
  "javascript:alert(1)",
  "<iframe srcdoc=\"<script>parent.__xss=1</script>\"></iframe>",
  "</p><button data-id=\"1\">Ocultar</button>"
];

describe("XSS armazenado", () => {
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

  test("a API devolve cada carga idêntica, como JSON, em todas as rotas que a exibem", async () => {
    for (const carga of CARGAS) {
      assert.equal((await api.post("/api/avaliacoes", { servico_id: 1, nota: 5, comentario: carga })).status, 201);
    }
    const cookie = await logarGestor(api);

    for (const [rota, headers] of [["/api/comentarios", {}], ["/api/admin/avaliacoes", cookie]]) {
      const resposta = await fetch(api.base + rota, { headers });
      assert.match(resposta.headers.get("content-type"), /^application\/json/, rota);
      assert.equal(resposta.headers.get("x-content-type-options"), "nosniff", rota);
      const textos = (await resposta.json()).map((a) => a.comentario);
      for (const carga of CARGAS) assert.ok(textos.includes(carga), `${rota} deve devolver: ${carga}`);
    }
  });

  test("o nome do serviço e os números exibidos vêm do banco, não do que o estudante envia", async () => {
    const { rows } = await db.query("SELECT nome FROM servicos ORDER BY id");
    for (const { nome } of rows) assert.doesNotMatch(nome, /[<>"'&]/);
    const resposta = await api.post("/api/avaliacoes", { servico_id: "<img src=x onerror=1>", nota: "5<script>", comentario: "ok" });
    assert.equal(resposta.status, 400);
  });
});

describe("front-end sem ponto de injeção de HTML", () => {
  const RAIZ = path.join(__dirname, "..", "js");
  const arquivos = fs.readdirSync(RAIZ).filter((f) => f.endsWith(".js"));

  test("nenhum script do front usa innerHTML, outerHTML, insertAdjacentHTML, document.write nem escapeHTML", () => {
    for (const arquivo of arquivos) {
      const texto = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
      assert.doesNotMatch(texto, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|escapeHTML/, arquivo);
    }
  });

  test("o helper de DOM recusa atributos que executam código ou carregam recurso", () => {
    const texto = fs.readFileSync(path.join(RAIZ, "dom.js"), "utf8");
    const regra = new RegExp(texto.match(/const ATRIBUTOS_PROIBIDOS = \/(.+)\/i;/)[1], "i");
    for (const nome of ["onclick", "onerror", "onload", "style", "href", "src", "srcdoc", "action", "formaction", "xlink:href"]) {
      assert.match(nome, regra, `${nome} deve ser proibido`);
    }
    for (const nome of ["class", "role", "aria-label", "data-id", "type", "scope", "max", "value", "id"]) {
      assert.doesNotMatch(nome, regra, `${nome} deve ser permitido`);
    }
  });

  test("dom.js é carregado antes dos scripts que o usam, em todas as páginas", () => {
    const raiz = path.join(__dirname, "..");
    for (const [pagina, script] of [["index.html", "script.js"], ["dashboard.html", "dashboard.js"], ["admin.html", "admin.js"]]) {
      const html = fs.readFileSync(path.join(raiz, pagina), "utf8");
      const ordem = [...html.matchAll(/<script src="js\/([^"]+)"/g)].map((m) => m[1]);
      assert.ok(ordem.includes("dom.js"), `${pagina} precisa carregar dom.js`);
      assert.ok(ordem.indexOf("dom.js") < ordem.indexOf(script), `${pagina}: dom.js antes de ${script}`);
    }
    assert.match(fs.readFileSync(path.join(raiz, "sw.js"), "utf8"), /"\.\/js\/dom\.js"/, "sw.js deve guardar dom.js");
  });
});
