
let installPrompt = null;

const installButton = document.getElementById("installApp");
const connectionStatus = document.getElementById("connectionStatus");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
      console.log("PWA registrado com sucesso.");
    } catch (error) {
      console.error("Erro ao registrar PWA:", error);
    }
  });
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;

  if (installButton) {
    installButton.hidden = false;
  }
});

if (installButton) {
  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    await installPrompt.userChoice;

    installPrompt = null;
    installButton.hidden = true;
  });
}

window.addEventListener("appinstalled", () => {
  installPrompt = null;

  if (installButton) {
    installButton.hidden = true;
  }
});

function updateConnectionStatus() {
  if (!connectionStatus) return;

  const online = navigator.onLine;

  connectionStatus.textContent = online
    ? "Conectado"
    : "Sem conexão — envio indisponível";

  connectionStatus.classList.toggle("offline", !online);
}

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

updateConnectionStatus();
