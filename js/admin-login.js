/*
 * AVALIE O ATENDIMENTO
 * Login administrativo
 *
 * A autenticação é feita pelo servidor, que cria a sessão em um cookie
 * HttpOnly. Nenhuma senha ou token é guardado no navegador.
 */

const CONFIG = window.APP_CONFIG;

const form = document.getElementById("loginForm");
const button = document.getElementById("loginButton");
const message = document.getElementById("loginMessage");

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
    CONFIG.requestTimeout
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

    if (response.status === 429) {
      throw new Error(
        "Muitas tentativas. Aguarde alguns minutos e tente de novo."
      );
    }

    if (response.status === 503) {
      throw new Error(
        "A moderação não está configurada ou o serviço está indisponível."
      );
    }

    if (!response.ok) {
      throw new Error(
        "Não foi possível autenticar. Tente novamente."
      );
    }

    // O 2xx só cria a sessão: a permissão é conferida pelo servidor em cada
    // rota protegida.
    return true;

  } finally {
    clearTimeout(timeout);
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();

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

    // A senha não fica no formulário depois do login.
    document.getElementById("password").value = "";

    window.location.replace("admin.html");

  } catch (error) {
    showError(
      error.name === "AbortError"
        ? "Tempo de conexão esgotado."
        : error.name === "TypeError"
          ? "Sem conexão com o servidor. Verifique sua internet."
          : error.message
    );

  } finally {
    setLoading(false);
  }
});
