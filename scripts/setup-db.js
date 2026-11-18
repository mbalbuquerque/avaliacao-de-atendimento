// Cria as tabelas e os 4 serviços (banco/schema.sql). Não carrega nenhuma avaliação:
// o painel mostra só o que os estudantes realmente enviam.
// Uso: DATABASE_URL=... node scripts/setup-db.js

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
  } finally {
    await cliente.end();
  }
}

main().catch((erro) => {
  console.error("Falha ao preparar o banco:", erro.code || erro.message);
  process.exit(1);
});
