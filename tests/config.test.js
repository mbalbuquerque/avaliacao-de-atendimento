// Configuração por variáveis de ambiente: padrões, leitura, validação e efeito real no app.

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { lerConfig, PADROES } = require("../src/config");
const { criarBanco } = require("../src/db");
const { criarApp } = require("../src/app");
const { criarBancoDeTeste, iniciar, logarGestor } = require("./ajuda");

// Define variáveis de ambiente só durante a função e restaura tudo no fim.
async function comAmbiente(variaveis, funcao) {
  const antes = {};
  for (const [nome, valor] of Object.entries(variaveis)) {
    antes[nome] = process.env[nome];
    process.env[nome] = valor;
  }
  try {
    return await funcao();
  } finally {
    for (const [nome, valor] of Object.entries(antes)) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  }
}

describe("lerConfig: padrões e leitura", () => {
  test("sem nenhuma variável vale o padrão (comportamento anterior à configuração)", () => {
    const c = lerConfig({});
    assert.equal(c.porta, 3000);
    assert.equal(c.limiteGeralPorMinuto, 600);
    assert.equal(c.limiteAvaliacoesPorMinuto, 30);
    assert.equal(c.limiteLoginTentativas, 10);
    assert.equal(c.limiteLoginJanelaMs, 15 * 60 * 1000);
    assert.equal(c.sessaoMs, 8 * 60 * 60 * 1000);
    assert.equal(c.corpoMaximoBytes, 10 * 1024);
    assert.equal(c.comentariosPublicosMaximo, 100);
    assert.equal(c.avaliacoesGestorMaximo, 500);
    assert.equal(c.bancoConexoesMaximas, 5);
    assert.equal(c.bancoTimeoutConexaoMs, 5000);
    assert.equal(c.bancoTimeoutOciosoMs, 30000);
  });

  test("os padrões documentados em PADROES batem com a configuração padrão", () => {
    assert.deepEqual(Object.keys(PADROES).sort(), [
      "AVALIACOES_GESTOR_MAXIMO", "BANCO_CONEXOES_MAXIMAS", "BANCO_TIMEOUT_CONEXAO_MS",
      "BANCO_TIMEOUT_OCIOSO_MS", "COMENTARIOS_PUBLICOS_MAXIMO", "LIMITE_AVALIACOES_POR_MINUTO",
      "LIMITE_GERAL_POR_MINUTO", "LIMITE_LOGIN_JANELA_MINUTOS", "LIMITE_LOGIN_TENTATIVAS", "PORT",
      "SESSAO_HORAS", "TAMANHO_MAXIMO_CORPO_KB"
    ]);
  });

  test("cada variável é lida e convertida para a unidade usada pelo código", () => {
    const c = lerConfig({
      PORT: "8080",
      LIMITE_GERAL_POR_MINUTO: "100",
      LIMITE_AVALIACOES_POR_MINUTO: "7",
      LIMITE_LOGIN_TENTATIVAS: "4",
      LIMITE_LOGIN_JANELA_MINUTOS: "2",
      SESSAO_HORAS: "1,5",
      TAMANHO_MAXIMO_CORPO_KB: "2",
      COMENTARIOS_PUBLICOS_MAXIMO: "25",
      AVALIACOES_GESTOR_MAXIMO: "60",
      BANCO_CONEXOES_MAXIMAS: "9",
      BANCO_TIMEOUT_CONEXAO_MS: "1500",
      BANCO_TIMEOUT_OCIOSO_MS: "7000"
    });
    assert.equal(c.porta, 8080);
    assert.equal(c.limiteGeralPorMinuto, 100);
    assert.equal(c.limiteAvaliacoesPorMinuto, 7);
    assert.equal(c.limiteLoginTentativas, 4);
    assert.equal(c.limiteLoginJanelaMs, 2 * 60 * 1000);
    assert.equal(c.sessaoMs, 1.5 * 60 * 60 * 1000);
    assert.equal(c.corpoMaximoBytes, 2048);
    assert.equal(c.comentariosPublicosMaximo, 25);
    assert.equal(c.avaliacoesGestorMaximo, 60);
    assert.equal(c.bancoConexoesMaximas, 9);
    assert.equal(c.bancoTimeoutConexaoMs, 1500);
    assert.equal(c.bancoTimeoutOciosoMs, 7000);
  });

  test("SESSAO_HORAS aceita ponto ou vírgula decimal", () => {
    assert.equal(lerConfig({ SESSAO_HORAS: "0.5" }).sessaoMs, 30 * 60 * 1000);
    assert.equal(lerConfig({ SESSAO_HORAS: "0,5" }).sessaoMs, 30 * 60 * 1000);
  });

  test("variável vazia ou só com espaços conta como ausente", () => {
    assert.equal(lerConfig({ LIMITE_GERAL_POR_MINUTO: "", LIMITE_LOGIN_TENTATIVAS: "   " }).limiteGeralPorMinuto, 600);
  });

  test("a configuração devolvida é imutável", () => {
    const c = lerConfig({});
    assert.throws(() => { "use strict"; c.limiteGeralPorMinuto = 1; }, TypeError);
  });
});

