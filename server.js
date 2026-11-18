// Ponto de entrada. No Azure App Service a porta vem de process.env.PORT.
// Toda a configuração vem de variáveis de ambiente (src/config.js); valor inválido para a subida.

const { lerConfig } = require("./src/config");
const { criarBanco } = require("./src/db");
const { criarApp } = require("./src/app");

let config;
try {
  config = lerConfig();
} catch (erro) {
  console.error(erro.message);
  process.exit(1);
}

const db = criarBanco(process.env.DATABASE_URL, config);
const app = criarApp(db, { config });
const porta = config.porta;

const servidor = app.listen(porta, () => {
  console.log(`Avalie o Atendimento ouvindo na porta ${porta}`);
  if (!db.configurado) console.warn("DATABASE_URL não definida: rotas de dados respondem 503.");
});

function encerrar() {
  servidor.close(async () => {
    await db.fechar();
    process.exit(0);
  });
}
process.on("SIGTERM", encerrar);
process.on("SIGINT", encerrar);
