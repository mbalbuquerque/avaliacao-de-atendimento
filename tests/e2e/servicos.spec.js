// Os serviços vêm da API (GET /api/servicos), não de HTML escrito à mão: formulário, dashboard e
// moderação. Os serviços de teste vêm do banco; a falha da API é simulada só nos testes de erro.

const { test, expect, banco, entrarComoGestor, escolherNotaPorTeclado, AMBIENTE } = require("./ajuda");

test.beforeEach(async () => {
  await banco.reiniciar();
});

const erro503 = (route) => route.fulfill({
  status: 503,
  contentType: "application/json",
  body: JSON.stringify({ message: "Serviço temporariamente indisponível." })
});

// O navegador registra o 503 no console e o front registra o motivo: é o esperado nestes testes.
const ESPERADOS_NA_FALHA = [/503/, /Failed to load resource/, /Erro ao carregar os serviços/];

async function servicosDaApi(request) {
  const resposta = await request.get(`${AMBIENTE.base}/api/servicos`);
  expect(resposta.status()).toBe(200);
  return resposta.json();
}

test.describe("serviços vindos da API", () => {
  test("o HTML entregue ao navegador não traz nenhum serviço escrito", async ({ request }) => {
    const servicos = await servicosDaApi(request);
    expect(servicos.length).toBeGreaterThanOrEqual(4);
    for (const pagina of ["/", "/dashboard.html", "/admin.html"]) {
      const html = await (await request.get(AMBIENTE.base + pagina)).text();
      for (const servico of servicos) {
        expect(html, `${pagina} não pode ter "${servico.nome}" escrito`).not.toContain(servico.nome);
      }
    }
  });

  test("o select do formulário só tem as opções que a API devolve, e um serviço novo do banco aparece sem mudar HTML", async ({ page, request }) => {
    const novo = await banco.novoServico("Auditório");
    let envios = 0;
    page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/api/avaliacoes")) envios++; });

    await page.goto("/");
    const select = page.locator("#service");
    await expect(select).toBeEnabled();

    const servicos = await servicosDaApi(request);
    expect(servicos.map((s) => s.nome)).toContain("Auditório");

    const opcoes = await select.locator("option").evaluateAll(
      (lista) => lista.map((o) => ({ valor: o.value, texto: o.textContent })));
    expect(opcoes[0]).toEqual({ valor: "", texto: "Selecione um serviço" });
    expect(opcoes.slice(1), "exatamente os serviços que a API devolve, na mesma ordem")
      .toEqual(servicos.map((s) => ({ valor: String(s.id), texto: s.nome })));

    // O serviço novo é avaliável de ponta a ponta e aparece nos indicadores.
    await expect(page.locator("#services li.servico")).toHaveCount(servicos.length);
    await page.selectOption("#service", String(novo.id));
    await escolherNotaPorTeclado(page, 4);
    const [resposta] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/avaliacoes") && r.request().method() === "POST"),
      page.getByRole("button", { name: "Enviar avaliação" }).click()
    ]);
    expect(resposta.status()).toBe(201);
    await expect(page.locator("#formMessage")).toContainText("recebida pelo servidor");
    await expect(page.locator("#services li.servico", { hasText: "Auditório" })).toContainText("1 avaliação");
    expect(envios).toBe(1);

    const linhas = await banco.avaliacoes();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ servico_id: novo.id, nota: 4 });
  });

  test("o filtro do dashboard mostra o serviço novo e filtra por ele", async ({ page }) => {
    const novo = await banco.novoServico("Auditório");
    await banco.semear([{ servico_id: novo.id, nota: 5 }, { servico_id: 1, nota: 3 }]);

    await page.goto("/dashboard.html");
    const filtro = page.locator("#serviceFilter");
    await expect(filtro).toBeEnabled();
    await expect(filtro.locator("option")).toHaveCount(1 + 5);
    await expect(filtro.locator("option", { hasText: "Auditório" })).toHaveAttribute("value", String(novo.id));
    await expect(filtro.locator("option").first()).toHaveText("Todos os serviços");

    await expect(page.locator("#sectorTable tr")).toHaveCount(5);
    await page.selectOption("#serviceFilter", String(novo.id));
    await expect(page.locator("#sectorTable tr")).toHaveCount(1);
    await expect(page.locator("#sectorTable tr")).toContainText("Auditório");
  });

  test("o filtro da moderação mostra o serviço novo e filtra os comentários por ele", async ({ page }) => {
    const novo = await banco.novoServico("Auditório");
    await banco.semear([
      { servico_id: novo.id, nota: 5, comentario: "Som ótimo no auditório." },
      { servico_id: 1, nota: 4, comentario: "Fila rápida." }
    ]);
    await entrarComoGestor(page);

    await page.goto("/admin.html");
    const filtro = page.locator("#serviceFilter");
    await expect(filtro).toBeEnabled();
    await expect(filtro.locator("option", { hasText: "Auditório" })).toHaveAttribute("value", "Auditório");
    await expect(page.locator("#commentsList article")).toHaveCount(2);

    await page.selectOption("#serviceFilter", "Auditório");
    await expect(page.locator("#commentsList article")).toHaveCount(1);
    await expect(page.locator("#commentsList")).toContainText("Som ótimo no auditório.");
  });

  test("nome de serviço com HTML aparece como texto nas três telas e nada é executado", async ({ page }) => {
    const nome = "<img src=x onerror=window.__xss=1>";
    await banco.novoServico(nome);
    await entrarComoGestor(page);

    for (const [pagina, seletor] of [["/", "#service"], ["/dashboard.html", "#serviceFilter"], ["/admin.html", "#serviceFilter"]]) {
      await page.goto(pagina);
      await expect(page.locator(seletor)).toBeEnabled();
      await expect(page.locator(`${seletor} option`, { hasText: nome })).toHaveCount(1);
      await expect(page.locator(`${seletor} option img`)).toHaveCount(0);
      expect(await page.evaluate(() => window.__xss), `${pagina}: nada pode ter executado`).toBeUndefined();
    }
  });
});

