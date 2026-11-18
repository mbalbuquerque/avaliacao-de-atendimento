// Log de requisições: registra o que ajuda a operar o serviço e nada que identifique o estudante.

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { criarBancoDeTeste, iniciar, logarGestor } = require("./ajuda");

describe("log de requisições", () => {
  let db;
  let api;
  let linhas;

  beforeEach(async () => {
    db = await criarBancoDeTeste();
    linhas = [];
    api = await iniciar(db, { log: (linha) => linhas.push(linha) });
  });

  afterEach(async () => {
    await api.parar();
    await db.fechar();
  });

  test("cada requisição gera uma linha JSON com método, rota, status e tempo", async () => {
    await api.get("/api/servicos");
    assert.equal(linhas.length, 1);
    const registro = JSON.parse(linhas[0]);
    assert.deepEqual(Object.keys(registro).sort(), ["metodo", "ms", "nivel", "rota", "status"]);
    assert.equal(registro.metodo, "GET");
    assert.equal(registro.rota, "/api/servicos");
    assert.equal(registro.status, 200);
    assert.ok(Number.isInteger(registro.ms) && registro.ms >= 0);
  });

  test("erros também são registrados com o status", async () => {
    await api.post("/api/avaliacoes", { servico_id: 1, nota: 9 });
    assert.equal(JSON.parse(linhas[0]).status, 400);
  });

  test("a sonda /health não entra no log", async () => {
    await api.get("/health");
    assert.equal(linhas.length, 0);
  });

  test("comentário, cookie, query string e IP nunca aparecem no log", async () => {
    await api.post("/api/avaliacoes", { servico_id: 1, nota: 5, comentario: "COMENTARIO-SECRETO-123" });
    const cookie = await logarGestor(api);
    await api.get("/api/admin/avaliacoes?busca=TERMO-SECRETO", cookie);
    await api.get("/api/comentarios?token=TOKEN-NA-URL");

    const tudo = linhas.join("\n");
    for (const proibido of ["COMENTARIO-SECRETO-123", "TERMO-SECRETO", "TOKEN-NA-URL", cookie.Cookie.split("=")[1], "127.0.0.1", "sessao"]) {
      assert.ok(!tudo.includes(proibido), `o log não pode conter ${proibido}`);
    }
  });

  test("rotas com parâmetro aparecem pelo padrão, não pelo valor", async () => {
    const cookie = await logarGestor(api);
    await api.patch("/api/admin/avaliacoes/12345", { oculta: true }, cookie);
    const registro = linhas.map((l) => JSON.parse(l)).find((r) => r.metodo === "PATCH");
    assert.equal(registro.rota, "/api/admin/avaliacoes/:id");
  });

  test("caminho com quebra de linha não forja linhas no log", async () => {
    await fetch(`${api.base}/pagina%0A%7B%22nivel%22:%22erro%22%7D`);
    for (const linha of linhas) assert.doesNotThrow(() => JSON.parse(linha));
    assert.equal(linhas.length, 1);
  });
});
