// Configuração da aplicação, lida das variáveis de ambiente e validada na subida.
//
// Sem nenhuma variável o comportamento é o padrão documentado abaixo. Valor inválido
// (texto, zero, negativo) FALHA na subida com uma mensagem clara: nunca cai em silêncio no padrão.
// A configuração é lida a cada criarApp()/criarBanco(), então testes e deploys mudam o
// comportamento só mudando o ambiente.

const PADROES = Object.freeze({
  PORT: 3000,
  LIMITE_GERAL_POR_MINUTO: 600,
  LIMITE_AVALIACOES_POR_MINUTO: 30,
  LIMITE_LOGIN_TENTATIVAS: 10,
  LIMITE_LOGIN_JANELA_MINUTOS: 15,
  SESSAO_HORAS: 8,
  TAMANHO_MAXIMO_CORPO_KB: 10,
  COMENTARIOS_PUBLICOS_MAXIMO: 100,
  AVALIACOES_GESTOR_MAXIMO: 500,
  BANCO_CONEXOES_MAXIMAS: 5,
  BANCO_TIMEOUT_CONEXAO_MS: 5000,
  BANCO_TIMEOUT_OCIOSO_MS: 30000
});

function invalido(nome, bruto, esperado) {
  return new Error(
    `Configuração inválida: ${nome}="${bruto}". Use ${esperado} (padrão: ${PADROES[nome]}).`
  );
}

// Variável ausente ou vazia usa o padrão; qualquer outra coisa precisa ser válida.
function ler(env, nome, interpretar, esperado) {
  const bruto = env[nome];
  if (bruto === undefined || String(bruto).trim() === "") return PADROES[nome];
  const valor = interpretar(String(bruto).trim());
  if (valor === null) throw invalido(nome, bruto, esperado);
  return valor;
}

const inteiroPositivo = (texto) => (/^\d+$/.test(texto) && Number(texto) > 0 ? Number(texto) : null);

// Aceita ponto ou vírgula decimal (ex.: 0,5 ou 0.5), só valores finitos maiores que zero.
function numeroPositivo(texto) {
  if (!/^\d+([.,]\d+)?$/.test(texto)) return null;
  const numero = Number(texto.replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function porta(texto) {
  const numero = inteiroPositivo(texto);
  return numero !== null && numero <= 65535 ? numero : null;
}

function lerConfig(env = process.env) {
  const inteiro = (nome) => ler(env, nome, inteiroPositivo, "um número inteiro maior que zero");

  return Object.freeze({
    porta: ler(env, "PORT", porta, "um número inteiro de 1 a 65535"),
    limiteGeralPorMinuto: inteiro("LIMITE_GERAL_POR_MINUTO"),
    limiteAvaliacoesPorMinuto: inteiro("LIMITE_AVALIACOES_POR_MINUTO"),
    limiteLoginTentativas: inteiro("LIMITE_LOGIN_TENTATIVAS"),
    limiteLoginJanelaMs: inteiro("LIMITE_LOGIN_JANELA_MINUTOS") * 60 * 1000,
    sessaoMs: ler(env, "SESSAO_HORAS", numeroPositivo, "um número maior que zero (pode ter casas decimais)") * 60 * 60 * 1000,
    corpoMaximoBytes: inteiro("TAMANHO_MAXIMO_CORPO_KB") * 1024,
    comentariosPublicosMaximo: inteiro("COMENTARIOS_PUBLICOS_MAXIMO"),
    avaliacoesGestorMaximo: inteiro("AVALIACOES_GESTOR_MAXIMO"),
    bancoConexoesMaximas: inteiro("BANCO_CONEXOES_MAXIMAS"),
    bancoTimeoutConexaoMs: inteiro("BANCO_TIMEOUT_CONEXAO_MS"),
    bancoTimeoutOciosoMs: inteiro("BANCO_TIMEOUT_OCIOSO_MS")
  });
}

module.exports = { lerConfig, PADROES };
