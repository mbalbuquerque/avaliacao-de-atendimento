
/*
 * Dashboard de indicadores.
 * Modo API: lê GET /api/indicadores (média, quantidade e distribuição calculadas
 * pelo PostgreSQL). Modo demo: calcula a partir do localStorage deste navegador.
 */

const STORAGE_KEY = "cloud-challenge-avaliacoes-demo-v1";

const API_MODE = window.APP_CONFIG?.mode === "api";

const SERVICES = [
  { id: 1, name: "Secretaria" },
  { id: 2, name: "Biblioteca" },
  { id: 3, name: "Cantina" },
  { id: 4, name: "Laboratórios" }
];

const COLORS = [
  "#0482C2",
  "#035680",
  "#05ACFF",
  "#3D3D3D"
];

const ATUALIZAR_A_CADA_MS = 30000;

const charts = {};

const $ = id => document.getElementById(id);

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

/* ---------------------------------------------------------------
   Origem dos dados
--------------------------------------------------------------- */

function loadReviews() {
  try {
    const data = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(data)
      ? data.filter(item =>
          Number.isInteger(item.score) &&
          item.score >= 1 &&
          item.score <= 5 &&
          SERVICES.some(service => service.id === item.serviceId)
        )
      : [];
  } catch {
    return [];
  }
}

// Demo: estatísticas calculadas no navegador.
function calculateLocalStatistics(reviews) {
  return SERVICES.map(service => {
    const items = reviews.filter(
      review => review.serviceId === service.id
    );

    const count = items.length;

    const sum = items.reduce(
      (total, review) => total + review.score,
      0
    );

    const distribution = [1, 2, 3, 4, 5].map(
      score => items.filter(item => item.score === score).length
    );

    return {
      ...service,
      count,
      average: count >= 3 ? sum / count : null,
      distribution
    };
  });
}

// API: converte o contrato (indicadores por serviço) para o formato das telas.
function statisticsFromAPI(data) {
  if (!Array.isArray(data)) {
    throw new Error("Formato de indicadores inválido.");
  }

  return SERVICES.map(service => {
    const item = data.find(
      entry => Number(entry.servico_id) === service.id
    );

    const count = Number(item?.quantidade ?? 0);

    const sufficient =
      count >= 3 && item?.amostra_suficiente === true;

    const average = sufficient && item.media !== null
      ? Number(item.media)
      : null;

    return {
      ...service,
      count,
      average: Number.isFinite(average) ? average : null,
      distribution: [1, 2, 3, 4, 5].map(
        note => Number(item?.distribuicao?.[String(note)] ?? 0)
      )
    };
  });
}

async function loadStatistics() {
  if (!API_MODE) {
    return calculateLocalStatistics(loadReviews());
  }

  if (typeof AvalieAPI === "undefined") {
    throw new Error(
      "A camada de integração com a API não foi carregada."
    );
  }

  return statisticsFromAPI(await AvalieAPI.buscarIndicadores());
}

/* ---------------------------------------------------------------
   Apresentação
--------------------------------------------------------------- */

function formatAverage(value) {
  return value === null
    ? "Amostra insuficiente"
    : value.toFixed(1).replace(".", ",");
}

function setNotice(text, error = false) {
  const element = $("dataSourceNotice");

  if (!element) return;

  element.textContent = text;
  element.classList.toggle("error", error);
}

function renderMetrics(stats) {
  const total = stats.reduce(
    (sum, service) => sum + service.count,
    0
  );

  $("totalReviews").textContent = total;
  $("totalServices").textContent = stats.length;

  $("validServices").textContent = stats.filter(
    service => service.count >= 3
  ).length;

  // A média geral só é apresentada quando existem
  // pelo menos 3 avaliações no conjunto.
  const points = stats.reduce(
    (sum, service) => sum + service.distribution.reduce(
      (acc, count, index) => acc + count * (index + 1),
      0
    ),
    0
  );

  $("generalAverage").textContent = total >= 3
    ? formatAverage(points / total)
    : "—";
}

function createOrUpdateChart(key, canvasId, config) {
  if (typeof Chart === "undefined") return;

  if (charts[key]) {
    charts[key].destroy();
  }

  charts[key] = new Chart($(canvasId), config);
}

function renderCharts(stats) {
  const labels = stats.map(service => service.name);

  createOrUpdateChart("average", "averageChart", {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Média",
        data: stats.map(service => service.average),
        backgroundColor: COLORS,
        borderRadius: 9,
        maxBarThickness: 80
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context =>
              context.raw === null
                ? "Amostra insuficiente"
                : `Média: ${formatAverage(context.raw)}`
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 5,
          ticks: { stepSize: 1 }
        }
      }
    }
  });

  createOrUpdateChart("quantity", "quantityChart", {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: stats.map(service => service.count),
        backgroundColor: COLORS,
        borderWidth: 3,
        borderColor: "#FFFFFF"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });

  const totals = [0, 0, 0, 0, 0];

  stats.forEach(service => {
    service.distribution.forEach((count, index) => {
      totals[index] += count;
    });
  });

  createOrUpdateChart("distribution", "distributionChart", {
    type: "bar",
    data: {
      labels: ["1 estrela", "2 estrelas", "3 estrelas", "4 estrelas", "5 estrelas"],
      datasets: [{
        label: "Avaliações",
        data: totals,
        backgroundColor: "#0482C2",
        borderRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

function renderTable(stats) {
  $("sectorTable").innerHTML = stats.map(service => `
    <tr>
      <td><strong>${escapeHTML(service.name)}</strong></td>
      <td>${service.count}</td>
      <td>${formatAverage(service.average)}</td>
      <td>
        <span class="status ${
          service.count < 3 ? "insufficient" : ""
        }">
          ${
            service.count < 3
              ? "Amostra insuficiente"
              : "Amostra válida"
          }
        </span>
      </td>
    </tr>
  `).join("");
}

let lastStats = null;

function renderDashboard() {
  if (!lastStats) return;

  const selected = $("serviceFilter").value;

  const visibleStats = selected === "all"
    ? lastStats
    : lastStats.filter(item => item.id === Number(selected));

  renderMetrics(visibleStats);
  renderCharts(visibleStats);
  renderTable(visibleStats);
}

async function refreshDashboard() {
  try {
    lastStats = await loadStatistics();

    setNotice(
      API_MODE
        ? "Dados do servidor (PostgreSQL), atualizados a cada 30 segundos."
        : "Dados locais de demonstração, guardados só neste navegador."
    );

    renderDashboard();
  } catch (error) {
    console.error("Erro ao carregar indicadores:", error);

    setNotice(
      `Não foi possível carregar os indicadores do servidor. ${error.message || ""}`.trim(),
      true
    );
  }
}

$("serviceFilter").addEventListener("change", renderDashboard);
$("refreshButton").addEventListener("click", refreshDashboard);

if (!API_MODE) {
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) {
      refreshDashboard();
    }
  });
} else {
  setInterval(refreshDashboard, ATUALIZAR_A_CADA_MS);
}

refreshDashboard();
