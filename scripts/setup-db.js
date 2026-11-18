// Cria as tabelas (banco/schema.sql) e, com --dados, carrega as 20 avaliações fictícias.
// Uso: DATABASE_URL=... node scripts/setup-db.js [--dados]

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Defina DATABASE_URL antes de executar.");
    process.exit(1);
  }

  const cliente = new Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();
  try {
    await cliente.query(fs.readFileSync(path.join(__dirname, "..", "banco", "schema.sql"), "utf8"));
    console.log("Tabelas e serviços criados.");

    if (process.argv.includes("--dados")) {
      const { rows } = await cliente.query("SELECT COUNT(*)::int AS total FROM avaliacoes");
      if (rows[0].total > 0) {
        console.log(`Dados iniciais ignorados: já existem ${rows[0].total} avaliações.`);
      } else {
        await cliente.query(fs.readFileSync(path.join(__dirname, "..", "banco", "dados-iniciais.sql"), "utf8"));
        console.log("20 avaliações fictícias carregadas.");
      }
    }
  } finally {
    await cliente.end();
  }
}

main().catch((erro) => {
  console.error("Falha ao preparar o banco:", erro.code || erro.message);
  process.exit(1);
});
