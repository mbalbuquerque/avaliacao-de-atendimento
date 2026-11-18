// Página pública e dashboard em navegador real, contra a aplicação e um PostgreSQL de verdade.
// Cada teste começa com o banco recriado (só os 4 serviços) e cria os dados de que precisa.

const { test, expect, banco, escolherNotaPorTeclado, AMBIENTE } = require("./ajuda");

const BIBLIOTECA = 2;
const SECRETARIA = 1;

test.beforeEach(async () => {
  await banco.reiniciar();
});

test.describe("formulário de avaliação", () => {
  test("envia pela tela: confirmação só depois do 201 e a avaliação aparece nos indicadores", async ({ page }) => {
    const comentario = "Ótimo acervo e silêncio para estudar.";
    let envios = 0;
    page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/api/avaliacoes")) envios++; });

    await page.goto("/");
    await expect(page.locator("#services li.servico")).toHaveCount(4);
    await expect(page.locator("#total")).toHaveText("0");

    await page.selectOption("#service", String(BIBLIOTECA));
    await escolherNotaPorTeclado(page, 5);
    await expect(page.locator("#ratingHint")).toHaveText("Nota selecionada: 5 de 5");
    await page.fill("#comment", comentario);
    await expect(page.locator("#chars")).toHaveText(`${Array.from(comentario).length}/280`);

    // Antes de enviar não existe confirmação nenhuma.
    await expect(page.locator("#formMessage")).toHaveText("");

    const [resposta] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/avaliacoes") && r.request().method() === "POST"),
      page.getByRole("button", { name: "Enviar avaliação" }).click()
    ]);
    expect(resposta.status()).toBe(201);
    expect((await resposta.json()).id).toBeGreaterThan(0);

    await expect(page.locator("#formMessage")).toContainText("recebida pelo servidor");
    await expect(page.locator("#formMessage")).toHaveClass(/mensagem--ok/);
    await expect(page.locator("#comment")).toHaveValue("");
    await expect(page.locator("#total")).toHaveText("1");
    await expect(page.locator("#services li.servico", { hasText: "Biblioteca" })).toContainText("1 avaliação");
    await expect(page.locator("#comments")).toContainText(comentario);

    expect(envios).toBe(1);
    expect(new URL(page.url()).pathname).toBe("/");
    expect(new URL(page.url()).search).toBe("");

    // Gravada de verdade no PostgreSQL.
    const linhas = await banco.avaliacoes();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ servico_id: BIBLIOTECA, nota: 5, comentario, oculta: false });
  });

  test("validação: comentário de 281 caracteres, nota ausente e serviço ausente são recusados sem gravar", async ({ page }) => {
    let envios = 0;
    page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/api/avaliacoes")) envios++; });
    await page.goto("/");
    await expect(page.locator("#services li.servico")).toHaveCount(4);
    const enviar = page.getByRole("button", { name: "Enviar avaliação" });

    // O textarea limita a digitação em 280; o valor é colocado por script para testar a regra de verdade.
    await page.selectOption("#service", String(SECRETARIA));
    await escolherNotaPorTeclado(page, 4);
    await page.locator("#comment").evaluate((campo) => {
      campo.value = "a".repeat(281);
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(page.locator("#chars")).toHaveText("281/280");
    await enviar.click();
    await expect(page.locator("#formMessage")).toContainText("no máximo 280 caracteres");
    await expect(page.locator("#formMessage")).toHaveClass(/mensagem--erro/);

    // Nota ausente.
    await page.reload();
    await expect(page.locator("#services li.servico")).toHaveCount(4);
    await page.selectOption("#service", String(SECRETARIA));
    await page.fill("#comment", "Sem nota nenhuma");
    await enviar.click();
    await expect(page.locator("#formMessage")).toContainText("Selecione uma nota de 1 a 5 estrelas");

    // Serviço ausente.
    await page.reload();
    await expect(page.locator("#services li.servico")).toHaveCount(4);
    await escolherNotaPorTeclado(page, 3);
    await enviar.click();
    await expect(page.locator("#formMessage")).toContainText("Selecione um serviço válido");

    expect(envios, "nenhuma requisição de gravação pode ter saído").toBe(0);
    expect(await banco.total()).toBe(0);
  });

  test("sem rede: o envio não confirma sucesso e nada é gravado", async ({ page }) => {
    // Offline simulado pelo navegador; a falha de rede aparece como erro de console, e é esperada aqui.
    page.ignorarErros(/Erro ao registrar|ERR_INTERNET_DISCONNECTED|Failed to load resource|Failed to fetch/);
    await page.goto("/");
    await expect(page.locator("#services li.servico")).toHaveCount(4);

    await page.selectOption("#service", String(SECRETARIA));
    await escolherNotaPorTeclado(page, 5);
    await page.fill("#comment", "Enviado sem internet");

    await page.context().setOffline(true);
    await page.getByRole("button", { name: "Enviar avaliação" }).click();

    await expect(page.locator("#formMessage")).toHaveClass(/mensagem--erro/);
    await expect(page.locator("#formMessage")).not.toContainText(/sucesso|recebida/i);

    await page.context().setOffline(false);
    expect(await banco.total()).toBe(0);
  });
});

