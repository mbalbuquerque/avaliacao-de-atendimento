
/*
 * AVALIE O ATENDIMENTO
 * Cloud Challenge — Grupo 1
 *
 * Frontend preparado para:
 * - Modo DEMO: localStorage
 * - Modo API: backend + PostgreSQL
 *
 * As avaliações são anônimas.
 */

const SERVICES = [
  { id: 1, name: "Secretaria" },
  { id: 2, name: "Biblioteca" },
  { id: 3, name: "Cantina" },
  { id: 4, name: "Laboratórios" }
];

const KEY = "cloud-challenge-avaliacoes-demo-v1";

const CONFIG = window.APP_CONFIG || {
  mode: "demo",
  apiBaseUrl: "/api",
  requestTimeout: 10000
};

const API_MODE = CONFIG.mode === "api";

const $ = id => document.getElementById(id);

let reviews = [];
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

function showMessage(text, type = "error") {
  const element = $("formMessage");
  if (!element) return;

  element.textContent = text;
  element.className = `message ${type}`;
  element.setAttribute("role", "status");
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

function getServiceName(id) {
  return SERVICES.find(
    service => service.id === Number(id)
  )?.name || "Serviço";
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

/* ==================================================
   MODO DEMONSTRAÇÃO
================================================== */

function loadLocalReviews() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(KEY) || "[]"
    );

    reviews = Array.isArray(parsed)
      ? parsed.filter(item =>
          SERVICES.some(
            service => service.id === Number(item.serviceId)
          ) &&
          Number.isInteger(item.score) &&
          item.score >= 1 &&
          item.score <= 5 &&
          typeof item.comment === "string"
        )
      : [];

  } catch (error) {
    console.error(
      "Erro ao ler avaliações locais:",
      error
    );

    reviews = [];
  }
}

function saveLocalReviews() {
  localStorage.setItem(KEY, JSON.stringify(reviews));
}

/* ==================================================
   ESTRELAS
================================================== */

function drawStars() {
  document.querySelectorAll("[data-score]").forEach(
    button => {
      const value = Number(button.dataset.score);
      const active = value <= score;

      button.classList.toggle("active", active);

      button.setAttribute(
        "aria-pressed",
        String(value === score)
      );
    }
  );

  if ($("ratingHint")) {
    $("ratingHint").textContent = score
      ? `Nota selecionada: ${score} de 5`
      : "Selecione de 1 a 5 estrelas";
  }
}

document.querySelectorAll("[data-score]").forEach(
  button => {
    button.addEventListener("click", () => {
      if (sending) return;

      score = Number(button.dataset.score);
      drawStars();
    });
  }
);

/* ==================================================
   CONTADOR DE CARACTERES
================================================== */

if ($("comment")) {
  $("comment").addEventListener("input", () => {
    $("chars").textContent =
      `${$("comment").value.length}/280`;
  });
}

/* ==================================================
   INDICADORES DEMONSTRATIVOS
================================================== */

function calculateLocalIndicators() {
  return SERVICES.map(service => {
    const items = reviews.filter(
      item => item.serviceId === service.id
    );

    const count = items.length;

    const sum = items.reduce(
      (total, item) => total + item.score,
      0
    );

    const distribution = {};

    for (let note = 1; note <= 5; note++) {
      distribution[String(note)] = items.filter(
        item => item.score === note
      ).length;
    }

    return {
      servico_id: service.id,
      nome: service.name,
      quantidade: count,
      media: count >= 3 ? sum / count : null,
      amostra_suficiente: count >= 3,
      distribuicao: distribution
    };
  });
}

/* ==================================================
   NORMALIZAÇÃO DE INDICADORES
================================================== */

function normalizeIndicators(data) {
  if (!Array.isArray(data)) {
    throw new Error(
      "Formato de indicadores inválido."
    );
  }

  return SERVICES.map(service => {
    const item = data.find(
      entry => Number(entry.servico_id) === service.id
    );

    const count = Number(item?.quantidade ?? 0);

    const distribution = {};

    for (let note = 1; note <= 5; note++) {
      distribution[String(note)] = Number(
        item?.distribuicao?.[String(note)] ?? 0
      );
    }

    return {
      servico_id: service.id,
      nome: service.name,
      quantidade: count,
      media: count >= 3 && item?.amostra_suficiente === true
        ? item.media
        : null,
      amostra_suficiente:
        count >= 3 && item?.amostra_suficiente === true,
      distribuicao: distribution
    };
  });
}

