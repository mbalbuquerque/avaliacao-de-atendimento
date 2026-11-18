// Testes unitários para regras de validação, autenticação, banco e exceções em src/**/*.js
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { validarAvaliacao } = require("../src/validacao");
const auth = require("../src/auth");
const { criarBanco } = require("../src/db");
const { criarApp } = require("../src/app");
const { criarBancoDeTeste, iniciar, ADMIN, SENHA_GESTOR } = require("./ajuda");

describe("Cobertura Completa - validacao.js", () => {
  test("cobre entradas não-objeto, nulas e tipos inválidos", () => {
    assert.ok(validarAvaliacao(null).erros.length > 0);
    assert.ok(validarAvaliacao(undefined).erros.length > 0);
    assert.ok(validarAvaliacao("string").erros.length > 0);
    assert.ok(validarAvaliacao(123).erros.length > 0);
    assert.ok(validarAvaliacao([1, 2, 3]).erros.length > 0);
  });

  test("cobre comentario de tipo não-string e espaços vazios", () => {
    const rTipoInvalido = validarAvaliacao({ servico_id: 1, nota: 5, comentario: 12345 });
    assert.ok(rTipoInvalido.erros.includes("comentario deve ser um texto."));

    const rEspacos = validarAvaliacao({ servico_id: 1, nota: 5, comentario: "   " });
    assert.equal(rEspacos.erros.length, 0);
    assert.equal(rEspacos.dados.comentario, null);
  });
});

describe("Cobertura Completa - auth.js", () => {
  test("gerarHash gera hash válido e conferirSenha valida", () => {
    const hash = auth.gerarHash("senha123");
    assert.ok(auth.conferirSenha("senha123", hash));
    assert.ok(!auth.conferirSenha("outrasenha", hash));
  });

  test("conferirSenha trata exceções e formatos inválidos", () => {
    assert.equal(auth.conferirSenha("senha", null), false);
    assert.equal(auth.conferirSenha("senha", ""), false);
    assert.equal(auth.conferirSenha("senha", "md5$123$456"), false);
    assert.equal(auth.conferirSenha("senha", "scrypt$1234$"), false);

    // Força exceção dentro do bloco try para cobrir o catch (linhas 24-25)
    const crypto = require("crypto");
    const origScrypt = crypto.scryptSync;
    try {
      crypto.scryptSync = () => { throw new Error("falha simulada scrypt"); };
      assert.equal(auth.conferirSenha("senha", "scrypt$1234$5678"), false);
    } finally {
      crypto.scryptSync = origScrypt;
    }
  });

  test("lerSessao cobre tokens inválidos, expirados e json corrompido", () => {
    const segredo = "segredo-super-longo-com-mais-de-32-chars";
    assert.equal(auth.lerSessao(null, segredo), null);
    assert.equal(auth.lerSessao("token", null), null);
    assert.equal(auth.lerSessao(1234, segredo), null);
    assert.equal(auth.lerSessao("semPonto", segredo), null);
    assert.equal(auth.lerSessao(".assinatura", segredo), null);
    assert.equal(auth.lerSessao("carga.", segredo), null);

    // Token assinado corretamente mas com carga que não é JSON (força catch do JSON.parse)
    const crypto = require("crypto");
    const cargaNaoJson = Buffer.from("isto-nao-eh-json").toString("base64url");
    const hmacNaoJson = crypto.createHmac("sha256", segredo).update(cargaNaoJson).digest("base64url");
    assert.equal(auth.lerSessao(`${cargaNaoJson}.${hmacNaoJson}`, segredo), null);

    // Token assinado com JSON válido mas sem 'u' como string
    const cargaSemU = Buffer.from(JSON.stringify({ exp: Date.now() + 10000 })).toString("base64url");
    const hmacSemU = crypto.createHmac("sha256", segredo).update(cargaSemU).digest("base64url");
    assert.equal(auth.lerSessao(`${cargaSemU}.${hmacSemU}`, segredo), null);

    // Token expirado
    const tokenExpirado = auth.criarSessao("gestor", segredo, 1000);
    assert.equal(auth.lerSessao(tokenExpirado, segredo, 1000 + auth.VALIDADE_MS + 10), null);
  });

  test("lerCookie cobre valores com decodificação corrompida", () => {
    assert.equal(auth.lerCookie(null, "sessao"), null);
    assert.equal(auth.lerCookie("outro=123", "sessao"), null);
    assert.equal(auth.lerCookie("sessao=teste", "sessao"), "teste");
    assert.equal(auth.lerCookie("sessao=%E0%A4%A", "sessao"), null);
  });
});