test.describe("indicadores", () => {
  test("com menos de 3 avaliações mostra 'Amostra insuficiente' e esconde a média; com 3 (5, 4, 4) mostra 4,3", async ({ page }) => {
    await banco.semear([
      { servico_id: BIBLIOTECA, nota: 4, comentario: "Bom" },
      { servico_id: BIBLIOTECA, nota: 5, comentario: "Ótimo" },
      { servico_id: SECRETARIA, nota: 5 },
      { servico_id: SECRETARIA, nota: 4 },
      { servico_id: SECRETARIA, nota: 4 }
    ]);

    await page.goto("/");
    const biblioteca = page.locator("#services li.servico", { hasText: "Biblioteca" });
    const secretaria = page.locator("#services li.servico", { hasText: "Secretaria" });

    await expect(biblioteca).toContainText("2 avaliações");
    await expect(biblioteca).toContainText("Amostra insuficiente");
    await expect(biblioteca.locator(".media")).toHaveCount(0);

    await expect(secretaria).toContainText("3 avaliações");
    await expect(secretaria.locator(".media")).toContainText("4,3");
    await expect(secretaria).not.toContainText("Amostra insuficiente");
  });

  test("dashboard: tabela, métricas e gráficos conferem com o banco e a biblioteca de gráficos é a local", async ({ page }) => {
    await banco.semear([
      { servico_id: BIBLIOTECA, nota: 4 },
      { servico_id: BIBLIOTECA, nota: 5 },
      { servico_id: SECRETARIA, nota: 5 },
      { servico_id: SECRETARIA, nota: 4 },
      { servico_id: SECRETARIA, nota: 4 }
    ]);

    await page.goto("/dashboard.html");
    await expect(page.locator("#sectorTable tr")).toHaveCount(4);
    await expect(page.locator("#totalReviews")).toHaveText("5");
    await expect(page.locator("#totalServices")).toHaveText("4");
    await expect(page.locator("#validServices")).toHaveText("1");
    await expect(page.locator("#generalAverage")).toHaveText("4,4");

    const linhaBiblioteca = page.locator("#sectorTable tr", { hasText: "Biblioteca" });
    await expect(linhaBiblioteca).toContainText("Amostra insuficiente");
    const linhaSecretaria = page.locator("#sectorTable tr", { hasText: "Secretaria" });
    await expect(linhaSecretaria).toContainText("4,3");
    await expect(linhaSecretaria).toContainText("Amostra válida");

    // O Chart.js vem do próprio servidor (/vendor), não de CDN, e desenhou os três gráficos.
    await page.waitForFunction(() => typeof window.Chart !== "undefined");
    const origens = await page.evaluate(() =>
      [...document.scripts].map((s) => s.src).filter(Boolean).map((u) => new URL(u).origin));
    expect(new Set(origens)).toEqual(new Set([AMBIENTE.base]));
    for (const id of ["averageChart", "quantityChart", "distributionChart"]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });
});

test.describe("sem JavaScript", () => {
  test("os formulários não colocam dados na URL: senha e comentário nunca vão em GET", async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: AMBIENTE.base, javaScriptEnabled: false });
    const pagina = await contexto.newPage();
    try {
      // Formulário de avaliação.
      await pagina.goto("/");
      // Sem JavaScript os serviços (que vêm da API) não carregam: só existe a opção neutra, e o
      // teste mostra que mesmo assim o envio nativo é POST e não coloca nada na URL.
      await expect(pagina.locator("#service option")).toHaveCount(1);
      await pagina.locator('label[for="nota-3"]').click();
      await pagina.fill("#comment", "COMENTARIO-QUE-NAO-PODE-IR-PARA-A-URL");
      const [envio] = await Promise.all([
        pagina.waitForRequest((r) => r.url().includes("/api/avaliacoes")),
        pagina.getByRole("button", { name: "Enviar avaliação" }).click()
      ]);
      expect(envio.method()).toBe("POST");
      expect(envio.url()).toBe(`${AMBIENTE.base}/api/avaliacoes`);
      expect(pagina.url()).not.toContain("COMENTARIO");
      expect(new URL(pagina.url()).search).toBe("");

      // Formulário do gestor.
      await pagina.goto("/admin-login.html");
      await pagina.fill("#username", "gestor-secreto");
      await pagina.fill("#password", "SENHA-QUE-NAO-PODE-IR-PARA-A-URL");
      const [login] = await Promise.all([
        pagina.waitForRequest((r) => r.url().includes("/api/admin/login")),
        pagina.getByRole("button", { name: "Entrar no painel" }).click()
      ]);
      expect(login.method()).toBe("POST");
      expect(login.url()).toBe(`${AMBIENTE.base}/api/admin/login`);
      expect(pagina.url()).not.toMatch(/SENHA|gestor-secreto/);
      expect(new URL(pagina.url()).search).toBe("");

      expect(await banco.total(), "o envio nativo sem JavaScript não grava nada").toBe(0);
    } finally {
      await contexto.close();
    }
  });
});
