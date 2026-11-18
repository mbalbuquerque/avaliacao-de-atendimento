// Apoio aos testes: PostgreSQL de verdade em memória (PGlite) com o mesmo schema.sql
// da produção, e a aplicação ouvindo numa porta livre.

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");
const { criarApp } = require("../src/app");
const { gerarHash } = require("../src/auth");

const SENHA_GESTOR = "senha-de-teste-123";
const ADMIN = {
  usuario: "gestor",
  senhaHash: gerarHash(SENHA_GESTOR),
  segredo: "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres"
};

// Por padrão usa um PostgreSQL de verdade em memória (PGlite). Com TEST_DATABASE_URL
// aponta para um PostgreSQL real (o CI sobe um postgres:16): a mesma suíte roda nos dois.
async function criarBancoDeTeste({ comDados = false } = {}) {
  const schema = fs.readFileSync(path.join(__dirname, "..", "banco", "schema.sql"), "utf8");
  const dados = fs.readFileSync(path.join(__dirname, "..", "banco", "dados-iniciais.sql"), "utf8");

  if (process.env.TEST_DATABASE_URL) {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await pool.query(schema);
    if (comDados) await pool.query(dados);
    return {
      configurado: true,
      query: (sql, params) => pool.query(sql, params),
      fechar: () => pool.end()
    };
  }

  const pg = new PGlite();
  await pg.exec(schema);
  if (comDados) await pg.exec(dados);
  return {
    configurado: true,
    query: (sql, params) => pg.query(sql, params),
    fechar: () => pg.close()
  };
}

// Sobe a aplicação numa porta livre e devolve funções para chamar a API.
async function iniciar(db, opcoes = {}) {
  const app = criarApp(db, { admin: ADMIN, ...opcoes });
  const servidor = await new Promise((ok) => {
    const s = app.listen(0, "127.0.0.1", () => ok(s));
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;

  async function chamar(metodo, rota, corpo, cabecalhos = {}) {
    const resposta = await fetch(base + rota, {
      method: metodo,
      headers: { "Content-Type": "application/json", ...cabecalhos },
      body: corpo === undefined ? undefined : JSON.stringify(corpo)
    });
    let json = null;
    try { json = await resposta.json(); } catch { /* resposta sem JSON */ }
    return { status: resposta.status, json, cabecalhos: resposta.headers };
  }

  return {
    base,
    get: (rota, h) => chamar("GET", rota, undefined, h),
    post: (rota, corpo, h) => chamar("POST", rota, corpo, h),
    patch: (rota, corpo, h) => chamar("PATCH", rota, corpo, h),
    parar: () => new Promise((ok) => servidor.close(ok))
  };
}

// Faz o login do gestor e devolve o cabeçalho Cookie para as chamadas seguintes.
async function logarGestor(api) {
  const r = await api.post("/api/admin/login", { usuario: ADMIN.usuario, senha: SENHA_GESTOR });
  const cookie = r.cabecalhos.get("set-cookie").split(";")[0];
  return { Cookie: cookie };
}

module.exports = { criarBancoDeTeste, iniciar, logarGestor, ADMIN, SENHA_GESTOR };
