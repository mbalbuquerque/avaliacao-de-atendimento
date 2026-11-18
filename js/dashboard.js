
/*
 * Dashboard de indicadores.
 * Lê GET /api/indicadores: média, quantidade e distribuição são calculadas
 * pelo PostgreSQL. Nada é guardado nem calculado a partir do navegador.
 */

// As cores vêm dos tokens de css/tokens.css (claro e escuro).
function cssVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function palette() {
  return [
    cssVar("--grafico-1"),
    cssVar("--grafico-2"),
    cssVar("--grafico-3"),
    cssVar("--grafico-4")
  ];
}

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
   Dados do servidor
--------------------------------------------------------------- */

// Converte o contrato (indicadores por serviço) para o formato das telas.
function statisticsFromAPI(data) {
  if (!Array.isArray(data)) {
    throw new Error("Formato de indicadores inválido.");
  }

  return data.map(item => {
    const count = Number(item.quantidade ?? 0);

    const sufficient =
      count >= 3 && item.amostra_suficiente === true;

    const average = sufficient && item.media !== null
      ? Number(item.media)
      : null;

    return {
      id: Number(item.servico_id),
      name: item.nome,
      count,
      average: Number.isFinite(average) ? average : null,
      distribution: [1, 2, 3, 4, 5].map(
        note => Number(item.distribuicao?.[String(note)] ?? 0)
      )
    };
  });
}

async function loadStatistics() {
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
  element.className = `aviso ${error ? "aviso--erro" : "aviso--info"}`;
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
  if (typeof Chart === "undefined") return;

  const labels = stats.map(service => service.name);
  const colors = palette();

  // Cores de texto e grade do Chart.js seguem o tema atual.
  Chart.defaults.color = cssVar("--texto-2");
  Chart.defaults.borderColor = cssVar("--borda");
  Chart.defaults.font.family = cssVar("--fonte");

  createOrUpdateChart("average", "averageChart", {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Média",
        data: stats.map(service => service.average),
        backgroundColor: colors,
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
        backgroundColor: colors,
        borderWidth: 3,
        borderColor: cssVar("--superficie")
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
        backgroundColor: colors[0],
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
      <th scope="row">${escapeHTML(service.name)}</th>
      <td>${service.count}</td>
      <td>${formatAverage(service.average)}</td>
      <td>
        <span class="selo ${
          service.count < 3 ? "selo--aviso" : "selo--ok"
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

  // Texto equivalente ao gráfico de média, para quem não enxerga o canvas.
  $("averageSummary").textContent = stats.map(
    service => `${service.name}: ${
      service.average === null
        ? "amostra insuficiente"
        : formatAverage(service.average)
    }`
  ).join(" · ");
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
      "Dados do servidor (PostgreSQL), atualizados a cada 30 segundos."
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

// Troca de tema (claro/escuro) com a página aberta: redesenha os gráficos.
window.matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", renderDashboard);
$("refreshButton").addEventListener("click", refreshDashboard);

setInterval(refreshDashboard, ATUALIZAR_A_CADA_MS);

refreshDashboard();
