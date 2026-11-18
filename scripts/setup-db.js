// Cria as tabelas e os 4 serviços (banco/schema.sql).
// Com --demonstracao, carrega também as 20 avaliações FICTÍCIAS de banco/dados-demonstracao.sql
// (opcional e idempotente). Sem a opção, o banco fica só com os serviços e nenhuma avaliação.
// Uso: DATABASE_URL=... node scripts/setup-db.js [--demonstracao]

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { carregarDemonstracao } = require("../src/demonstracao");

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

    if (process.argv.includes("--demonstracao")) {
      const { carregou, linhas } = await carregarDemonstracao((sql) => cliente.query(sql));
      console.log(carregou
        ? `${linhas} avaliações fictícias de demonstração carregadas.`
        : "Demonstração ignorada: as avaliações de demonstração já estão no banco.");
    }
  } finally {
    await cliente.end();
  }
}

main().catch((erro) => {
  console.error("Falha ao preparar o banco:", erro.code || erro.message);
  process.exit(1);
});