/* ==================================================
   RENDERIZAÇÃO DOS INDICADORES
================================================== */

function renderIndicators() {
  const data = API_MODE
    ? indicators
    : calculateLocalIndicators();

  if ($("total")) {
    $("total").textContent = data.reduce(
      (total, item) => total + item.quantidade,
      0
    );
  }

  if ($("serviceCount")) {
    $("serviceCount").textContent = SERVICES.length;
  }

  if (!$("services")) return;

  $("services").innerHTML = data.map(service => {
    const count = service.quantidade;

    const average = service.amostra_suficiente
      ? formatAverage(service.media)
      : null;

    const counts = [1, 2, 3, 4, 5].map(
      note => service.distribuicao[String(note)] || 0
    );

    return `
      <article class="service-card">
        <div class="service-top">
          <div>
            <strong>${safe(service.nome)}</strong>
            <small>
              ${count}
              ${count === 1 ? "avaliação" : "avaliações"}
            </small>
          </div>

          ${
            average === null
              ? '<span class="insufficient">Amostra insuficiente</span>'
              : `<span class="average">${average} <small>★</small></span>`
          }
        </div>

        <div
          class="distribution"
          aria-label="Distribuição das notas 1 a 5"
        >
          ${counts.map(value => `
            <span>
              <i style="width:${
                count ? value / count * 100 : 0
              }%"></i>
            </span>
          `).join("")}
        </div>

        <div class="distribution-label">
          Distribuição de notas:
          ${counts.map(
            (value, index) => `${index + 1}★ ${value}`
          ).join(" · ")}
        </div>
      </article>
    `;
  }).join("");
}

/* ==================================================
   COMENTÁRIOS PÚBLICOS
================================================== */

function renderComments() {
  if (!$("comments")) return;

  const visible = API_MODE
    ? publicComments
    : reviews
        .filter(item =>
          !item.hidden && item.comment.trim()
        )
        .slice()
        .reverse()
        .map(item => ({
          id: item.id,
          servico: getServiceName(item.serviceId),
          nota: item.score,
          comentario: item.comment
        }));

  $("comments").innerHTML = visible.length
    ? visible.map(item => {
        const stars = Number.isInteger(Number(item.nota))
          ? "★".repeat(
              Math.max(0, Math.min(5, Number(item.nota)))
            )
          : "";

        return `
          <article class="comment-item">
            <header>
              <span>${safe(item.servico)}</span>
              <span>${stars}</span>
            </header>

            <p>${safe(item.comentario)}</p>
          </article>
        `;
      }).join("")
    : '<p class="empty">Nenhum comentário público registrado ainda.</p>';
}

/* ==================================================
   MODERAÇÃO LOCAL — SOMENTE DEMONSTRAÇÃO
================================================== */

function renderModeration() {
  const container = $("moderation");

  if (!container) return;

  if (API_MODE) {
    const panel = container.closest(".admin-panel");

    if (panel) {
      panel.hidden = true;
    } else {
      container.textContent =
        "Moderação disponível apenas na área administrativa.";
    }

    return;
  }

  const withComments = reviews
    .filter(item => item.comment.trim())
    .slice()
    .reverse();

  container.innerHTML = withComments.length
    ? withComments.map(item => `
        <article class="comment-item">
          <header>
            <span>
              ${safe(getServiceName(item.serviceId))}
              · ${item.hidden ? "Oculto" : "Visível"}
            </span>

            <button
              type="button"
              data-toggle="${safe(item.id)}"
            >
              ${item.hidden ? "Reexibir" : "Ocultar"}
            </button>
          </header>

          <p>${safe(item.comment)}</p>
        </article>
      `).join("")
    : '<p class="empty">Nenhum comentário para moderar.</p>';

  container.querySelectorAll("[data-toggle]").forEach(
    button => {
      button.addEventListener("click", () => {
        const item = reviews.find(
          review => review.id === button.dataset.toggle
        );

        if (!item) return;

        item.hidden = !item.hidden;

        saveLocalReviews();
        render();
      });
    }
  );
}

