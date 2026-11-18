// Validação das entradas no servidor. O front-end também valida, mas só esta
// camada vale: quem chama a API direto não passa pelo formulário.

const MAX_COMENTARIO = 280;

function ehInteiro(valor) {
  return typeof valor === "number" && Number.isInteger(valor);
}

// Devolve { erros: [...], dados } com os campos já limpos.
function validarAvaliacao(corpo) {
  const erros = [];
  const entrada = corpo && typeof corpo === "object" && !Array.isArray(corpo) ? corpo : {};

  if (!ehInteiro(entrada.servico_id) || entrada.servico_id < 1) {
    erros.push("servico_id deve ser um número inteiro positivo.");
  }

  // Nota 0, 6, 3.5, "5" (texto) e null são recusadas.
  if (!ehInteiro(entrada.nota) || entrada.nota < 1 || entrada.nota > 5) {
    erros.push("nota deve ser um número inteiro de 1 a 5.");
  }

  let comentario = null;
  if (entrada.comentario !== undefined && entrada.comentario !== null) {
    if (typeof entrada.comentario !== "string") {
      erros.push("comentario deve ser um texto.");
    } else {
      const texto = entrada.comentario.trim();
      // Conta caracteres, não bytes: emoji e acento valem 1.
      if (Array.from(texto).length > MAX_COMENTARIO) {
        erros.push(`comentario deve ter no máximo ${MAX_COMENTARIO} caracteres.`);
      } else if (texto.length > 0) {
        comentario = texto;
      }
    }
  }

  return {
    erros,
    dados: { servico_id: entrada.servico_id, nota: entrada.nota, comentario }
  };
}

module.exports = { validarAvaliacao, MAX_COMENTARIO };
