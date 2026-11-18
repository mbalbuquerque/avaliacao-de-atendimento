// Acesso ao PostgreSQL. A string de conexão vem só da variável DATABASE_URL.
// Toda consulta usa parâmetros ($1, $2...): texto digitado pelo usuário nunca é
// concatenado dentro do SQL.

const { Pool } = require("pg");
const { lerConfig } = require("./config");

// Tamanho do pool e tempos vêm da configuração (BANCO_*); valor inválido falha aqui, na subida.
function criarBanco(url = process.env.DATABASE_URL, config = lerConfig()) {
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
    max: config.bancoConexoesMaximas,
    connectionTimeoutMillis: config.bancoTimeoutConexaoMs,
    idleTimeoutMillis: config.bancoTimeoutOciosoMs
  });

  // Erro em conexão ociosa não derruba o processo.
  pool.on("error", (erro) => {
    console.error("Conexão ociosa com o banco falhou:", erro.code || erro.message);
  });

  return {
    configurado: true,
    pool,
    query: (sql, params) => pool.query(sql, params),
    fechar: () => pool.end()
  };
}

module.exports = { criarBanco };
