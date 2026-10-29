
const STORAGE_KEY = "cloud-challenge-avaliacoes-demo-v1";

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

const charts = {};

const $ = id => document.getElementById(id);

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

function calculateStatistics(reviews) {
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

function formatAverage(value) {
  return value === null
    ? "Amostra insuficiente"
    : value.toFixed(1).replace(".", ",");
}

function renderMetrics(stats, reviews) {
  $("totalReviews").textContent = reviews.length;
  $("totalServices").textContent = SERVICES.length;

  $("validServices").textContent = stats.filter(
    service => service.count >= 3
  ).length;

  // A média geral só é apresentada quando existem
  // pelo menos 3 avaliações no conjunto.
  const generalAverage = reviews.length >= 3
    ? reviews.reduce((sum, item) => sum + item.score, 0) /
      reviews.length
    : null;

  $("generalAverage").textContent =
    generalAverage === null
      ? "—"
      : formatAverage(generalAverage);
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
      <td><strong>${service.name}</strong></td>
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

function renderDashboard() {
  const reviews = loadReviews();
  const selected = $("serviceFilter").value;

  const filtered = selected === "all"
    ? reviews
    : reviews.filter(item => item.serviceId === Number(selected));

  const stats = calculateStatistics(filtered);

  const visibleStats = selected === "all"
    ? stats
    : stats.filter(item => item.id === Number(selected));

  renderMetrics(visibleStats, filtered);
  renderCharts(visibleStats);
  renderTable(visibleStats);
}

$("serviceFilter").addEventListener("change", renderDashboard);
$("refreshButton").addEventListener("click", renderDashboard);

window.addEventListener("storage", event => {
  if (event.key === STORAGE_KEY) {
    renderDashboard();
  }
});

renderDashboard();