test.describe("quando a lista de serviços não chega", () => {
  test("API fora do ar (503): o formulário mostra o erro, desabilita o envio e não grava nada", async ({ page }) => {
    page.ignorarErros(...ESPERADOS_NA_FALHA);
    await page.route("**/api/servicos", erro503);
    let envios = 0;
    page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/api/avaliacoes")) envios++; });

    await page.goto("/");
    await expect(page.locator("#formMessage")).toContainText("Serviço temporariamente indisponível");
    await expect(page.locator("#formMessage")).toHaveClass(/mensagem--erro/);
    await expect(page.locator("#service")).toBeDisabled();
    await expect(page.locator("#service option")).toHaveCount(1);
    await expect(page.locator("#service option")).toHaveText("Serviços indisponíveis");
    await expect(page.getByRole("button", { name: "Enviar avaliação" })).toBeDisabled();

    // Contorno: forçar o envio do formulário mesmo com o botão desabilitado.
    await page.evaluate(() => document.getElementById("reviewForm").requestSubmit());
    await expect(page.locator("#formMessage")).toContainText("lista de serviços não foi carregada");
    await expect(page.locator("#formMessage")).not.toHaveClass(/mensagem--ok/);
    expect(envios, "nenhuma avaliação pode ser enviada").toBe(0);
    expect(await banco.total()).toBe(0);
    expect(new URL(page.url()).search, "nada vai para a URL").toBe("");
  });

  test("o erro não fica guardado: com a API de volta, recarregar preenche e libera o envio", async ({ page }) => {
    page.ignorarErros(...ESPERADOS_NA_FALHA);
    await page.route("**/api/servicos", erro503);
    await page.goto("/");
    await expect(page.locator("#service")).toBeDisabled();

    await page.unroute("**/api/servicos");
    await page.reload();
    await expect(page.locator("#service")).toBeEnabled();
    await expect(page.locator("#service option")).toHaveCount(1 + 4);
    await expect(page.getByRole("button", { name: "Enviar avaliação" })).toBeEnabled();
    await expect(page.locator("#formMessage")).toHaveText("");
  });

  test("lista vazia: avisa que não há serviços e não deixa enviar", async ({ page }) => {
    await page.route("**/api/servicos", (route) => route.fulfill({
      status: 200, contentType: "application/json", body: "[]"
    }));
    await page.goto("/");
    await expect(page.locator("#service option")).toHaveText("Nenhum serviço disponível");
    await expect(page.locator("#service")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Enviar avaliação" })).toBeDisabled();
    await expect(page.locator("#formMessage")).toContainText("Nenhum serviço está disponível");
  });

  test("resposta fora do formato esperado é recusada com mensagem clara", async ({ page }) => {
    page.ignorarErros(/Erro ao carregar os serviços/);
    await page.route("**/api/servicos", (route) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ servicos: "nada" })
    }));
    await page.goto("/");
    await expect(page.locator("#formMessage")).toContainText("Formato de serviços inválido");
    await expect(page.locator("#service")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Enviar avaliação" })).toBeDisabled();
  });

  test("dashboard: os indicadores aparecem, o filtro fica desabilitado e o aviso explica o motivo", async ({ page }) => {
    page.ignorarErros(...ESPERADOS_NA_FALHA);
    await page.route("**/api/servicos", erro503);
    await page.goto("/dashboard.html");

    await expect(page.locator("#sectorTable tr")).toHaveCount(4);
    await expect(page.locator("#serviceFilter")).toBeDisabled();
    await expect(page.locator("#dataSourceNotice")).toContainText("filtro por serviço está indisponível");
    await expect(page.locator("#dataSourceNotice")).toHaveClass(/aviso--erro/);
  });

  test("moderação: os comentários aparecem, o filtro fica desabilitado e a tela avisa", async ({ page }) => {
    page.ignorarErros(...ESPERADOS_NA_FALHA, /Não foi possível carregar a lista de serviços/);
    await banco.semear([{ servico_id: 1, nota: 4, comentario: "Fila rápida." }]);
    await entrarComoGestor(page);
    await page.route("**/api/servicos", erro503);

    await page.goto("/admin.html");
    await expect(page.locator("#commentsList")).toContainText("Fila rápida.");
    await expect(page.locator("#serviceFilter")).toBeDisabled();
    await expect(page.locator("#adminMessage")).toContainText("Serviço indisponível");
  });
});
