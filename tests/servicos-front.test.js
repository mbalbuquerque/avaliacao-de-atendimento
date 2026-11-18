// Os serviços moram no banco: o front não pode ter nome nem id de serviço escrito à mão.
// Os nomes vêm de banco/schema.sql (a fonte única), então este teste não repete lista nenhuma.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const PAGINAS = ["index.html", "dashboard.html", "admin.html", "admin-login.html", "offline.html"];
const lerArquivo = (...partes) => fs.readFileSync(path.join(RAIZ, ...partes), "utf8");

// Nomes dos serviços iniciais, lidos do schema.sql.
function nomesDosServicos() {
  const schema = lerArquivo("banco", "schema.sql");
  const bloco = schema.match(/INSERT INTO servicos \(nome\) VALUES([\s\S]*?)ON CONFLICT/);
  assert.ok(bloco, "o schema.sql deve carregar os serviços iniciais");
  const nomes = [...bloco[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(nomes.length >= 4, "esperava os serviços iniciais no schema.sql");
  return nomes;
}

describe("front-end sem serviços escritos à mão", () => {
  test("nenhum nome de serviço do banco aparece no HTML, no JavaScript nem no service worker", () => {
    const arquivos = [
      ...PAGINAS,
      "sw.js",
      ...fs.readdirSync(path.join(RAIZ, "js")).map((nome) => path.join("js", nome))
    ];
    for (const arquivo of arquivos) {
      const texto = lerArquivo(arquivo);
      for (const nome of nomesDosServicos()) {
        assert.ok(!texto.includes(nome), `${arquivo} não pode ter o serviço "${nome}" escrito: ele vem de /api/servicos`);
      }
    }
  });

  test("nenhum <option> com id de serviço escrito no HTML", () => {
    for (const arquivo of PAGINAS) {
      assert.doesNotMatch(lerArquivo(arquivo), /<option\s+value="\d+"/i, `${arquivo}: <option> com id escrito à mão`);
    }
  });

  test("os selects de serviço só têm a opção neutra no HTML", () => {
    for (const arquivo of ["index.html", "dashboard.html", "admin.html"]) {
      const select = lerArquivo(arquivo).match(/<select\s+id="(service|serviceFilter)"[^>]*>([\s\S]*?)<\/select>/i);
      assert.ok(select, `${arquivo}: select de serviço não encontrado`);
      assert.equal((select[2].match(/<option/gi) || []).length, 1, `${arquivo}: o select deve ter só a opção neutra`);
    }
  });

  test("js/servicos.js carrega depois de api.js e dom.js e antes do script da tela", () => {
    const telas = { "index.html": "js/script.js", "dashboard.html": "js/dashboard.js", "admin.html": "js/admin.js" };
    for (const [pagina, tela] of Object.entries(telas)) {
      const scripts = [...lerArquivo(pagina).matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
      const pos = (nome) => scripts.indexOf(nome);
      assert.ok(pos("js/servicos.js") > pos("js/api.js") && pos("js/api.js") >= 0, `${pagina}: servicos.js depois de api.js`);
      assert.ok(pos("js/servicos.js") > pos("js/dom.js") && pos("js/dom.js") >= 0, `${pagina}: servicos.js depois de dom.js`);
      assert.ok(pos("js/servicos.js") < pos(tela), `${pagina}: servicos.js antes de ${tela}`);
    }
  });

  test("o service worker guarda js/servicos.js no shell", () => {
    assert.match(lerArquivo("sw.js"), /"\.\/js\/servicos\.js"/);
  });

  test("o helper monta as opções com el() e nunca com innerHTML", () => {
    const helper = lerArquivo("js", "servicos.js");
    assert.match(helper, /el\("option"/);
    assert.doesNotMatch(helper, /innerHTML|outerHTML|insertAdjacentHTML/);
  });
});