describe("lerConfig: valor inválido falha com mensagem clara", () => {
  const inteiros = [
    "LIMITE_GERAL_POR_MINUTO", "LIMITE_AVALIACOES_POR_MINUTO", "LIMITE_LOGIN_TENTATIVAS",
    "LIMITE_LOGIN_JANELA_MINUTOS", "TAMANHO_MAXIMO_CORPO_KB", "COMENTARIOS_PUBLICOS_MAXIMO",
    "AVALIACOES_GESTOR_MAXIMO", "BANCO_CONEXOES_MAXIMAS", "BANCO_TIMEOUT_CONEXAO_MS",
    "BANCO_TIMEOUT_OCIOSO_MS"
  ];

  for (const nome of inteiros) {
    test(`${nome}: texto, zero, negativo e decimal são recusados`, () => {
      for (const ruim of ["abc", "0", "-5", "1.5", "1e3", "10 20", "NaN"]) {
        assert.throws(() => lerConfig({ [nome]: ruim }), (erro) => {
          assert.match(erro.message, new RegExp(`Configuração inválida: ${nome}=`));
          assert.match(erro.message, /número inteiro maior que zero/);
          assert.match(erro.message, /padrão:/);
          return true;
        }, `${nome}=${ruim}`);
      }
    });
  }

  test("SESSAO_HORAS: texto, zero, negativo e infinito são recusados", () => {
    for (const ruim of ["abc", "0", "0,0", "-1", "Infinity", "1,2,3"]) {
      assert.throws(() => lerConfig({ SESSAO_HORAS: ruim }), /Configuração inválida: SESSAO_HORAS=.*maior que zero/, ruim);
    }
  });

  test("PORT: fora de 1 a 65535 ou não numérica é recusada", () => {
    for (const ruim of ["abc", "0", "70000", "-1", "80.5"]) {
      assert.throws(() => lerConfig({ PORT: ruim }), /Configuração inválida: PORT=.*1 a 65535/, ruim);
    }
    assert.equal(lerConfig({ PORT: "65535" }).porta, 65535);
  });

  test("o valor inválido nunca cai em silêncio no padrão: criarApp e criarBanco também falham", async () => {
    const db = await criarBancoDeTeste();
    try {
      await comAmbiente({ LIMITE_GERAL_POR_MINUTO: "muitos" }, async () => {
        assert.throws(() => criarApp(db), /LIMITE_GERAL_POR_MINUTO/);
      });
      await comAmbiente({ BANCO_CONEXOES_MAXIMAS: "0" }, async () => {
        assert.throws(() => criarBanco("postgres://u:s@127.0.0.1:1/b"), /BANCO_CONEXOES_MAXIMAS/);
      });
    } finally {
      await db.fechar();
    }
  });
});

