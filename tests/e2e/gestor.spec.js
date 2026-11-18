// Área do gestor em navegador real: login, moderação e sair, com sessão de verdade (cookie do servidor).

const { test, expect, banco, entrarComoGestor, AMBIENTE } = require("./ajuda");

const SECRETARIA = 1;

test.beforeEach(async () => {
  await banco.reiniciar();
});

test.describe("login do gestor", () => {
  test("senha errada mostra erro e não entra; senha certa abre a moderação com cookie HttpOnly", async ({ page }) => {
    // A senha errada devolve 401, que o navegador registra no console: é o comportamento esperado aqui.
    page.ignorarErros(/status of 401/);
    await page.goto("/admin-login.html");

    await page.fill("#username", AMBIENTE.usuario);
    await page.fill("#password", "senha-errada-123");
    await page.getByRole("button", { name: "Entrar no painel" }).click();
    await expect(page.locator("#loginMessage")).toContainText("Usuário ou senha inválidos");
    await expect(page).toHaveURL(/admin-login\.html$/);
    expect((await page.context().cookies()).some((c) => c.name === "sessao")).toBe(false);

    await page.fill("#password", AMBIENTE.senha);
    await Promise.all([
      page.waitForURL(/admin\.html$/),
      page.getByRole("button", { name: "Entrar no painel" }).click()
    ]);
    await expect(page.locator("#modeBadge")).toHaveText(`Gestor: ${AMBIENTE.usuario}`);

    const sessao = (await page.context().cookies()).find((c) => c.name === "sessao");
    expect(sessao).toBeTruthy();
    expect(sessao.httpOnly).toBe(true);
    expect(sessao.sameSite).toBe("Strict");
    expect(await page.evaluate(() => document.cookie), "o JavaScript não pode ler o cookie de sessão").not.toContain("sessao");
  });

  test("sem sessão a moderação devolve ao login", async ({ page }) => {
    // Sem sessão o servidor responde 401 e o front registra o motivo no console antes de voltar ao login.
    page.ignorarErros(/status of 401/, /Não foi possível verificar a sessão/);
    await page.goto("/admin.html");
    await expect(page).toHaveURL(/admin-login\.html$/);
  });
});

test.describe("moderação", () => {
  test("ocultar tira o comentário da lista pública sem mexer na média nem na quantidade; reexibir devolve", async ({ page }) => {
    await banco.semear([
      { servico_id: SECRETARIA, nota: 5, comentario: "Atendimento ótimo" },
      { servico_id: SECRETARIA, nota: 1, comentario: "Comentário impróprio para moderar" },
      { servico_id: SECRETARIA, nota: 4, comentario: "Resolveram no mesmo dia" }
    ]);
    await entrarComoGestor(page);
    const api = page.context().request;
    const indicadores = async () => (await api.get(`${AMBIENTE.base}/api/indicadores`)).json();
    const antes = await indicadores();

    await page.goto("/admin.html");
    await expect(page.locator("article.cartao-comentario")).toHaveCount(3);
    await expect(page.locator("#totalComments")).toHaveText("3");
    await expect(page.locator("#hiddenComments")).toHaveText("0");

    const impropria = page.locator("article.cartao-comentario", { hasText: "Comentário impróprio" });
    await impropria.getByRole("button", { name: "Ocultar" }).click();
    await expect(page.locator("#adminMessage")).toContainText("Comentário ocultado. A nota foi preservada.");
    await expect(impropria).toContainText("Oculto");
    await expect(page.locator("#hiddenComments")).toHaveText("1");

    // Página pública: o comentário sumiu, a nota continua nos indicadores.
    await page.goto("/");
    await expect(page.locator("#comments li.comentario")).toHaveCount(2);
    await expect(page.locator("#comments")).not.toContainText("impróprio");
    const secretaria = page.locator("#services li.servico", { hasText: "Secretaria" });
    await expect(secretaria).toContainText("3 avaliações");
    await expect(secretaria.locator(".media")).toContainText("3,3");
    expect(await indicadores(), "média, quantidade e distribuição não podem mudar").toEqual(antes);
    expect((await banco.avaliacoes()).find((a) => a.nota === 1)).toMatchObject({ oculta: true, nota: 1 });

    // Reexibir devolve o comentário à lista pública.
    await page.goto("/admin.html");
    await page.locator("article.cartao-comentario", { hasText: "Comentário impróprio" })
      .getByRole("button", { name: "Reexibir" }).click();
    await expect(page.locator("#adminMessage")).toContainText("Comentário reexibido com sucesso.");
    await page.goto("/");
    await expect(page.locator("#comments li.comentario")).toHaveCount(3);
    await expect(page.locator("#comments")).toContainText("Comentário impróprio");
    expect(await indicadores()).toEqual(antes);
  });

  test("o filtro por situação separa visíveis e ocultos", async ({ page }) => {
    await banco.semear([
      { servico_id: SECRETARIA, nota: 5, comentario: "Visível 1" },
      { servico_id: SECRETARIA, nota: 4, comentario: "Oculto 1", oculta: true }
    ]);
    await entrarComoGestor(page);
    await page.goto("/admin.html");
    await expect(page.locator("article.cartao-comentario")).toHaveCount(2);

    await page.selectOption("#statusFilter", "hidden");
    await expect(page.locator("article.cartao-comentario")).toHaveCount(1);
    await expect(page.locator("article.cartao-comentario")).toContainText("Oculto 1");

    await page.selectOption("#statusFilter", "visible");
    await expect(page.locator("article.cartao-comentario")).toHaveCount(1);
    await expect(page.locator("article.cartao-comentario")).toContainText("Visível 1");
  });
});

test.describe("sair", () => {
  test("encerra a sessão no navegador e a moderação volta ao login", async ({ page }) => {
    // Depois de sair, abrir a moderação devolve 401 (esperado) e o front registra o motivo no console.
    page.ignorarErros(/status of 401/, /Não foi possível verificar a sessão/);
    await entrarComoGestor(page);
    await page.goto("/admin.html");
    await expect(page.locator("#modeBadge")).toHaveText(`Gestor: ${AMBIENTE.usuario}`);

    await expect(page.locator("#logoutLink")).toBeVisible();
    await Promise.all([
      page.waitForURL(/admin-login\.html$/),
      page.locator("#logoutLink").click()
    ]);
    expect((await page.context().cookies()).some((c) => c.name === "sessao")).toBe(false);

    await page.goto("/admin.html");
    await expect(page).toHaveURL(/admin-login\.html$/);
  });
});
