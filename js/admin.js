/* global el, preencher, preencherSelectServicos */

/*
 * AVALIE O ATENDIMENTO
 * Moderação administrativa
 *
 * Exige sessão do gestor criada pelo servidor (cookie HttpOnly).
 * Lista em GET /api/admin/avaliacoes e oculta/reexibe com
 * PATCH /api/admin/avaliacoes/:id. A nota nunca sai dos indicadores.
 * Nenhuma senha ou token é guardado no navegador.
 */

const $ = id => document.getElementById(id);

// Lista do mais antigo para o mais novo; a tela mostra o inverso.
let comments = [];

function showMessage(message, type = "") {
  const element = $("adminMessage");
  element.textContent = message;
  element.className = `mensagem ${
    type === "ok" ? "mensagem--ok" : type === "error" ? "mensagem--erro" : ""
  }`.trim();
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
   Dados do servidor
--------------------------------------------------------------- */

// Contrato do servidor -> formato interno das telas.
function fromAPI(item) {
  return {
    id: item.id,
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
        item.serviceName !== service
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
    preencher(
      container,
      el("p", { class: "vazio" }, "Nenhum comentário encontrado para os filtros escolhidos.")
    );
    return;
  }

  preencher(container, filtered.map(item => {
    const serviceName = item.serviceName || "Serviço";

    const score = Math.max(0, Math.min(5, Number(item.score) || 0));

    const hidden = item.hidden === true;

    return el("article",
      { class: `cartao-comentario${hidden ? " cartao-comentario--oculto" : ""}` },
      el("header", null,
        el("div", null,
          el("strong", null, serviceName),
          el("div",
            { class: "nota-estrelas", role: "img", "aria-label": `Nota ${score} de 5` },
            "★".repeat(score) + "☆".repeat(5 - score))),
        el("span",
          { class: `selo ${hidden ? "selo--aviso" : "selo--ok"}` },
          hidden ? "Oculto" : "Visível")),
      el("p", null, item.comment),
      el("footer", null,
        el("span", { class: "texto-apoio" }, "A nota continua nos indicadores."),
        el("button",
          { type: "button", class: "btn btn-secundaria", "data-id": String(item.id) },
          hidden ? "Reexibir" : "Ocultar")));
  }));
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

function toggleComment(id) {
  return toggleViaAPI(id);
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
   Filtro de serviços (vêm do servidor: nada escrito no HTML)
--------------------------------------------------------------- */

async function loadServiceFilter() {
  try {
    // A lista de moderação traz o nome do serviço, então o filtro usa o nome.
    await preencherSelectServicos(
      $("serviceFilter"),
      service => service.nome
    );
  } catch (error) {
    handleAPIError(
      error,
      "Não foi possível carregar a lista de serviços."
    );
  }
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
    loadAPIComments
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

    await Promise.all([loadServiceFilter(), loadAPIComments()]);
  } catch (error) {
    $("modeBadge").textContent = "Sem acesso";
    preencher(
      $("commentsList"),
      el("p", { class: "vazio" }, "Não foi possível abrir a moderação.")
    );

    handleAPIError(
      error,
      "Não foi possível verificar a sessão."
    );
  }
}

initialize();
