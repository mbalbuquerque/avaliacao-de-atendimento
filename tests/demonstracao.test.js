// Carga de demonstração: dados fictícios gravados no PostgreSQL de verdade (nada de mock).

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { carregarDemonstracao } = require("../src/demonstracao");
const { criarBancoDeTeste, iniciar } = require("./ajuda");

describe("dados de demonstração", () => {
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

  const total = async () => (await db.query("SELECT COUNT(*)::int AS n FROM avaliacoes")).rows[0].n;

  test("o banco só com o schema continua sem nenhuma avaliação", async () => {
    assert.equal(await total(), 0);
  });

  test("a carga grava 20 avaliações no banco e a API as devolve pelos indicadores", async () => {
    const r = await carregarDemonstracao((sql) => db.query(sql));
    assert.equal(r.carregou, true);
    assert.equal(r.linhas, 20);
    assert.equal(await total(), 20);

    const ind = (await api.get("/api/indicadores")).json;
    const por = Object.fromEntries(ind.map((s) => [s.nome, s]));
    assert.equal(por["Secretaria"].quantidade, 6);
    assert.equal(por["Biblioteca"].quantidade, 6);
    assert.equal(por["Cantina"].quantidade, 6);
    assert.equal(por["Secretaria"].amostra_suficiente, true);
    assert.notEqual(por["Secretaria"].media, null);
    // Laboratórios tem 2 de propósito: demonstra "Amostra insuficiente".
    assert.equal(por["Laboratórios"].quantidade, 2);
    assert.equal(por["Laboratórios"].media, null);
    assert.equal(por["Laboratórios"].amostra_suficiente, false);
  });

  test("a carga é idempotente: rodar de novo não duplica", async () => {
    const consulta = (sql) => db.query(sql);
    assert.equal((await carregarDemonstracao(consulta)).carregou, true);
    assert.equal((await carregarDemonstracao(consulta)).carregou, false);
    assert.equal(await total(), 20);
  });

  test("as datas se espalham pelos últimos dias e os comentários aparecem na lista pública", async () => {
    await carregarDemonstracao((sql) => db.query(sql));
    const { rows } = await db.query(
      "SELECT EXTRACT(EPOCH FROM (now() - MIN(criada_em)))/3600 AS horas_mais_antiga, " +
      "EXTRACT(EPOCH FROM (now() - MAX(criada_em)))/3600 AS horas_mais_nova FROM avaliacoes");
    assert.ok(Number(rows[0].horas_mais_antiga) > 100, "a mais antiga tem mais de 100 horas");
    assert.ok(Number(rows[0].horas_mais_nova) < 12, "a mais nova tem menos de 12 horas");
    assert.ok((await api.get("/api/comentarios")).json.length >= 10);
  });

  test("a carga convive com avaliações reais já existentes e as preserva", async () => {
    const real = await api.post("/api/avaliacoes", { servico_id: 2, nota: 2, comentario: "avaliação real" });
    assert.equal(real.status, 201);
    await carregarDemonstracao((sql) => db.query(sql));
    assert.equal(await total(), 21);
    const { rows } = await db.query("SELECT nota FROM avaliacoes WHERE comentario = 'avaliação real'");
    assert.equal(rows.length, 1);
  });
});
