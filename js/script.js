/* global el, preencher, preencherSelectServicos */
/*
 * AVALIE O ATENDIMENTO
 * Cloud Challenge — Grupo 1
 *
 * Página pública: formulário de avaliação, indicadores e comentários.
 * Tudo vem do servidor (/api); nada é guardado no navegador.
 * As avaliações são anônimas.
 */

const $ = id => document.getElementById(id);

const MAX_COMMENT = 280;

let indicators = [];
let publicComments = [];
let score = 0;
let sending = false;

/* ==================================================
   UTILITÁRIOS
================================================== */

function showMessage(text, type = "erro") {
  const element = $("formMessage");
  if (!element) return;

  element.textContent = text;
  element.className = text
    ? `mensagem mensagem--${type === "ok" ? "ok" : "erro"}`
    : "mensagem";
}

function formatAverage(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(1).replace(".", ",")
    : null;
}

function setSending(active) {
  sending = active;

  const button = document.querySelector(
    '#reviewForm button[type="submit"]'
  );

  if (!button) return;

  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent;
  }

  button.disabled = active;
  button.setAttribute("aria-busy", String(active));

  button.textContent = active
    ? "Enviando avaliação..."
    : button.dataset.originalText;
}

function starText(note) {
  const value = Math.max(0, Math.min(5, Number(note) || 0));
  return "★".repeat(value) + "☆".repeat(5 - value);
}

/* ==================================================
   NOTA (grupo de botões de rádio, navegável por teclado)
================================================== */

function updateRatingHint() {
  if ($("ratingHint")) {
    $("ratingHint").textContent = score
      ? `Nota selecionada: ${score} de 5`
      : "Selecione de 1 a 5 estrelas";
  }
}

document.querySelectorAll('input[name="nota"]').forEach(
  radio => {
    radio.addEventListener("change", () => {
      score = Number(radio.value);
      updateRatingHint();
    });
  }
);

/* ==================================================
   CONTADOR DE CARACTERES
================================================== */

if ($("comment")) {
  $("comment").addEventListener("input", () => {
    $("chars").textContent =
      `${Array.from($("comment").value).length}/${MAX_COMMENT}`;
  });
}

/* ==================================================
   INDICADORES (calculados pelo PostgreSQL)
================================================== */

function normalizeIndicators(data) {
  if (!Array.isArray(data)) {
    throw new Error("Formato de indicadores inválido.");
  }

  return data.map(item => {
    const count = Number(item.quantidade ?? 0);
    const sufficient =
      count >= 3 && item.amostra_suficiente === true;

    const distribution = {};

    for (let note = 1; note <= 5; note++) {
      distribution[String(note)] = Number(
        item.distribuicao?.[String(note)] ?? 0
      );
    }

    return {
      servico_id: item.servico_id,
      nome: item.nome,
      quantidade: count,
      media: sufficient ? item.media : null,
      amostra_suficiente: sufficient,
      distribuicao: distribution
    };
  });
}

function renderIndicators() {
  if ($("total")) {
    $("total").textContent = indicators.reduce(
      (total, item) => total + item.quantidade,
      0
    );
  }

  if ($("serviceCount")) {
    $("serviceCount").textContent = indicators.length;
  }

  if (!$("services")) return;

  preencher($("services"), indicators.map(service => {
    const count = service.quantidade;

    const average = service.amostra_suficiente
      ? formatAverage(service.media)
      : null;

    const counts = [5, 4, 3, 2, 1].map(
      note => ({ note, value: service.distribuicao[String(note)] || 0 })
    );

    return el("li", { class: "servico" },
      el("div", { class: "servico-topo" },
        el("div", null,
          el("strong", null, service.nome),
          el("small", null, `${count} ${count === 1 ? "avaliação" : "avaliações"}`)),
        average === null
          ? el("span", { class: "selo selo--aviso" }, "Amostra insuficiente")
          : el("span", { class: "media" },
            `${average} `,
            el("small", { "aria-hidden": "true" }, "★"),
            el("span", { class: "sr-only" }, "de 5"))),
      el("ul",
        { class: "distribuicao", "aria-label": `Distribuição das notas de ${service.nome}` },
        counts.map(({ note, value }) => el("li", null,
          el("span", null, `${note}★`),
          el("progress", {
            class: "barra",
            max: 100,
            value: count ? Math.round(value / count * 100) : 0,
            "aria-label": `${note} estrelas: ${value} de ${count}`
          }),
          el("span", { class: "quantidade" }, Number(value))))));
  }));
}

/* ==================================================
   COMENTÁRIOS PÚBLICOS
================================================== */

function renderComments() {
  if (!$("comments")) return;

  preencher($("comments"), publicComments.length
    ? publicComments.map(item => {
      const nota = Math.max(0, Math.min(5, Number(item.nota) || 0));

      return el("li", { class: "comentario" },
        el("header", null,
          el("strong", null, item.servico),
          el("span",
            { class: "nota-estrelas", role: "img", "aria-label": `Nota ${nota} de 5` },
            starText(nota))),
        el("p", null, item.comentario));
    })
    : el("li", { class: "vazio" }, "Nenhum comentário público ainda. Seja a primeira pessoa a comentar."));
}

/* ==================================================
   CARREGAMENTO
================================================== */