describe("a configuração tem efeito real na aplicação", () => {
  let db;
  let api;

  beforeEach(async () => {
    db = await criarBancoDeTeste();
  });

  afterEach(async () => {
    if (api) await api.parar();
    api = null;
    await db.fechar();
  });

  test("LIMITE_GERAL_POR_MINUTO=3: a 4ª requisição responde 429 e o /health nunca é limitado", async () => {
    await comAmbiente({ LIMITE_GERAL_POR_MINUTO: "3" }, async () => {
      api = await iniciar(db);
      for (let i = 0; i < 3; i++) assert.equal((await api.get("/api/servicos")).status, 200);
      assert.equal((await api.get("/api/servicos")).status, 429);
      for (let i = 0; i < 6; i++) assert.equal((await api.get("/health")).status, 200);
    });
  });

  test("LIMITE_AVALIACOES_POR_MINUTO=2: a 3ª avaliação responde 429 e não é gravada", async () => {
    await comAmbiente({ LIMITE_AVALIACOES_POR_MINUTO: "2" }, async () => {
      api = await iniciar(db);
      assert.equal((await api.post("/api/avaliacoes", { servico_id: 1, nota: 5 })).status, 201);
      assert.equal((await api.post("/api/avaliacoes", { servico_id: 1, nota: 5 })).status, 201);
      assert.equal((await api.post("/api/avaliacoes", { servico_id: 1, nota: 5 })).status, 429);
      assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM avaliacoes")).rows[0].n, 2);
    });
  });

  test("LIMITE_LOGIN_TENTATIVAS=2: a 3ª tentativa de login responde 429", async () => {
    await comAmbiente({ LIMITE_LOGIN_TENTATIVAS: "2" }, async () => {
      api = await iniciar(db);
      for (let i = 0; i < 2; i++) {
        assert.equal((await api.post("/api/admin/login", { usuario: "gestor", senha: `errada-${i}-xxxx` })).status, 401);
      }
      assert.equal((await api.post("/api/admin/login", { usuario: "gestor", senha: "errada-2-xxxx" })).status, 429);
    });
  });

  test("TAMANHO_MAXIMO_CORPO_KB=1: corpo de 2 KB responde 413", async () => {
    await comAmbiente({ TAMANHO_MAXIMO_CORPO_KB: "1" }, async () => {
      api = await iniciar(db);
      assert.equal((await api.post("/api/avaliacoes", { servico_id: 1, nota: 5, comentario: "a".repeat(2048) })).status, 413);
      assert.equal((await api.post("/api/avaliacoes", { servico_id: 1, nota: 5, comentario: "curto" })).status, 201);
    });
  });

  test("COMENTARIOS_PUBLICOS_MAXIMO=2 e AVALIACOES_GESTOR_MAXIMO=3 limitam as listas", async () => {
    await comAmbiente({ COMENTARIOS_PUBLICOS_MAXIMO: "2", AVALIACOES_GESTOR_MAXIMO: "3" }, async () => {
      api = await iniciar(db);
      for (let i = 0; i < 5; i++) {
        await api.post("/api/avaliacoes", { servico_id: 1, nota: 4, comentario: `comentário ${i}` });
      }
      assert.equal((await api.get("/api/comentarios")).json.length, 2);
      const cookie = await logarGestor(api);
      assert.equal((await api.get("/api/admin/avaliacoes", cookie)).json.length, 3);
    });
  });

  test("SESSAO_HORAS=0,0004 (1,44 s): a sessão vale logo depois do login e expira sozinha", async () => {
    await comAmbiente({ SESSAO_HORAS: "0,0004" }, async () => {
      api = await iniciar(db);
      const cookie = await logarGestor(api);
      assert.equal((await api.get("/api/admin/me", cookie)).status, 200);
      await new Promise((ok) => setTimeout(ok, 1800));
      assert.equal((await api.get("/api/admin/me", cookie)).status, 401);
    });
  });

  test("SESSAO_HORAS define o Max-Age do cookie de sessão", async () => {
    await comAmbiente({ SESSAO_HORAS: "2" }, async () => {
      api = await iniciar(db);
      const r = await api.post("/api/admin/login", { usuario: "gestor", senha: "senha-de-teste-123" });
      assert.match(r.cabecalhos.get("set-cookie"), /Max-Age=7200/);
    });
  });

  test("as opções passadas a criarApp (usadas nos testes) têm prioridade sobre o ambiente", async () => {
    await comAmbiente({ LIMITE_GERAL_POR_MINUTO: "1" }, async () => {
      api = await iniciar(db, { limiteGeralPorMinuto: 50 });
      for (let i = 0; i < 5; i++) assert.equal((await api.get("/api/servicos")).status, 200);
    });
  });

  test("BANCO_*: o pool de conexões é criado com os valores configurados", async () => {
    const banco = criarBanco("postgres://u:s@127.0.0.1:1/b", lerConfig({
      BANCO_CONEXOES_MAXIMAS: "7", BANCO_TIMEOUT_CONEXAO_MS: "1234", BANCO_TIMEOUT_OCIOSO_MS: "4321"
    }));
    try {
      assert.equal(banco.pool.options.max, 7);
      assert.equal(banco.pool.options.connectionTimeoutMillis, 1234);
      assert.equal(banco.pool.options.idleTimeoutMillis, 4321);
    } finally {
      await banco.fechar();
    }
  });
});
