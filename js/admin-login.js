
/*
 * AVALIE O ATENDIMENTO
 * Login administrativo
 *
 * A autenticação real depende do backend.
 * Nenhuma senha ou token é armazenado no localStorage.
 */

const CONFIG = window.APP_CONFIG || {
  mode: "demo",
  apiBaseUrl: "/api",
  requestTimeout: 10000
};

const IS_DEMO = CONFIG.mode === "demo";

const form = document.getElementById("loginForm");
const button = document.getElementById("loginButton");
const message = document.getElementById("loginMessage");
const notice = document.getElementById("demoNotice");

function showError(text) {
  message.textContent = text;
  message.className = "login-message error";
}

function setLoading(active) {
  button.disabled = active;
  button.textContent = active
    ? "Autenticando..."
    : "Entrar no painel";
}

async function login(username, password) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    CONFIG.requestTimeout || 10000
  );

  try {
    const response = await fetch(
      `${CONFIG.apiBaseUrl}/admin/login`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usuario: username,
          senha: password
        }),
        signal: controller.signal
      }
    );

    if (response.status === 401) {
      throw new Error("Usuário ou senha inválidos.");
    }

    if (response.status === 403) {
      throw new Error("Acesso administrativo não autorizado.");
    }

    if (!response.ok) {
      throw new Error(
        "Não foi possível autenticar. Tente novamente."
      );
    }

    // O backend deverá criar uma sessão segura.
    // A resposta 2xx não substitui a validação
    // de sessão e permissão nos endpoints protegidos.
    return true;

  } finally {
    clearTimeout(timeout);
  }
}

if (IS_DEMO) {
  notice.hidden = false;
  form.hidden = true;
} else {
  notice.hidden = true;
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (IS_DEMO) return;

  const username =
    document.getElementById("username").value.trim();

  const password =
    document.getElementById("password").value;

  if (!username || !password) {
    showError("Informe seu usuário e sua senha.");
    return;
  }

  message.textContent = "";
  setLoading(true);

  try {
    await login(username, password);

    window.location.replace("admin.html");

  } catch (error) {
    showError(
      error.name === "AbortError"
        ? "Tempo de conexão esgotado."
        : error.message
    );

  } finally {
    setLoading(false);
  }
});
