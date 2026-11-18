/* exported AvalieAPI */

/*
 * Avalie o Atendimento
 * Camada de integração com a API (contrato em docs/contrato-api.md)
 *
 * Erros viram Error com a mensagem do servidor (campo "message") e a
 * propriedade "status" (0 = sem conexão), para as telas decidirem o que fazer.
 */

const API_CONFIG = {
  baseURL: window.APP_CONFIG?.apiBaseUrl || "/api",
  timeout: window.APP_CONFIG?.requestTimeout || 10000
};

function erroDeApi(mensagem, status) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

async function apiRequest(endpoint, options = {}) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    API_CONFIG.timeout
  );

  let response;

  try {
    response = await fetch(
      `${API_CONFIG.baseURL}${endpoint}`,
      {
        credentials: "same-origin",
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers
        },
        signal: controller.signal
      }
    );
  } catch (error) {
    if (error.name === "AbortError") {
      throw erroDeApi(
        "O servidor demorou para responder. Tente novamente.",
        0
      );
    }

    throw erroDeApi(
      "Não foi possível conectar ao servidor. Verifique sua conexão.",
      0
    );
  } finally {
    clearTimeout(timeout);
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    // Resposta sem JSON.
  }

  if (!response.ok) {
    const messages = {
      400: "Confira os dados informados.",
      401: "É necessário autenticar-se.",
      403: "Você não tem permissão para esta operação.",
      404: "Recurso não encontrado.",
      409: "Este registro já existe ou está em conflito.",
      429: "Muitas tentativas em pouco tempo. Aguarde um pouco.",
      503: "Serviço temporariamente indisponível."
    };

    throw erroDeApi(
      data?.message ||
      data?.detail ||
      messages[response.status] ||
      "Não foi possível concluir a solicitação.",
      response.status
    );
  }

  return data;
}

const AvalieAPI = {
  listarServicos() {
    return apiRequest("/servicos");
  },

  async enviarAvaliacao(avaliacao) {
    const resposta = await apiRequest("/avaliacoes", {
      method: "POST",
      body: JSON.stringify(avaliacao)
    });

    // Só vale como enviada se o servidor devolveu o id gravado (HTTP 201).
    if (!resposta || !Number.isInteger(resposta.id)) {
      throw erroDeApi(
        "O servidor não confirmou o registro da avaliação.",
        502
      );
    }

    return resposta;
  },

  buscarIndicadores() {
    return apiRequest("/indicadores");
  },

  listarComentarios() {
    return apiRequest("/comentarios");
  },

  // ---- área do gestor (sessão por cookie HttpOnly criado pelo servidor)

  adminMe() {
    return apiRequest("/admin/me");
  },

  listarAvaliacoesAdmin() {
    return apiRequest("/admin/avaliacoes");
  },

  moderarAvaliacao(id, oculta) {
    return apiRequest(
      `/admin/avaliacoes/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ oculta })
      }
    );
  },

  sairAdmin() {
    return apiRequest("/admin/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
  }
};
