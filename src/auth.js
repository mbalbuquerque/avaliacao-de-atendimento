// Autenticação do gestor (moderação). Sem biblioteca extra: scrypt para a senha
// e HMAC-SHA256 para assinar a sessão. Nada fica em texto puro no código.

const crypto = require("crypto");
const { lerConfig } = require("./config");

const COOKIE = "sessao";

// Formato do hash guardado na variável de ambiente: scrypt$<sal em hex>$<hash em hex>
function gerarHash(senha) {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(senha, sal, 64);
  return `scrypt$${sal.toString("hex")}$${hash.toString("hex")}`;
}

function conferirSenha(senha, armazenado) {
  const partes = String(armazenado || "").split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;
  try {
    const esperado = Buffer.from(partes[2], "hex");
    const obtido = crypto.scryptSync(String(senha), Buffer.from(partes[1], "hex"), esperado.length);
    return esperado.length > 0 && crypto.timingSafeEqual(esperado, obtido);
  } catch {
    return false;
  }
}

function assinar(texto, segredo) {
  return crypto.createHmac("sha256", segredo).update(texto).digest("base64url");
}

// A validade vem da configuração (SESSAO_HORAS); sem ela, o padrão de src/config.js.
function criarSessao(usuario, segredo, agora = Date.now(), validadeMs = lerConfig().sessaoMs) {
  const carga = Buffer.from(JSON.stringify({ u: usuario, exp: agora + validadeMs })).toString("base64url");
  return `${carga}.${assinar(carga, segredo)}`;
}

// Devolve o nome do usuário ou null (assinatura inválida, adulterada ou vencida).
function lerSessao(token, segredo, agora = Date.now()) {
  if (!token || !segredo || typeof token !== "string") return null;
  const [carga, assinatura] = token.split(".");
  if (!carga || !assinatura) return null;

  const esperada = Buffer.from(assinar(carga, segredo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !crypto.timingSafeEqual(esperada, recebida)) return null;

  try {
    const dados = JSON.parse(Buffer.from(carga, "base64url").toString("utf8"));
    return typeof dados.u === "string" && dados.exp > agora ? dados.u : null;
  } catch {
    return null;
  }
}

function lerCookie(cabecalho, nome) {
  for (const parte of String(cabecalho || "").split(";")) {
    const [chave, ...resto] = parte.trim().split("=");
    if (chave === nome) {
      // Cookie com % inválido (ex.: "%%%") faz decodeURIComponent lançar erro: trata como ausente.
      try {
        return decodeURIComponent(resto.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

module.exports = { gerarHash, conferirSenha, criarSessao, lerSessao, lerCookie, COOKIE };