describe("Cobertura Completa - db.js", () => {
  test("criarBanco sem URL lança erro com código SEM_BANCO", async () => {
    const dbSemUrl = criarBanco("");
    assert.equal(dbSemUrl.configurado, false);
    await assert.rejects(async () => {
      await dbSemUrl.query("SELECT 1");
    }, (erro) => erro.code === "SEM_BANCO");
    await dbSemUrl.fechar();
  });

  test("criarBanco com URL captura pool e dispara tratador pool.on('error')", async () => {
    const pg = require("pg");
    const OrigPool = pg.Pool;
    let poolCapturado;

    pg.Pool = function(...args) {
      poolCapturado = new OrigPool(...args);
      return poolCapturado;
    };

    delete require.cache[require.resolve("../src/db")];
    const { criarBanco: criarComMock } = require("../src/db");

    const origError = console.error;
    let mensagemLogada = "";
    console.error = (msg, det) => {
      mensagemLogada = `${msg} ${det}`;
    };

    try {
      const dbComUrl = criarComMock("postgres://fake:fake@127.0.0.1:5432/fake");
      assert.equal(dbComUrl.configurado, true);
      assert.ok(poolCapturado);

      // Emite o erro com code e sem code para cobrir erro.code || erro.message
      poolCapturado.emit("error", { code: "ECONNRESET", message: "com codigo" });
      assert.ok(mensagemLogada.includes("ECONNRESET"));

      poolCapturado.emit("error", { message: "sem codigo apenas mensagem" });
      assert.ok(mensagemLogada.includes("sem codigo apenas mensagem"));

      // Testa a chamada query e fechar com o pool mockado
      let queryChamada = false;
      poolCapturado.query = async () => { queryChamada = true; return { rows: [1] }; };
      await dbComUrl.query("SELECT 1");
      assert.ok(queryChamada);

      await dbComUrl.fechar();
    } finally {
      console.error = origError;
      pg.Pool = OrigPool;
      delete require.cache[require.resolve("../src/db")];
    }
  });
});

