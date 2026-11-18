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

function safe(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char])
  );
}

function showMessage(text, type = "erro") {
  const element = $("formMessage");
  if (!element) return;

  element.textContent = text;
  element.className = `mensagem mensagem--${type === "ok" ? "ok" : "erro"}`;
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

  $("services").innerHTML = indicators.map(service => {
    const count = service.quantidade;

    const average = service.amostra_suficiente
      ? formatAverage(service.media)
      : null;

    const counts = [5, 4, 3, 2, 1].map(
      note => ({ note, value: service.distribuicao[String(note)] || 0 })
    );

    return `
      <li class="servico">
        <div class="servico-topo">
          <div>
            <strong>${safe(service.nome)}</strong>
            <small>${count} ${count === 1 ? "avaliação" : "avaliações"}</small>
          </div>

          ${
            average === null
              ? '<span class="selo selo--aviso">Amostra insuficiente</span>'
              : `<span class="media">${average} <small aria-hidden="true">★</small><span class="sr-only">de 5</span></span>`
          }
        </div>

        <ul class="distribuicao" aria-label="Distribuição das notas de ${safe(service.nome)}">
          ${counts.map(({ note, value }) => `
            <li>
              <span>${note}★</span>
              <progress class="barra" max="100" value="${count ? Math.round(value / count * 100) : 0}"
                aria-label="${note} estrelas: ${value} de ${count}"></progress>
              <span class="quantidade">${value}</span>
            </li>
          `).join("")}
        </ul>
      </li>
    `;
  }).join("");
}

/* ==================================================
   COMENTÁRIOS PÚBLICOS
================================================== */

function renderComments() {
  if (!$("comments")) return;

  $("comments").innerHTML = publicComments.length
    ? publicComments.map(item => `
        <li class="comentario">
          <header>
            <strong>${safe(item.servico)}</strong>
            <span class="nota-estrelas" role="img"
              aria-label="Nota ${safe(item.nota)} de 5">${starText(item.nota)}</span>
          </header>

          <p>${safe(item.comentario)}</p>
        </li>
      `).join("")
    : '<li class="vazio">Nenhum comentário público ainda. Seja a primeira pessoa a comentar.</li>';
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
    box.innerHTML = `
      <li class="vazio">
        Não foi possível carregar os indicadores agora.
        <br>
        <button type="button" class="btn btn-secundaria" id="retryLoad">Tentar de novo</button>
      </li>
    `;

    $("retryLoad").addEventListener("click", initialize);
  }

  if ($("comments")) {
    $("comments").innerHTML = "";
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

  if ($("services")) {
    $("services").innerHTML =
      '<li class="esqueleto" aria-hidden="true"></li><li class="esqueleto" aria-hidden="true"></li>';
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
