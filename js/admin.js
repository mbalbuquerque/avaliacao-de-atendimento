
/*
 * AVALIE O ATENDIMENTO
 * Moderação administrativa
 *
 * Modo API: exige sessão do gestor criada pelo servidor (cookie HttpOnly).
 * Lista em GET /api/admin/avaliacoes e oculta/reexibe com
 * PATCH /api/admin/avaliacoes/:id. A nota nunca sai dos indicadores.
 * Nenhuma senha ou token é guardado no navegador.
 *
 * Modo demo (só por escolha, ?modo=demo): dados locais, SEM autenticação.
 */

const STORAGE_KEY =
  "cloud-challenge-avaliacoes-demo-v1";

const SERVICES = {
  1: "Secretaria",
  2: "Biblioteca",
  3: "Cantina",
  4: "Laboratórios"
};

const SERVICE_IDS = Object.fromEntries(
  Object.entries(SERVICES).map(([id, name]) => [name, Number(id)])
);

const $ = id => document.getElementById(id);

const IS_DEMO =
  window.APP_CONFIG?.mode === "demo";

// Lista do mais antigo para o mais novo; a tela mostra o inverso.
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

function goToLogin() {
  window.location.replace("admin-login.html");
}

// Traduz o erro da API em texto para o gestor; 401 devolve ao login.
function handleAPIError(error, fallback) {
  console.error(fallback, error);

  if (error.status === 401) {
    goToLogin();
    return;
  }

  if (error.status === 403) {
    showMessage("Acesso administrativo não autorizado.", "error");
    return;
  }

  if (error.status === 503) {
    showMessage(
      "Serviço indisponível no momento. Tente novamente em instantes.",
      "error"
    );
    return;
  }

  if (error.status === 0) {
    showMessage(error.message, "error");
    return;
  }

  showMessage(error.message || fallback, "error");
}

/* ---------------------------------------------------------------
   Dados: demo (localStorage)
--------------------------------------------------------------- */

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

function loadLocalComments() {
  comments = readReviews()
    .filter(
      item =>
        typeof item.comment === "string" &&
        item.comment.trim().length > 0
    );

  render();
}

/* ---------------------------------------------------------------
   Dados: API
--------------------------------------------------------------- */

// Contrato do servidor -> formato interno das telas.
function fromAPI(item) {
  return {
    id: item.id,
    serviceId: SERVICE_IDS[item.servico],
    serviceName: item.servico,
    score: item.nota,
    comment: item.comentario,
    hidden: item.oculta === true
  };
}

async function loadAPIComments() {
  try {
    const list = await AvalieAPI.listarAvaliacoesAdmin();

    if (!Array.isArray(list)) {
      throw new Error("Formato de avaliações inválido.");
    }

    // A API devolve do mais novo para o mais antigo.
    comments = list
      .map(fromAPI)
      .filter(
        item =>
          typeof item.comment === "string" &&
          item.comment.trim().length > 0
      )
      .reverse();

    render();
  } catch (error) {
    handleAPIError(
      error,
      "Não foi possível carregar os comentários."
    );
  }
}

function loadComments() {
  return IS_DEMO ? loadLocalComments() : loadAPIComments();
}

/* ---------------------------------------------------------------
   Apresentação
--------------------------------------------------------------- */

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
      item.serviceName || SERVICES[item.serviceId] || "Serviço";

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

/* ---------------------------------------------------------------
   Moderação
--------------------------------------------------------------- */

function confirmationText(hidden) {
  return hidden
    ? "Comentário ocultado. A nota foi preservada."
    : "Comentário reexibido com sucesso.";
}

async function toggleViaAPI(id) {
  const item = comments.find(
    comment => String(comment.id) === String(id)
  );

  if (!item) {
    showMessage("Comentário não encontrado.", "error");
    return;
  }

  try {
    // Só atualiza a tela depois que o servidor confirmou (HTTP 200).
    const result = await AvalieAPI.moderarAvaliacao(
      item.id,
      !item.hidden
    );

    item.hidden = result.oculta === true;
    render();
    showMessage(confirmationText(item.hidden), "ok");
  } catch (error) {
    handleAPIError(
      error,
      "Não foi possível salvar a alteração."
    );
  }
}

function toggleLocal(id) {
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
    loadLocalComments();

    showMessage(confirmationText(nextHidden), "ok");
  } catch (error) {
    console.error("Erro ao salvar moderação:", error);

    showMessage(
      "Não foi possível salvar a alteração.",
      "error"
    );
  }
}

function toggleComment(id) {
  return IS_DEMO ? toggleLocal(id) : toggleViaAPI(id);
}

/* ---------------------------------------------------------------
   Sessão
--------------------------------------------------------------- */

async function logout(event) {
  event.preventDefault();

  try {
    await AvalieAPI.sairAdmin();
  } catch (error) {
    // Mesmo sem resposta, volta ao login; o cookie expira sozinho.
    console.error("Erro ao encerrar a sessão:", error);
  }

  goToLogin();
}

/* ---------------------------------------------------------------
   Inicialização
--------------------------------------------------------------- */

function bindEvents() {
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
}

async function initialize() {
  bindEvents();

  if (IS_DEMO) {
    $("modeBadge").textContent = "Modo demonstração";
    $("demoNotice").hidden = false;

    window.addEventListener(
      "storage",
      event => {
        if (event.key === STORAGE_KEY) {
          loadLocalComments();
        }
      }
    );

    loadLocalComments();
    return;
  }

  $("modeBadge").textContent = "Verificando sessão...";
  $("refreshButton").disabled = true;

  try {
    // Sem sessão válida o servidor responde 401 e a tela volta ao login.
    const sessao = await AvalieAPI.adminMe();

    $("modeBadge").textContent =
      `Gestor: ${sessao.usuario}`;

    $("refreshButton").disabled = false;

    const sair = $("logoutLink");
    sair.hidden = false;
    sair.addEventListener("click", logout);

    await loadAPIComments();
  } catch (error) {
    $("modeBadge").textContent = "Sem acesso";
    $("commentsList").innerHTML = `
      <p class="empty">
        Não foi possível abrir a moderação.
      </p>
    `;

    handleAPIError(
      error,
      "Não foi possível verificar a sessão."
    );
  }
}

initialize();
