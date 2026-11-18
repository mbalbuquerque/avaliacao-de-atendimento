// Endereços e credenciais de teste dos testes ponta a ponta (e2e).
// A senha do gestor de teste vem do ambiente (o CI define E2E_SENHA_GESTOR); sem a variável, vale um
// valor local descartável. Nada aqui é segredo: o banco do e2e é criado e apagado a cada execução.

// As portas vêm do ambiente (E2E_PORTA e E2E_PORTA_CONTROLE), com padrão 3100 e 3101: assim dois
// conjuntos de testes (ou um servidor esquecido de outra execução) não disputam a mesma porta.
const PORTA = Number(process.env.E2E_PORTA) || 3100;
const PORTA_CONTROLE = Number(process.env.E2E_PORTA_CONTROLE) || PORTA + 1;

const AMBIENTE = {
  porta: PORTA,
  portaControle: PORTA_CONTROLE,
  base: `http://127.0.0.1:${PORTA}`,
  controle: `http://127.0.0.1:${PORTA_CONTROLE}`,
  usuario: process.env.ADMIN_USUARIO || "gestor",
  senha: process.env.E2E_SENHA_GESTOR || "senha-e2e-local-123"
};

module.exports = { AMBIENTE };
