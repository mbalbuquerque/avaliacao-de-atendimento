// Endereços e credenciais de teste dos testes ponta a ponta (e2e).
// A senha do gestor de teste vem do ambiente (o CI define E2E_SENHA_GESTOR); sem a variável, vale um
// valor local descartável. Nada aqui é segredo: o banco do e2e é criado e apagado a cada execução.

const AMBIENTE = {
  base: "http://127.0.0.1:3100",
  controle: "http://127.0.0.1:3101",
  usuario: process.env.ADMIN_USUARIO || "gestor",
  senha: process.env.E2E_SENHA_GESTOR || "senha-e2e-local-123"
};

module.exports = { AMBIENTE };
