// Acesso ao PostgreSQL. A string de conexão vem só da variável DATABASE_URL.
// Toda consulta usa parâmetros ($1, $2...): texto digitado pelo usuário nunca é
// concatenado dentro do SQL.

const { Pool } = require("pg");

function criarBanco(url = process.env.DATABASE_URL) {
  if (!url) {
    // Sem DATABASE_URL a aplicação sobe, mas as rotas de dados respondem 503.
    return {
      configurado: false,
      async query() {
        const erro = new Error("DATABASE_URL não configurada");
        erro.code = "SEM_BANCO";
        throw erro;
      },
      async fechar() {}
    };
  }

  const pool = new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
  });

  // Erro em conexão ociosa não derruba o processo.
  pool.on("error", (erro) => {
    console.error("Conexão ociosa com o banco falhou:", erro.code || erro.message);
  });

  return {
    configurado: true,
    query: (sql, params) => pool.query(sql, params),
    fechar: () => pool.end()
  };
}

module.exports = { criarBanco };