async function loadData() {
  const [indicatorData, commentData] = await Promise.all([
    AvalieAPI.buscarIndicadores(),
    AvalieAPI.listarComentarios()
  ]);

  if (!Array.isArray(commentData)) {
    throw new Error("Formato de comentários inválido.");
  }

  indicators = normalizeIndicators(indicatorData);

  publicComments = commentData.filter(
    item =>
      typeof item.comentario === "string" &&
      item.comentario.trim()
  );

  renderIndicators();
  renderComments();
}

function showLoadError() {
  const box = $("services");

  if (box) {
    const retry = el("button",
      { type: "button", class: "btn btn-secundaria", id: "retryLoad" },
      "Tentar de novo");
    retry.addEventListener("click", initialize);

    preencher(box, el("li", { class: "vazio" },
      "Não foi possível carregar os indicadores agora.",
      el("br"),
      retry));
  }

  if ($("comments")) {
    $("comments").replaceChildren();
  }
}

/* ==================================================
   SERVIÇOS (vêm do servidor: nada escrito no HTML)
================================================== */

let servicesErrorShown = false;

function setSubmitEnabled(enabled) {
  const button = document.querySelector(
    '#reviewForm button[type="submit"]'
  );

  if (button) button.disabled = !enabled;
}

async function loadServices() {
  const select = $("service");
  if (!select) return;

  const neutral = select.options[0];
  neutral.textContent = "Carregando serviços…";
  setSubmitEnabled(false);

  try {
    const services = await preencherSelectServicos(
      select,
      service => service.id
    );

    if (services.length === 0) {
      neutral.textContent = "Nenhum serviço disponível";
      servicesErrorShown = true;
      showMessage("Nenhum serviço está disponível para avaliação no momento.");
      return;
    }

    neutral.textContent = "Selecione um serviço";
    setSubmitEnabled(true);

    // Tentativa anterior falhou e esta deu certo: tira o aviso antigo.
    if (servicesErrorShown) {
      servicesErrorShown = false;
      showMessage("");
    }
  } catch (error) {
    console.error("Erro ao carregar os serviços:", error);

    neutral.textContent = "Serviços indisponíveis";
    servicesErrorShown = true;
    showMessage(
      error.message || "Não foi possível carregar a lista de serviços."
    );
  }
}

/* ==================================================
   VALIDAÇÃO DO FORMULÁRIO
================================================== */

function validateReview(serviceId, comment) {
  if (!Number.isInteger(serviceId) || serviceId < 1) {
    return "Selecione um serviço válido.";
  }

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return "Selecione uma nota de 1 a 5 estrelas.";
  }

  if (Array.from(comment).length > MAX_COMMENT) {
    return `O comentário deve ter no máximo ${MAX_COMMENT} caracteres.`;
  }

  return null;
}

/* ==================================================
   ENVIO DA AVALIAÇÃO
================================================== */

async function submitReview(event) {
  event.preventDefault();

  if (sending) return;

  // Sem a lista de serviços do servidor não há o que avaliar: nada é enviado.
  if ($("service").disabled) {
    showMessage(
      "A lista de serviços não foi carregada. Atualize a página e tente de novo."
    );
    return;
  }

  const serviceId = Number($("service").value);
  const comment = $("comment").value.trim();

  const validationError = validateReview(serviceId, comment);

  if (validationError) {
    showMessage(validationError);
    return;
  }

  if (!navigator.onLine) {
    showMessage(
      "Você está offline. Conecte-se à internet para enviar sua avaliação."
    );
    return;
  }

  setSending(true);

  try {
    // Só conta como enviada se o servidor responder 201 com o id gravado.
    await AvalieAPI.enviarAvaliacao({
      servico_id: serviceId,
      nota: score,
      comentario: comment
    });

    $("reviewForm").reset();
    score = 0;
    updateRatingHint();
    $("chars").textContent = `0/${MAX_COMMENT}`;

    showMessage("Avaliação recebida pelo servidor com sucesso!", "ok");

    // A avaliação já está gravada: se atualizar a tela falhar, não reenvia.
    try {
      await loadData();
    } catch (refreshError) {
      console.error("Falha ao atualizar os indicadores:", refreshError);

      showMessage(
        "Avaliação registrada! Os indicadores não puderam ser atualizados agora.",
        "ok"
      );
    }

  } catch (error) {
    console.error("Erro ao registrar avaliação:", error);

    showMessage(
      error.message || "Não foi possível registrar a avaliação."
    );

  } finally {
    setSending(false);
  }
}

/* ==================================================
   INICIALIZAÇÃO
================================================== */

async function initialize() {
  updateRatingHint();

  // Não espera: tem tratamento próprio de erro e não trava os indicadores.
  loadServices();

  if ($("services")) {
    preencher(
      $("services"),
      el("li", { class: "esqueleto", "aria-hidden": "true" }),
      el("li", { class: "esqueleto", "aria-hidden": "true" })
    );
  }

  try {
    await loadData();
  } catch (error) {
    console.error("Erro ao carregar dados da API:", error);

    showMessage(
      error.message || "Não foi possível carregar os dados do servidor."
    );
    showLoadError();
  }
}

if ($("reviewForm")) {
  $("reviewForm").addEventListener("submit", submitReview);
}

initialize();
