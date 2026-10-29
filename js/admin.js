
/*
 * AVALIE O ATENDIMENTO
 * Moderação administrativa — modo DEMO
 *
 * Importante:
 * Esta implementação NÃO autentica administradores.
 * No modo API, a moderação fica bloqueada até que
 * exista autenticação e autorização no backend.
 */

const STORAGE_KEY =
  "cloud-challenge-avaliacoes-demo-v1";

const SERVICES = {
  1: "Secretaria",
  2: "Biblioteca",
  3: "Cantina",
  4: "Laboratórios"
};

const $ = id => document.getElementById(id);

const IS_DEMO =
  window.APP_CONFIG?.mode === "demo";

let comments = [];

function escapeHTML(value) {
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

function showMessage(message, type = "") {
  const element = $("adminMessage");
  element.textContent = message;
  element.className = `admin-message ${type}`;
}

function readReviews() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao ler avaliações:", error);
    showMessage(
      "Não foi possível ler os dados locais.",
      "error"
    );
    return [];
  }
}

function saveReviews(reviews) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(reviews)
  );
}

function loadComments() {
  const reviews = readReviews();

  comments = reviews.filter(
    item =>
      typeof item.comment === "string" &&
      item.comment.trim().length > 0
  );

  render();
}

function renderMetrics() {
  $("totalComments").textContent = comments.length;

  $("visibleComments").textContent =
    comments.filter(item => !item.hidden).length;

  $("hiddenComments").textContent =
    comments.filter(item => item.hidden).length;
}

function getFilteredComments() {
  const service = $("serviceFilter").value;
  const status = $("statusFilter").value;

  return comments
    .filter(item => {
      if (
        service !== "all" &&
        String(item.serviceId) !== service
      ) {
        return false;
      }

      if (status === "visible" && item.hidden) {
        return false;
      }

      if (status === "hidden" && !item.hidden) {
        return false;
      }

      return true;
    })
    .slice()
    .reverse();
}

function renderComments() {
  const container = $("commentsList");
  const filtered = getFilteredComments();

  if (!filtered.length) {
    container.innerHTML = `
      <p class="empty">
        Nenhum comentário encontrado para os filtros.
      </p>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const serviceName =
      SERVICES[item.serviceId] || "Serviço";

    const score = Number(item.score);

    const stars = Number.isInteger(score)
      ? "★".repeat(Math.max(0, Math.min(5, score)))
      : "";

    const statusLabel = item.hidden
      ? "Oculto"
      : "Visível";

    const statusClass = item.hidden
      ? "hidden-status"
      : "visible";

    return `
      <article class="comment-card">
        <div class="comment-top">
          <div>
            <strong>${escapeHTML(serviceName)}</strong>
            <div class="comment-meta">
              Nota: ${stars}
            </div>
          </div>

          <span class="status ${statusClass}">
            ${statusLabel}
          </span>
        </div>

        <p class="comment-text">
          ${escapeHTML(item.comment)}
        </p>

        <div class="comment-bottom">
          <span class="comment-meta">
            A nota permanece nos indicadores.
          </span>

          <button
            type="button"
            class="action-button"
            data-id="${escapeHTML(item.id)}"
          >
            ${item.hidden ? "Reexibir" : "Ocultar"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function render() {
  renderMetrics();
  renderComments();
}

function toggleComment(id) {
  if (!IS_DEMO) return;

  const reviews = readReviews();

  const item = reviews.find(
    review => String(review.id) === String(id)
  );

  if (!item) {
    showMessage(
      "Comentário não encontrado.",
      "error"
    );
    return;
  }

  const nextHidden = !item.hidden;

  item.hidden = nextHidden;

  try {
    saveReviews(reviews);
    loadComments();

    showMessage(
      nextHidden
        ? "Comentário ocultado. A nota foi preservada."
        : "Comentário reexibido com sucesso.",
      "ok"
    );
  } catch (error) {
    console.error("Erro ao salvar moderação:", error);

    showMessage(
      "Não foi possível salvar a alteração.",
      "error"
    );
  }
}

function initialize() {
  if (!IS_DEMO) {
    $("modeBadge").textContent =
      "Administração indisponível";

    $("commentsList").innerHTML = `
      <p class="empty">
        A moderação real exige autenticação e
        autorização no backend.
      </p>
    `;

    $("refreshButton").disabled = true;
    $("serviceFilter").disabled = true;
    $("statusFilter").disabled = true;

    return;
  }

  $("modeBadge").textContent = "Modo demonstração";
  $("demoNotice").hidden = false;

  $("serviceFilter").addEventListener(
    "change",
    renderComments
  );

  $("statusFilter").addEventListener(
    "change",
    renderComments
  );

  $("refreshButton").addEventListener(
    "click",
    loadComments
  );

  $("commentsList").addEventListener(
    "click",
    event => {
      const button = event.target.closest(
        "button[data-id]"
      );

      if (!button) return;

      toggleComment(button.dataset.id);
    }
  );

  window.addEventListener(
    "storage",
    event => {
      if (event.key === STORAGE_KEY) {
        loadComments();
      }
    }
  );

  loadComments();
}

initialize();
