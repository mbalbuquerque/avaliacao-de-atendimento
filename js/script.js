
/*
  AVALIE O ATENDIMENTO
  Cloud Challenge - Grupo 1

  PROTÓTIPO FRONTEND

  Os dados são armazenados no localStorage.
  Isso NÃO representa persistência em nuvem.
*/

const SERVICES = [
  { id: 1, name: "Secretaria" },
  { id: 2, name: "Biblioteca" },
  { id: 3, name: "Cantina" },
  { id: 4, name: "Laboratórios" }
];

const KEY = "cloud-challenge-avaliacoes-demo-v1";

let reviews = [];

try {
  const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
  reviews = Array.isArray(parsed) ? parsed : [];
} catch {
  reviews = [];
}

let score = 0;

const $ = id => document.getElementById(id);

/* PROTEÇÃO NA EXIBIÇÃO DE COMENTÁRIOS */

const safe = value => String(value).replace(
  /[&<>"']/g,
  char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char])
);

/* ARMAZENAMENTO LOCAL */

function save() {
  localStorage.setItem(KEY, JSON.stringify(reviews));
}

/* SELEÇÃO DE ESTRELAS */

function drawStars() {
  document.querySelectorAll("[data-score]").forEach(button => {
    const active = Number(button.dataset.score) <= score;

    button.classList.toggle("active", active);

    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.score) === score)
    );
  });

  $("ratingHint").textContent = score
    ? `Nota selecionada: ${score} de 5`
    : "Selecione de 1 a 5 estrelas";
}

/* ATUALIZAÇÃO DOS PAINÉIS */

function render() {
  $("total").textContent = reviews.length;
  $("serviceCount").textContent = SERVICES.length;

  /* INDICADORES POR SERVIÇO */

  $("services").innerHTML = SERVICES.map(service => {
    const serviceReviews = reviews.filter(
      item => item.serviceId === service.id
    );

    const count = serviceReviews.length;

    const average = count >= 3
      ? (
          serviceReviews.reduce(
            (sum, item) => sum + item.score,
            0
          ) / count
        ).toFixed(1).replace(".", ",")
      : null;

    const counts = [1, 2, 3, 4, 5].map(
      value => serviceReviews.filter(
        item => item.score === value
      ).length
    );

    return `
      <article class="service-card">
        <div class="service-top">
          <div>
            <strong>${service.name}</strong>
            <small>
              ${count} ${count === 1 ? "avaliação" : "avaliações"}
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
              <i style="width:${count ? value / count * 100 : 0}%"></i>
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

  /* COMENTÁRIOS PÚBLICOS */

  const visible = reviews
    .filter(item => !item.hidden && item.comment.trim())
    .slice()
    .reverse();

  $("comments").innerHTML = visible.length
    ? visible.map(item => `
        <article class="comment-item">
          <header>
            <span>
              ${
                SERVICES.find(
                  service => service.id === item.serviceId
                )?.name || "Serviço"
              }
            </span>
            <span>${"★".repeat(item.score)}</span>
          </header>

          <p>${safe(item.comment)}</p>
        </article>
      `).join("")
    : '<p class="empty">Nenhum comentário público registrado ainda.</p>';

  /* MODERAÇÃO DEMONSTRATIVA */

  const withComments = reviews
    .filter(item => item.comment.trim())
    .slice()
    .reverse();

  $("moderation").innerHTML = withComments.length
    ? withComments.map(item => `
        <article class="comment-item">
          <header>
            <span>
              ${
                SERVICES.find(
                  service => service.id === item.serviceId
                )?.name || "Serviço"
              }
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

  /* BOTÕES DE MODERAÇÃO */

  document.querySelectorAll("[data-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const item = reviews.find(
        review => review.id === button.dataset.toggle
      );

      if (item) {
        item.hidden = !item.hidden;
        save();
        render();
      }
    });
  });
}

/* CARREGAR SERVIÇOS NO SELECT */

$("service").insertAdjacentHTML(
  "beforeend",
  SERVICES.map(service => `
    <option value="${service.id}">
      ${service.name}
    </option>
  `).join("")
);

/* EVENTOS DAS ESTRELAS */

document.querySelectorAll("[data-score]").forEach(button => {
  button.addEventListener("click", () => {
    score = Number(button.dataset.score);
    drawStars();
  });
});

/* CONTADOR DE CARACTERES */

$("comment").addEventListener("input", () => {
  $("chars").textContent = `${$("comment").value.length}/280`;
});

/* ENVIO DA AVALIAÇÃO */

$("reviewForm").addEventListener("submit", event => {
  event.preventDefault();

  const serviceId = Number($("service").value);
  const comment = $("comment").value.trim();
  const message = $("formMessage");

  message.className = "message";

  const validService = SERVICES.some(
    service => service.id === serviceId
  );

  const validScore =
    Number.isInteger(score) &&
    score >= 1 &&
    score <= 5;

  if (!validService || !validScore || comment.length > 280) {
    message.textContent =
      "Selecione um serviço e uma nota válida de 1 a 5.";

    message.classList.add("error");
    return;
  }

  reviews.push({
    id: crypto.randomUUID(),
    serviceId,
    score,
    comment,
    hidden: false,
    createdAt: new Date().toISOString()
  });

  save();
  render();

  $("reviewForm").reset();

  score = 0;
  drawStars();

  $("chars").textContent = "0/280";

  message.textContent =
    "Avaliação registrada nesta demonstração local!";

  message.classList.add("ok");
});

/* INICIALIZAÇÃO */

drawStars();
render();
