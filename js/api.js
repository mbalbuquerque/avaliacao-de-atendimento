
/*
 * Avalie o Atendimento
 * Camada de integração com a API
 *
 * Contrato proposto — sujeito à confirmação do backend.
 */

const API_CONFIG = {
  baseURL: "/api",
  timeout: 10000
};

async function apiRequest(endpoint, options = {}) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    API_CONFIG.timeout
  );

  try {
    const response = await fetch(
      `${API_CONFIG.baseURL}${endpoint}`,
      {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers
        },
        signal: controller.signal
      }
    );

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
        503: "Serviço temporariamente indisponível."
      };

      throw new Error(
        data?.message ||
        data?.detail ||
        messages[response.status] ||
        "Não foi possível concluir a solicitação."
      );
    }

    return data;

  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "O servidor demorou para responder. Tente novamente."
      );
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}

const AvalieAPI = {
  listarServicos() {
    return apiRequest("/servicos");
  },

  enviarAvaliacao(avaliacao) {
    return apiRequest("/avaliacoes", {
      method: "POST",
      body: JSON.stringify(avaliacao)
    });
  },

  buscarIndicadores() {
    return apiRequest("/indicadores");
  },

  listarComentarios() {
    return apiRequest("/comentarios");
  }
};
