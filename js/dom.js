/* exported el, preencher */
/*
 * AVALIE O ATENDIMENTO
 * Construção segura de elementos.
 *
 * O texto das avaliações vem de qualquer estudante. Em vez de montar HTML como texto
 * (e escapar cada valor à mão, o que falha no primeiro esquecimento), as telas
 * criam os elementos aqui: todo texto entra como nó de texto e nunca é
 * interpretado como HTML.
 *
 * Atributos que executam código ou carregam recurso (on*, style, href, src,
 * srcdoc, action...) são recusados: valor vindo da API nunca pode ir parar neles.
 */

const ATRIBUTOS_PROIBIDOS = /^(on|style$|href$|src$|srcdoc$|action$|formaction$|xlink:)/i;

function anexarFilhos(no, filhos) {
  for (const filho of filhos.flat(Infinity)) {
    if (filho === null || filho === undefined || filho === false) continue;
    no.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
}

// el("li", { class: "x", "data-id": 7 }, "texto", outroElemento, [lista, de, filhos])
function el(tag, atributos, ...filhos) {
  const no = document.createElement(tag);

  for (const [nome, valor] of Object.entries(atributos || {})) {
    if (valor === null || valor === undefined || valor === false) continue;

    if (ATRIBUTOS_PROIBIDOS.test(nome)) {
      throw new Error(`Atributo não permitido: ${nome}`);
    }

    no.setAttribute(nome, valor === true ? "" : String(valor));
  }

  anexarFilhos(no, filhos);
  return no;
}

// Troca todo o conteúdo do container pelos filhos informados.
function preencher(container, ...filhos) {
  container.replaceChildren();
  anexarFilhos(container, filhos);
}
