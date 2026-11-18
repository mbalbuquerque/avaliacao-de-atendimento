// XSS e acessibilidade básica em navegador real, sob a CSP verdadeira do servidor.

const { test, expect, banco, entrarComoGestor, escolherNotaPorTeclado } = require("./ajuda");

const SECRETARIA = 1;

test.beforeEach(async () => {
  await banco.reiniciar();
});

const CARGAS = [
  "<img src=x onerror=window.__xss=1>",
  "<script>window.__xss=1</script>",
  "\"><svg onload=window.__xss=1>"
];

test.describe("XSS", () => {
  test.beforeEach(async () => {
    await banco.semear(CARGAS.map((comentario, i) => ({ servico_id: SECRETARIA, nota: 5 - i, comentario })));
  });

  test("comentário malicioso aparece como texto na página pública, no dashboard e na moderação", async ({ page }) => {
    // Página pública.
    await page.goto("/");
    await expect(page.locator("#comments li.comentario")).toHaveCount(3);
    for (const carga of CARGAS) await expect(page.locator("#comments")).toContainText(carga);
    await expect(page.locator("#comments img, #comments script, #comments svg, #comments iframe")).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();

    // Dashboard: os dados do mesmo serviço passam pelos gráficos e pela tabela.
    await page.goto("/dashboard.html");
    await expect(page.locator("#sectorTable tr")).toHaveCount(4);
    await expect(page.locator("#totalReviews")).toHaveText("3");
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();

    // Moderação.
    await entrarComoGestor(page);
    await page.goto("/admin.html");
    await expect(page.locator("article.cartao-comentario")).toHaveCount(3);
    for (const carga of CARGAS) await expect(page.locator("#commentsList")).toContainText(carga);
    await expect(page.locator("#commentsList img, #commentsList script, #commentsList svg, #commentsList iframe")).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test("enviado pelo formulário, o comentário malicioso também volta como texto", async ({ page }) => {
    await banco.reiniciar();
    await page.goto("/");
    await expect(page.locator("#services li.servico")).toHaveCount(4);
    await page.selectOption("#service", String(SECRETARIA));
    await escolherNotaPorTeclado(page, 3);
    await page.fill("#comment", CARGAS[0]);
    await page.getByRole("button", { name: "Enviar avaliação" }).click();
    await expect(page.locator("#formMessage")).toContainText("recebida pelo servidor");
    await expect(page.locator("#comments")).toContainText(CARGAS[0]);
    await expect(page.locator("#comments img")).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });
});

test.describe("acessibilidade", () => {
  test("a navegação por Tab passa pelos controles principais e cada um mostra foco visível", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#services li.servico")).toHaveCount(4);

    const paradas = [];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      paradas.push(await page.evaluate(() => {
        const el = document.activeElement;
        // A estrela é um rádio escondido: o anel de foco fica no rótulo ligado a ele.
        const alvo = el.matches('input[type="radio"]') ? document.querySelector(`label[for="${el.id}"]`) : el;
        const css = getComputedStyle(alvo);
        const contorno = css.outlineStyle !== "none" && parseFloat(css.outlineWidth) > 0;
        const sombra = css.boxShadow !== "none";
        return { id: el.id || el.tagName.toLowerCase(), visivel: contorno || sombra, tag: el.tagName };
      }));
    }

    const ids = new Set(paradas.map((p) => p.id));
    for (const esperado of ["service", "comment"]) expect(ids, `Tab deve chegar em #${esperado}`).toContain(esperado);
    expect([...ids].some((id) => id.startsWith("nota-")), "Tab deve chegar nas estrelas").toBe(true);
    expect(paradas.some((p) => p.tag === "BUTTON" && p.id !== "installApp"), "Tab deve chegar no botão de enviar").toBe(true);

    const semFoco = paradas.filter((p) => !p.visivel && p.tag !== "BODY");
    expect(semFoco, "controles sem foco visível").toEqual([]);
  });

  test("as estrelas funcionam só com o teclado, de 1 a 5", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#services li.servico")).toHaveCount(4);
    for (const nota of [1, 3, 5, 2]) {
      await escolherNotaPorTeclado(page, nota);
      await expect(page.locator("#ratingHint")).toHaveText(`Nota selecionada: ${nota} de 5`);
    }
  });

  test("em 360x740 nenhuma tela tem rolagem horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await banco.semear([{ servico_id: SECRETARIA, nota: 5, comentario: "Um comentário um pouco mais longo para ocupar espaço na tela do celular." }]);

    const semRolagem = async (nome) => {
      const medidas = await page.evaluate(() => ({
        conteudo: document.documentElement.scrollWidth,
        janela: document.documentElement.clientWidth
      }));
      expect(medidas.conteudo, `${nome} rola na horizontal`).toBeLessThanOrEqual(medidas.janela + 1);
    };

    await page.goto("/");
    await expect(page.locator("#comments li.comentario")).toHaveCount(1);
    await semRolagem("index.html");

    await page.goto("/dashboard.html");
    await expect(page.locator("#sectorTable tr")).toHaveCount(4);
    await semRolagem("dashboard.html");

    await page.goto("/offline.html");
    await semRolagem("offline.html");

    page.ignorarErros(/status of 401/);
    await page.context().clearCookies();
    await page.goto("/admin-login.html");
    await semRolagem("admin-login.html");

    await entrarComoGestor(page);
    await page.goto("/admin.html");
    await expect(page.locator("article.cartao-comentario")).toHaveCount(1);
    await semRolagem("admin.html");
  });
});
