// Carga opcional de dados FICTÍCIOS de demonstração (banco/dados-demonstracao.sql).
//
// Não é mock: são linhas gravadas no PostgreSQL de verdade e lidas pela mesma API que atende
// os estudantes. Servem para o painel não aparecer vazio na apresentação. O banco criado só com
// o schema.sql continua com os 4 serviços e nenhuma avaliação.
//
// A idempotência está no próprio SQL (INSERT ... WHERE NOT EXISTS): aqui não há valor de controle
// escrito no código, só a execução do arquivo e a contagem das linhas que entraram.

const fs = require("fs");
const path = require("path");

const ARQUIVO = path.join(__dirname, "..", "banco", "dados-demonstracao.sql");

// `consulta(sql)` é a função de consulta do banco (pg em produção, o PostgreSQL dos testes).
// Devolve { carregou, linhas }. Chamar duas vezes não duplica nada.
async function carregarDemonstracao(consulta) {
  const resultado = await consulta(fs.readFileSync(ARQUIVO, "utf8"));
  // pg informa rowCount; o PGlite informa affectedRows.
  const linhas = resultado.rowCount ?? resultado.affectedRows ?? 0;
  return { carregou: linhas > 0, linhas };
}

module.exports = { carregarDemonstracao };
