// Servidor dos testes e2e: a aplicação de verdade (src/app.js, com a CSP e os cabeçalhos reais)
// sobre um PostgreSQL. Com DATABASE_URL usa um PostgreSQL real (o CI sobe um postgres:16);
// sem ela, usa PGlite (PostgreSQL em memória) para rodar na máquina do desenvolvedor.
//
// Além da aplicação (porta 3100), abre um endereço de CONTROLE só para o teste (porta 3101,
// somente 127.0.0.1) que recria o banco e insere dados de apoio. Ele não faz parte do produto.

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { criarApp } = require("../../src/app");
const { gerarHash } = require("../../src/auth");
const { AMBIENTE } = require("./ambiente");

const RAIZ = path.join(__dirname, "..", "..");
const SCHEMA = fs.readFileSync(path.join(RAIZ, "banco", "schema.sql"), "utf8");

async function abrirBanco() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    return {
      configurado: true,
      tipo: "PostgreSQL real",
      query: (sql, params) => pool.query(sql, params),
      exec: (sql) => pool.query(sql),
      fechar: () => pool.end()
    };
  }
  const { PGlite } = require("@electric-sql/pglite");
  const pg = new PGlite();
  return {
    configurado: true,
    tipo: "PGlite (PostgreSQL em memória)",
    query: (sql, params) => pg.query(sql, params),
    exec: (sql) => pg.exec(sql),
    fechar: () => pg.close()
  };
}

async function recriar(db) {
  await db.exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await db.exec(SCHEMA);
}

async function semear(db, lista) {
  for (const a of lista) {
    await db.query(
      "INSERT INTO avaliacoes (servico_id, nota, comentario, oculta) VALUES ($1, $2, $3, $4)",
      [a.servico_id, a.nota, a.comentario ?? null, a.oculta === true]
    );
  }
}

function lerCorpo(req) {
  return new Promise((ok, falha) => {
    let texto = "";
    req.on("data", (pedaco) => { texto += pedaco; });
    req.on("end", () => {
      try { ok(texto ? JSON.parse(texto) : null); } catch (erro) { falha(erro); }
    });
  });
}

async function main() {
  const db = await abrirBanco();
  await recriar(db);

  const admin = {
    usuario: AMBIENTE.usuario,
    senhaHash: process.env.ADMIN_SENHA_HASH || gerarHash(AMBIENTE.senha),
    segredo: process.env.SESSAO_SEGREDO || crypto.randomBytes(32).toString("hex")
  };

  // Limites folgados só aqui: os testes e2e fazem muitas chamadas seguidas do mesmo IP. Os limites
  // em si (429) têm testes próprios em tests/seguranca.test.js e tests/cabecalhos.test.js.
  const app = criarApp(db, {
    admin,
    tentativasDeLogin: 1000,
    avaliacoesPorMinuto: 100000,
    limiteGeralPorMinuto: 100000,
    log: () => {}
  });
  await new Promise((ok) => app.listen(3100, "127.0.0.1", ok));

  const controle = http.createServer(async (req, res) => {
    const responder = (status, corpo) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(corpo));
    };
    try {
      if (req.method === "POST" && req.url === "/reiniciar") {
        await recriar(db);
        return responder(200, { ok: true });
      }
      if (req.method === "POST" && req.url === "/semear") {
        await semear(db, await lerCorpo(req));
        return responder(200, { ok: true });
      }
      if (req.method === "GET" && req.url === "/avaliacoes") {
        const { rows } = await db.query(
          "SELECT id, servico_id, nota, comentario, oculta FROM avaliacoes ORDER BY id");
        return responder(200, rows);
      }
      return responder(404, { erro: "rota de controle inexistente" });
    } catch (erro) {
      console.error("Controle do e2e falhou:", erro.message);
      return responder(500, { erro: erro.message });
    }
  });
  await new Promise((ok) => controle.listen(3101, "127.0.0.1", ok));

  console.log(`Servidor e2e pronto em ${AMBIENTE.base} (banco: ${db.tipo})`);

  const encerrar = async () => {
    controle.close();
    await db.fechar();
    process.exit(0);
  };
  process.on("SIGTERM", encerrar);
  process.on("SIGINT", encerrar);
}

main().catch((erro) => {
  console.error("Falha ao subir o servidor e2e:", erro);
  process.exit(1);
});