describe("Cobertura Completa - app.js e rotas de exceção", () => {
  test("logger padrão quando nenhuma função de log é passada", async () => {
    const db = await criarBancoDeTeste();
    const origLog = console.log;
    let logExecutado = false;
    console.log = (txt) => {
      if (typeof txt === "string" && txt.includes('"rota"')) logExecutado = true;
    };

    const appSemLogCustom = criarApp(db, { admin: ADMIN });
    const srv = http.createServer(appSemLogCustom);
    await new Promise((res) => srv.listen(0, res));
    const porta = srv.address().port;

    try {
      await fetch(`http://127.0.0.1:${porta}/api/servicos`);
      await new Promise((r) => setTimeout(r, 60));
      assert.ok(logExecutado);
    } finally {
      console.log = origLog;
      srv.close();
      await db.fechar();
    }
  });

  test("falha de banco em /api/admin/avaliacoes retorna 503", async () => {
    const db = {
      configurado: true,
      async query() {
        const erro = new Error("Falha forçada");
        erro.code = "FORCADO";
        throw erro;
      },
      async fechar() {}
    };

    const api = await iniciar(db);
    const token = auth.criarSessao(ADMIN.usuario, ADMIN.segredo);
    const r = await api.get("/api/admin/avaliacoes", {
      Cookie: `${auth.COOKIE}=${token}`
    });
    assert.equal(r.status, 503);
    await api.parar();
  });

  test("falha de banco no PATCH /api/admin/avaliacoes/:id retorna 503", async () => {
    const db = {
      configurado: true,
      async query() {
        const erro = new Error("Falha forçada");
        erro.code = "FORCADO";
        throw erro;
      },
      async fechar() {}
    };

    const api = await iniciar(db);
    const token = auth.criarSessao(ADMIN.usuario, ADMIN.segredo);
    const r = await api.patch("/api/admin/avaliacoes/1", { oculta: true }, {
      Cookie: `${auth.COOKIE}=${token}`
    });
    assert.equal(r.status, 503);
    await api.parar();
  });

  test("login com HTTPS (trust proxy) define flag Secure no cookie", async () => {
    const db = await criarBancoDeTeste();
    const api = await iniciar(db);

    const r = await api.post("/api/admin/login", { usuario: ADMIN.usuario, senha: SENHA_GESTOR }, {
      "X-Forwarded-Proto": "https"
    });
    assert.equal(r.status, 200);
    const setCookie = r.cabecalhos.get("set-cookie");
    assert.ok(setCookie.includes("Secure"));

    await api.parar();
    await db.fechar();
  });

  test("admin não configurado ou segredo curto retorna 503", async () => {
    const db = await criarBancoDeTeste();
    // Segredo menor que 32 caracteres
    const app = criarApp(db, { admin: { ...ADMIN, segredo: "curto" } });
    const srv = http.createServer(app);
    await new Promise((res) => srv.listen(0, res));
    const porta = srv.address().port;

    try {
      const resp = await fetch(`http://127.0.0.1:${porta}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: ADMIN.usuario, senha: SENHA_GESTOR })
      });
      assert.equal(resp.status, 503);
    } finally {
      srv.close();
      await db.fechar();
    }
  });

  test("falha de banco genérica no POST /api/avaliacoes retorna 503", async () => {
    const db = {
      configurado: true,
      async query() {
        const erro = new Error("Falha desconhecida");
        erro.code = "OUTRO_ERRO";
        throw erro;
      },
      async fechar() {}
    };

    const api = await iniciar(db);
    const r = await api.post("/api/avaliacoes", { servico_id: 1, nota: 5 });
    assert.equal(r.status, 503);
    await api.parar();
  });

  test("endpoints do Swagger /docs e openapi.json respondem corretamente", async () => {
    const db = await criarBancoDeTeste();
    const api = await iniciar(db);

    const rJson = await api.get("/api/docs/openapi.json");
    assert.equal(rJson.status, 200);
    assert.equal(rJson.json.openapi, "3.0.3");
    assert.equal(rJson.json.info.title, "Avalie o Atendimento — API");

    const rDocsJson = await fetch(`${api.base}/docs/openapi.json`);
    assert.equal(rDocsJson.status, 200);

    const rDocs = await fetch(`${api.base}/docs/`);
    assert.equal(rDocs.status, 200);
    const html = await rDocs.text();
    assert.ok(html.includes("swagger"));

    const rRedirect = await fetch(`${api.base}/api/docs`, { redirect: "manual" });
    assert.ok([301, 302].includes(rRedirect.status));

    await api.parar();
    await db.fechar();
  });

  test("execução do middleware de erro com entity.too.large, erro inesperado e headersSent", () => {
    const app = criarApp({});
    const errorLayer = app.router.stack.find((l) => l.handle && l.handle.length === 4);
    assert.ok(errorLayer, "Middleware de erro deve estar registrado");
    const errorHandler = errorLayer.handle;

    // 1. headersSent === true -> delega para next(erro)
    let nextChamadoCom = null;
    errorHandler(new Error("erro"), {}, { headersSent: true }, (err) => {
      nextChamadoCom = err;
    });
    assert.ok(nextChamadoCom);

    // 2. entity.too.large -> 413
    let statusDefinido = null;
    let jsonEnviado = null;
    const res413 = {
      status(s) { statusDefinido = s; return this; },
      json(j) { jsonEnviado = j; return this; }
    };
    errorHandler({ type: "entity.too.large" }, {}, res413, () => {});
    assert.equal(statusDefinido, 413);
    assert.equal(jsonEnviado.message, "Requisição grande demais.");

    // 3. Erro inesperado genérico -> 500
    const origError = console.error;
    let erroLogado = false;
    console.error = () => { erroLogado = true; };
    try {
      const res500 = {
        status(s) { statusDefinido = s; return this; },
        json(j) { jsonEnviado = j; return this; }
      };
      errorHandler(new Error("falha bizarra"), {}, res500, () => {});
      assert.equal(statusDefinido, 500);
      assert.equal(jsonEnviado.message, "Erro interno. Tente novamente.");
      assert.ok(erroLogado);
    } finally {
      console.error = origError;
    }
  });
});
