// Casos de aceite CA1 a CA5, persistência, health, moderação e segurança.
// Rodar: npm test
// Cada teste usa um banco novo em memória, com o schema.sql real do projeto.

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { criarBancoDeTeste, iniciar, logarGestor, ADMIN, SENHA_GESTOR } = require("./ajuda");

describe("API Avalie o Atendimento", () => {
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

  const avaliar = (servico_id, nota, comentario) =>
    api.post("/api/avaliacoes", comentario === undefined ? { servico_id, nota } : { servico_id, nota, comentario });

  // ---------------------------------------------------------------- RF01

  test("RF01: os quatro serviços vêm do script SQL inicial", async () => {
    const r = await api.get("/api/servicos");
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.map((s) => s.nome), ["Secretaria", "Biblioteca", "Cantina", "Laboratórios"]);
  });

  // ---------------------------------------------------------------- CA1 (negativo)

  test("CA1: nota 0, 6, 3.5, texto ou ausente retornam 400 e nada é gravado", async () => {
    for (const nota of [0, 6, 3.5, -1, "5", null, undefined]) {
      const r = await api.post("/api/avaliacoes", { servico_id: 1, nota });
      assert.equal(r.status, 400, `nota ${JSON.stringify(nota)} deveria ser recusada`);
    }
    const { rows } = await db.query("SELECT COUNT(*)::int AS total FROM avaliacoes");
    assert.equal(rows[0].total, 0);
  });

  test("CA1: notas de 1 a 5 são aceitas com HTTP 201", async () => {
    for (const nota of [1, 2, 3, 4, 5]) {
      const r = await avaliar(1, nota);
      assert.equal(r.status, 201);
      assert.ok(Number.isInteger(r.json.id));
    }
  });

  // ---------------------------------------------------------------- CA2 (negativo)

  test("CA2: comentário de 281 caracteres retorna 400; de 280 é aceito", async () => {
    assert.equal((await avaliar(1, 5, "a".repeat(281))).status, 400);
    assert.equal((await avaliar(1, 5, "a".repeat(280))).status, 201);
  });

  test("CA2: conta caracteres, não bytes (acentos e emoji valem 1)", async () => {
    assert.equal((await avaliar(1, 5, "ç".repeat(280))).status, 201);
    assert.equal((await avaliar(1, 5, "😀".repeat(280))).status, 201);
    assert.equal((await avaliar(1, 5, "😀".repeat(281))).status, 400);
  });

  // ---------------------------------------------------------------- CA3

  test("CA3: notas 5, 4 e 4 resultam em média 4,3 e quantidade 3", async () => {
    await avaliar(1, 5);
    await avaliar(1, 4);
    await avaliar(1, 4);
    const r = await api.get("/api/indicadores");
    const secretaria = r.json.find((s) => s.nome === "Secretaria");
    assert.equal(secretaria.quantidade, 3);
    assert.equal(secretaria.media, 4.3);
    assert.equal(secretaria.amostra_suficiente, true);
    assert.deepEqual(secretaria.distribuicao, { 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 });
  });

  // ---------------------------------------------------------------- CA4

  test("CA4: com duas avaliações a média é nula (amostra insuficiente)", async () => {
    await avaliar(2, 4);
    await avaliar(2, 5);
    const biblioteca = (await api.get("/api/indicadores")).json.find((s) => s.nome === "Biblioteca");
    assert.equal(biblioteca.quantidade, 2);
    assert.equal(biblioteca.media, null);
    assert.equal(biblioteca.amostra_suficiente, false);
    assert.deepEqual(biblioteca.distribuicao, { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 });
  });

  test("CA4: serviço sem avaliação aparece com quantidade 0 e média nula", async () => {
    const cantina = (await api.get("/api/indicadores")).json.find((s) => s.nome === "Cantina");
    assert.equal(cantina.quantidade, 0);
    assert.equal(cantina.media, null);
  });

  // ---------------------------------------------------------------- CA5

  test("CA5: comentário oculto some da lista pública, mas a nota continua na média", async () => {
    await avaliar(1, 5, "Muito bom");
    const impropria = await avaliar(1, 1, "Comentário impróprio");
    await avaliar(1, 4, "Bom");

    const antes = (await api.get("/api/indicadores")).json.find((s) => s.nome === "Secretaria");
    assert.equal(antes.quantidade, 3);

    const cookie = await logarGestor(api);
    const mod = await api.patch(`/api/admin/avaliacoes/${impropria.json.id}`, { oculta: true }, cookie);
    assert.equal(mod.status, 200);

    const publicos = (await api.get("/api/comentarios")).json;
    assert.equal(publicos.length, 2);
    assert.ok(!publicos.some((c) => c.comentario === "Comentário impróprio"));

    const depois = (await api.get("/api/indicadores")).json.find((s) => s.nome === "Secretaria");
    assert.equal(depois.quantidade, 3, "a quantidade não pode mudar");
    assert.equal(depois.media, antes.media, "a média não pode mudar");
    assert.deepEqual(depois.distribuicao, antes.distribuicao);

    // reexibir devolve o comentário à lista pública
    await api.patch(`/api/admin/avaliacoes/${impropria.json.id}`, { oculta: false }, cookie);
    assert.equal((await api.get("/api/comentarios")).json.length, 3);
  });

  // ---------------------------------------------------------------- 404 / 409 / 503

  test("serviço inexistente retorna 404", async () => {
    assert.equal((await avaliar(99, 5)).status, 404);
    assert.equal((await avaliar(999999999, 5)).status, 404);
  });

  test("avaliação inexistente na moderação retorna 404", async () => {
    const cookie = await logarGestor(api);
    assert.equal((await api.patch("/api/admin/avaliacoes/9999", { oculta: true }, cookie)).status, 404);
  });

  test("rota desconhecida da API retorna 404 em JSON", async () => {
    const r = await api.get("/api/nao-existe");
    assert.equal(r.status, 404);
    assert.ok(r.json.message);
  });

  test("JSON malformado retorna 400 sem detalhe interno", async () => {
    const resposta = await fetch(`${api.base}/api/avaliacoes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{isto nao e json"
    });
    assert.equal(resposta.status, 400);
    assert.doesNotMatch(JSON.stringify(await resposta.json()), /SyntaxError|at |node_modules/);
  });

  test("banco fora do ar: rotas de dados e /health retornam 503 sem expor detalhes", async () => {
    // Conexão real recusada (porta 1 não tem PostgreSQL): o erro vem do driver, não de um objeto falso.
    const { criarBanco } = require("../src/db");
    const semBanco = criarBanco("postgres://usuario:senha-secreta@127.0.0.1:1/avaliacao");
    const apiSemBanco = await iniciar(semBanco);
    try {
      for (const rota of ["/api/servicos", "/api/indicadores", "/api/comentarios", "/health"]) {
        const r = await apiSemBanco.get(rota);
        assert.equal(r.status, 503, rota);
        assert.doesNotMatch(JSON.stringify(r.json), /ECONNREFUSED|127\.0\.0\.1|senha-secreta|usuario|postgres/);
      }
      assert.equal((await apiSemBanco.post("/api/avaliacoes", { servico_id: 1, nota: 5 })).status, 503);
      assert.equal((await apiSemBanco.patch("/api/admin/avaliacoes/1", { oculta: true }, await logarGestor(apiSemBanco))).status, 503);
    } finally {
      await apiSemBanco.parar();
      await semBanco.fechar();
    }
  });

  // ---------------------------------------------------------------- /health e persistência

  test("/health confirma a conexão com o banco", async () => {
    const r = await api.get("/health");
    assert.equal(r.status, 200);
    assert.equal(r.json.status, "ok");
    assert.equal(r.json.database, "connected");
    assert.ok(Date.parse(r.json.iniciado_em));
  });

  test("persistência: depois de reiniciar a aplicação o registro continua lá", async () => {
    const criada = await avaliar(1, 5, "G01-TESTE");
    const antes = (await api.get("/health")).json.iniciado_em;
    await api.parar();

    // "Reinício": uma aplicação nova sobre o mesmo banco.
    await new Promise((ok) => setTimeout(ok, 15));
    api = await iniciar(db);

    const depois = (await api.get("/health")).json.iniciado_em;
    assert.notEqual(depois, antes, "iniciado_em deve mudar no reinício");
    const lista = (await api.get("/api/comentarios")).json;
    assert.ok(lista.some((c) => c.id === criada.json.id && c.comentario === "G01-TESTE"));
  });

  // ---------------------------------------------------------------- restrições no banco

  test("restrições no banco recusam nota inválida mesmo sem passar pela API", async () => {
    await assert.rejects(db.query("INSERT INTO avaliacoes (servico_id, nota) VALUES (1, 6)"), /check/i);
    await assert.rejects(db.query("INSERT INTO avaliacoes (servico_id, nota) VALUES (1, 0)"), /check/i);
    await assert.rejects(
      db.query("INSERT INTO avaliacoes (servico_id, nota, comentario) VALUES (1, 5, $1)", ["x".repeat(281)]),
      /too long|value too long|varying/i
    );
    await assert.rejects(db.query("INSERT INTO avaliacoes (servico_id, nota) VALUES (99, 5)"), /foreign key/i);
  });

  // ---------------------------------------------------------------- segurança

  test("injeção de SQL no comentário é gravada como texto (consulta parametrizada)", async () => {
    const texto = "'); DROP TABLE avaliacoes; --";
    assert.equal((await avaliar(1, 5, texto)).status, 201);
    const { rows } = await db.query("SELECT comentario FROM avaliacoes");
    assert.equal(rows[0].comentario, texto);
  });

  test("moderação sem login retorna 401; com cookie falso também", async () => {
    assert.equal((await api.get("/api/admin/me")).status, 401);
    assert.equal((await api.get("/api/admin/avaliacoes")).status, 401);
    assert.equal((await api.patch("/api/admin/avaliacoes/1", { oculta: true })).status, 401);
    assert.equal((await api.get("/api/admin/me", { Cookie: "sessao=abc.def" })).status, 401);
  });

  test("login: senha errada e usuário errado retornam 401 com a mesma mensagem", async () => {
    const a = await api.post("/api/admin/login", { usuario: ADMIN.usuario, senha: "errada-123456" });
    const b = await api.post("/api/admin/login", { usuario: "outro", senha: SENHA_GESTOR });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.json.message, b.json.message);
  });

  test("login correto cria cookie HttpOnly/SameSite e libera a moderação", async () => {
    const r = await api.post("/api/admin/login", { usuario: ADMIN.usuario, senha: SENHA_GESTOR });
    assert.equal(r.status, 200);
    const cookie = r.cabecalhos.get("set-cookie");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    const eu = await api.get("/api/admin/me", { Cookie: cookie.split(";")[0] });
    assert.equal(eu.status, 200);
    assert.equal(eu.json.usuario, ADMIN.usuario);
  });

  test("logout encerra a sessão no navegador", async () => {
    const r = await api.post("/api/admin/logout", {});
    assert.equal(r.status, 200);
    assert.match(r.cabecalhos.get("set-cookie"), /Max-Age=0/);
  });

  test("moderação com Origin de outro site é bloqueada (403)", async () => {
    const cookie = await logarGestor(api);
    const r = await api.patch("/api/admin/avaliacoes/1", { oculta: true }, { ...cookie, Origin: "https://site-malicioso.exemplo" });
    assert.equal(r.status, 403);
  });

  test("moderação valida o corpo: oculta precisa ser booleano", async () => {
    const criada = await avaliar(1, 5, "x");
    const cookie = await logarGestor(api);
    assert.equal((await api.patch(`/api/admin/avaliacoes/${criada.json.id}`, { oculta: "sim" }, cookie)).status, 400);
    assert.equal((await api.patch("/api/admin/avaliacoes/abc", { oculta: true }, cookie)).status, 400);
  });

  test("lista do gestor traz comentários ocultos; a pública não", async () => {
    const criada = await avaliar(2, 3, "Escondido");
    const cookie = await logarGestor(api);
    await api.patch(`/api/admin/avaliacoes/${criada.json.id}`, { oculta: true }, cookie);
    const todos = (await api.get("/api/admin/avaliacoes", cookie)).json;
    assert.ok(todos.some((a) => a.id === criada.json.id && a.oculta === true));
    assert.equal((await api.get("/api/comentarios")).json.length, 0);
  });

  test("respostas da API não são guardadas em cache e trazem nosniff", async () => {
    const r = await api.get("/api/servicos");
    assert.equal(r.cabecalhos.get("cache-control"), "no-store");
    assert.equal(r.cabecalhos.get("x-content-type-options"), "nosniff");
  });

  test("a API não serve arquivos do servidor (código, banco, .env)", async () => {
    for (const rota of ["/server.js", "/package.json", "/banco/schema.sql", "/.env", "/src/app.js", "/.git/config"]) {
      const resposta = await fetch(api.base + rota);
      assert.equal(resposta.status, 404, rota);
    }
    assert.equal((await fetch(api.base + "/")).status, 200);
    assert.equal((await fetch(api.base + "/dashboard.html")).status, 200);
  });
});

describe("sem configuração", () => {
  test("sem DATABASE_URL as rotas de dados respondem 503 e o front continua no ar", async () => {
    const { criarBanco } = require("../src/db");
    const api = await iniciar(criarBanco(""));
    try {
      assert.equal((await api.get("/api/servicos")).status, 503);
      assert.equal((await api.get("/health")).status, 503);
      assert.equal((await fetch(api.base + "/")).status, 200);
    } finally {
      await api.parar();
    }
  });

  test("sem variáveis do gestor o login responde 503 (nunca libera)", async () => {
    const db = await criarBancoDeTeste();
    const api = await iniciar(db, { admin: { usuario: "", senhaHash: "", segredo: "" } });
    try {
      assert.equal((await api.post("/api/admin/login", { usuario: "", senha: "" })).status, 503);
    } finally {
      await api.parar();
      await db.fechar();
    }
  });
});

describe("banco novo", () => {
  test("traz só os 4 serviços e nenhuma avaliação: nada é inventado", async () => {
    const db = await criarBancoDeTeste();
    const api = await iniciar(db);
    try {
      const indicadores = (await api.get("/api/indicadores")).json;
      assert.deepEqual(indicadores.map((s) => s.nome), ["Secretaria", "Biblioteca", "Cantina", "Laboratórios"]);
      for (const servico of indicadores) {
        assert.equal(servico.quantidade, 0, servico.nome);
        assert.equal(servico.media, null, servico.nome);
        assert.equal(servico.amostra_suficiente, false, servico.nome);
      }
      assert.deepEqual((await api.get("/api/comentarios")).json, []);
      const { rows } = await db.query("SELECT COUNT(*)::int AS n FROM avaliacoes");
      assert.equal(rows[0].n, 0);
    } finally {
      await api.parar();
      await db.fechar();
    }
  });
});
