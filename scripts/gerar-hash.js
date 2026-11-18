// Gera o hash scrypt da senha do gestor para a variável ADMIN_SENHA_HASH.
// Uso: npm run hash -- "senha-do-gestor"

const { gerarHash } = require("../src/auth");

const senha = process.argv[2];
if (!senha || senha.length < 8) {
  console.error('Uso: npm run hash -- "senha com pelo menos 8 caracteres"');
  process.exit(1);
}
console.log(gerarHash(senha));
