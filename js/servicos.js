/* global el */
/* exported preencherSelectServicos */
/*
 * AVALIE O ATENDIMENTO
 * Serviços avaliados.
 *
 * Os serviços moram no banco (GET /api/servicos). Nenhum nome nem id de serviço fica escrito no
 * HTML ou no JavaScript: cada tela monta as opções do seu <select> a partir da resposta da API,
 * então um serviço novo no banco aparece sem mudar o front-end.
 */

let promessaServicos = null;

// Carrega a lista uma vez por página. Um erro não fica guardado: a próxima chamada tenta de novo.
function carregarServicos() {
  if (!promessaServicos) {
    promessaServicos = AvalieAPI.listarServicos()
      .then(lista => {
        const valida = Array.isArray(lista) && lista.every(
          servico => Number.isInteger(servico?.id) && typeof servico?.nome === "string"
        );

        if (!valida) {
          throw new Error("Formato de serviços inválido.");
        }

        return lista;
      })
      .catch(erro => {
        promessaServicos = null;
        throw erro;
      });
  }

  return promessaServicos;
}

// Preenche o <select> com os serviços da API. A primeira <option> do HTML (texto neutro) é mantida.
// O select fica desabilitado enquanto carrega, e continua desabilitado se a API falhar ou vier vazia.
// Devolve a lista; lança o erro da API para a tela mostrar a mensagem no lugar certo.
// `valorDe(servico)` escolhe o que vai no value (id para o formulário e o dashboard, nome no gestor).
async function preencherSelectServicos(select, valorDe) {
  select.disabled = true;
  select.setAttribute("aria-busy", "true");

  try {
    const servicos = await carregarServicos();

    // Tentativa anterior: remove as opções antigas e mantém só a primeira (neutra).
    while (select.options.length > 1) {
      select.remove(1);
    }

    for (const servico of servicos) {
      select.append(el("option", { value: valorDe(servico) }, servico.nome));
    }

    select.disabled = servicos.length === 0;
    return servicos;
  } finally {
    select.removeAttribute("aria-busy");
  }
}
