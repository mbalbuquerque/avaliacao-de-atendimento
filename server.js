// Ponto de entrada. No Azure App Service a porta vem de process.env.PORT.

const { criarBanco } = require("./src/db");
const { criarApp } = require("./src/app");

const db = criarBanco();
const app = criarApp(db);
const porta = Number(process.env.PORT) || 3000;

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