/* ==================================================
   RENDERIZAÇÃO GERAL
================================================== */

function render() {
  renderIndicators();
  renderComments();
  renderModeration();
}

/* ==================================================
   CARREGAMENTO DA API
================================================== */

async function loadAPIData() {
  if (
    typeof AvalieAPI === "undefined" ||
    !AvalieAPI.buscarIndicadores ||
    !AvalieAPI.listarComentarios
  ) {
    throw new Error(
      "A camada de integração com a API não foi carregada."
    );
  }

  const [indicatorData, commentData] = await Promise.all([
    AvalieAPI.buscarIndicadores(),
    AvalieAPI.listarComentarios()
  ]);

  if (!Array.isArray(commentData)) {
    throw new Error(
      "Formato de comentários inválido."
    );
  }

  indicators = normalizeIndicators(indicatorData);

  publicComments = commentData.filter(
    item =>
      typeof item.comentario === "string" &&
      item.comentario.trim()
  );

  render();
}

/* ==================================================
   VALIDAÇÃO DO FORMULÁRIO
================================================== */

function validateReview(serviceId, comment) {
  const validService = SERVICES.some(
    service => service.id === serviceId
  );

  if (!validService) {
    return "Selecione um serviço válido.";
  }

  if (
    !Number.isInteger(score) ||
    score < 1 ||
    score > 5
  ) {
    return "Selecione uma nota de 1 a 5 estrelas.";
  }

  if (comment.length > 280) {
    return "O comentário deve ter no máximo 280 caracteres.";
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

  const validationError = validateReview(
    serviceId,
    comment
  );

  if (validationError) {
    showMessage(validationError);
    return;
  }

  if (API_MODE && !navigator.onLine) {
    showMessage(
      "Você está offline. Conecte-se à internet para enviar sua avaliação."
    );
    return;
  }

  setSending(true);

  try {
    if (API_MODE) {
      if (
        typeof AvalieAPI === "undefined" ||
        !AvalieAPI.enviarAvaliacao
      ) {
        throw new Error(
          "Serviço de avaliação indisponível."
        );
      }

      await AvalieAPI.enviarAvaliacao({
        servico_id: serviceId,
        nota: score,
        comentario: comment
      });

      // A API confirmou o registro.
      // Não reenviar caso a atualização dos gráficos falhe.
      $("reviewForm").reset();
      score = 0;
      drawStars();

      if ($("chars")) {
        $("chars").textContent = "0/280";
      }

      showMessage(
        "Avaliação recebida pelo servidor com sucesso!",
        "ok"
      );

      try {
        await loadAPIData();
      } catch (refreshError) {
        console.error(
          "Falha ao atualizar os indicadores:",
          refreshError
        );

        showMessage(
          "Avaliação registrada! Os indicadores não puderam ser atualizados agora.",
          "ok"
        );
      }

    } else {
      reviews.push({
        id: crypto.randomUUID(),
        serviceId,
        score,
        comment,
        hidden: false,
        createdAt: new Date().toISOString()
      });

      saveLocalReviews();
      render();

      $("reviewForm").reset();

      score = 0;
      drawStars();

      if ($("chars")) {
        $("chars").textContent = "0/280";
      }

      showMessage(
        "Avaliação registrada nesta demonstração local!",
        "ok"
      );
    }

  } catch (error) {
    console.error(
      "Erro ao registrar avaliação:",
      error
    );

    showMessage(
      error.message ||
      "Não foi possível registrar a avaliação."
    );

  } finally {
    setSending(false);
  }
}

/* ==================================================
   INICIALIZAÇÃO
================================================== */

async function initialize() {
  drawStars();

  if (API_MODE) {
    // Não apresentar dados antigos do localStorage
    // como se fossem registros reais da API.
    indicators = normalizeIndicators([]);
    publicComments = [];

    render();

    try {
      await loadAPIData();
    } catch (error) {
      console.error(
        "Erro ao carregar dados da API:",
        error
      );

      showMessage(
        "Não foi possível carregar os dados do servidor."
      );
    }

  } else {
    loadLocalReviews();
    render();
  }
}

if ($("reviewForm")) {
  $("reviewForm").addEventListener(
    "submit",
    submitReview
  );
}

initialize();
