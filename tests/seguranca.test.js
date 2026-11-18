// Testes de segurança: tentam burlar a sessão, o login, os limites e a validação.
// Cada teste descreve o ataque no nome e confere que ele é barrado.

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { criarSessao } = require("../src/auth");
const { criarBancoDeTeste, iniciar, logarGestor, ADMIN, SENHA_GESTOR } = require("./ajuda");

const VAZAMENTO = /SyntaxError|TypeError|node_modules|at \w+ \(|stack|SELECT |INSERT |postgres|pg_|ECONN/i;

describe("segurança", () => {
  let db;
  let api;

  beforeEach(async () => {
    db = await criarBancoDeTeste();
    api = await iniciar(db);
  });

  afterEach(async () => {
    await api.parar();
    await db.fechar();
  });

  const contar = async () => (await db.query("SELECT COUNT(*)::int AS n FROM avaliacoes")).rows[0].n;

  // ------------------------------------------------------------ sessão do gestor

  describe("sessão", () => {
    test("cookie com a assinatura trocada é recusado", async () => {
      const { Cookie } = await logarGestor(api);
      const [carga] = Cookie.replace("sessao=", "").split(".");
      const forjado = `sessao=${carga}.${"A".repeat(43)}`;
      assert.equal((await api.get("/api/admin/me", { Cookie: forjado })).status, 401);
    });

    test("cookie com a carga alterada (outro usuário, validade maior) é recusado", async () => {
      const { Cookie } = await logarGestor(api);
      const [, assinatura] = Cookie.replace("sessao=", "").split(".");
      const cargaFalsa = Buffer.from(JSON.stringify({ u: "outro", exp: Date.now() + 9e12 })).toString("base64url");
      assert.equal((await api.get("/api/admin/me", { Cookie: `sessao=${cargaFalsa}.${assinatura}` })).status, 401);
    });

    test("cookie assinado com outro segredo é recusado", async () => {
      const estranho = criarSessao(ADMIN.usuario, "outro-segredo-qualquer-com-mais-de-32-caracteres");
      assert.equal((await api.get("/api/admin/me", { Cookie: `sessao=${estranho}` })).status, 401);
    });

    test("sessão vencida (emitida há 9 horas) é recusada", async () => {
      const velha = criarSessao(ADMIN.usuario, ADMIN.segredo, Date.now() - 9 * 60 * 60 * 1000);
      assert.equal((await api.get("/api/admin/me", { Cookie: `sessao=${velha}` })).status, 401);
    });

    test("cookie vazio, sem ponto ou com lixo é recusado sem derrubar o servidor", async () => {
      for (const valor of ["", "x", ".", "a.b", "%%%", "a".repeat(5000)]) {
        assert.equal((await api.get("/api/admin/me", { Cookie: `sessao=${valor}` })).status, 401, valor.slice(0, 10));
      }
      assert.equal((await api.get("/health")).status, 200);
    });
  });

  // ------------------------------------------------------------ login

  describe("login", () => {
    test("força bruta: depois do limite de tentativas o IP recebe 429, mesmo com a senha certa", async () => {
      await api.parar();
      api = await iniciar(db, { tentativasDeLogin: 3 });
      for (let i = 0; i < 3; i++) {
        assert.equal((await api.post("/api/admin/login", { usuario: "gestor", senha: `errada-${i}-xxxx` })).status, 401);
      }
      const bloqueado = await api.post("/api/admin/login", { usuario: ADMIN.usuario, senha: SENHA_GESTOR });
      assert.equal(bloqueado.status, 429);
      assert.equal(bloqueado.cabecalhos.get("set-cookie"), null, "não pode criar sessão enquanto bloqueado");
    });

    test("a resposta não revela se o usuário existe", async () => {
      const existe = await api.post("/api/admin/login", { usuario: ADMIN.usuario, senha: "errada-123456" });
      const naoExiste = await api.post("/api/admin/login", { usuario: "fantasma", senha: "errada-123456" });
      assert.equal(existe.status, naoExiste.status);
      assert.deepEqual(existe.json, naoExiste.json);
    });

    test("corpo com tipos errados (objeto, array, número) não autentica nem quebra", async () => {
      const corpos = [
        { usuario: { $ne: "" }, senha: { $ne: "" } },
        { usuario: [ADMIN.usuario], senha: [SENHA_GESTOR] },
        { usuario: 1, senha: 2 },
        [],
        "texto",
        null
      ];
      for (const corpo of corpos) {
        const r = await api.post("/api/admin/login", corpo);
        assert.ok([400, 401].includes(r.status), JSON.stringify(corpo));
      }
    });

    test("login e logout de outra origem (CSRF) são bloqueados", async () => {
      const origem = { Origin: "https://site-malicioso.exemplo" };
      assert.equal((await api.post("/api/admin/login", { usuario: ADMIN.usuario, senha: SENHA_GESTOR }, origem)).status, 403);
      assert.equal((await api.post("/api/admin/logout", {}, origem)).status, 403);
    });
  });

  // ------------------------------------------------------------ abuso e anonimato

  describe("abuso", () => {
    test("limite de avaliações por minuto responde 429 e não grava a excedente", async () => {
      await api.parar();
      api = await iniciar(db, { avaliacoesPorMinuto: 3 });
      for (let i = 0; i < 3; i++) assert.equal((await api.post("/api/avaliacoes", { servico_id: 1, nota: 5 })).status, 201);
      assert.equal((await api.post("/api/avaliacoes", { servico_id: 1, nota: 5 })).status, 429);
      assert.equal(await contar(), 3);
    });

    test("o banco não tem coluna que identifique o estudante (IP, agente, sessão)", async () => {
      const { rows } = await db.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'avaliacoes' ORDER BY 1");
      assert.deepEqual(rows.map((r) => r.column_name),
        ["comentario", "criada_em", "id", "nota", "oculta", "servico_id"]);
    });
  });

  // ------------------------------------------------------------ entradas maliciosas

  describe("entradas", () => {
    test("corpo acima de 10 KB retorna 413", async () => {
      const r = await api.post("/api/avaliacoes", { servico_id: 1, nota: 5, comentario: "a".repeat(20000) });
      assert.equal(r.status, 413);
      assert.equal(await contar(), 0);
    });

    test("campos extras (id, oculta, criada_em) são ignorados: não dá para criar já oculto nem escolher o id", async () => {
      const r = await api.post("/api/avaliacoes", { servico_id: 1, nota: 5, oculta: true, id: 999, criada_em: "2000-01-01" });
      assert.equal(r.status, 201);
      const { rows } = await db.query("SELECT id, oculta, criada_em FROM avaliacoes");
      assert.equal(rows[0].oculta, false);
      assert.notEqual(rows[0].id, 999);
      assert.ok(new Date(rows[0].criada_em).getFullYear() >= 2026);
    });

    test("poluição de protótipo no corpo não altera o comportamento", async () => {
      const resposta = await fetch(`${api.base}/api/avaliacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"__proto__":{"nota":5,"servico_id":1},"constructor":{"prototype":{"nota":5}}}'
      });
      assert.equal(resposta.status, 400);
      assert.equal(await contar(), 0);
    });

    test("servico_id e nota como texto, lista ou objeto retornam 400", async () => {
      const corpos = [
        { servico_id: "1", nota: 5 },
        { servico_id: [1], nota: 5 },
        { servico_id: { id: 1 }, nota: 5 },
        { servico_id: 1, nota: [5] },
        { servico_id: 1, nota: { v: 5 } },
        { servico_id: 1.5, nota: 5 },
        { servico_id: -1, nota: 5 }
      ];
      for (const corpo of corpos) {
        assert.equal((await api.post("/api/avaliacoes", corpo)).status, 400, JSON.stringify(corpo));
      }
    });

    test("identificadores absurdos na moderação não causam erro de banco", async () => {
      const cookie = await logarGestor(api);
      for (const id of ["0", "-1", "99999999999999999999", "1.5", "1e3", "1%20OR%201=1", "abc"]) {
        const r = await api.patch(`/api/admin/avaliacoes/${id}`, { oculta: true }, cookie);
        assert.ok([400, 404].includes(r.status), `${id} -> ${r.status}`);
      }
    });

    test("nenhuma resposta de erro expõe pilha, SQL, driver ou caminho", async () => {
      const cookie = await logarGestor(api);
      const respostas = [
        await api.post("/api/avaliacoes", { servico_id: "x", nota: "y" }),
        await api.post("/api/avaliacoes", { servico_id: 99999, nota: 5 }),
        await api.get("/api/inexistente"),
        await api.patch("/api/admin/avaliacoes/abc", { oculta: 1 }, cookie),
        await api.patch("/api/admin/avaliacoes/9999", { oculta: true }, cookie),
        await api.post("/api/admin/login", { usuario: "x", senha: "y" })
      ];
      for (const r of respostas) assert.doesNotMatch(JSON.stringify(r.json), VAZAMENTO);
    });
  });

  // ------------------------------------------------------------ superfície exposta

  describe("superfície exposta", () => {
    test("não existem rotas destrutivas: DELETE, PUT e PATCH nas avaliações retornam 404", async () => {
      const cookie = await logarGestor(api);
      for (const metodo of ["DELETE", "PUT", "PATCH"]) {
        for (const rota of ["/api/avaliacoes", "/api/avaliacoes/1", "/api/servicos"]) {
          const r = await fetch(api.base + rota, {
            method: metodo, headers: { "Content-Type": "application/json", ...cookie }, body: "{}"
          });
          assert.equal(r.status, 404, `${metodo} ${rota}`);
        }
      }
      const del = await fetch(`${api.base}/api/admin/avaliacoes/1`, { method: "DELETE", headers: cookie });
      assert.equal(del.status, 404);
    });

    test("travessia de diretório e arquivos ocultos não são servidos", async () => {
      const rotas = ["/css/../server.js", "/css/..%2fserver.js", "/js/%2e%2e/package.json",
        "/css/%2e%2e%2f%2e%2e%2f.env", "/..%2f..%2fetc/passwd", "/.git/HEAD",
        "/node_modules/express/package.json", "/banco/schema.sql", "/src/auth.js"];
      for (const rota of rotas) {
        const r = await fetch(api.base + rota);
        assert.ok([400, 403, 404].includes(r.status), `${rota} -> ${r.status}`);
      }
    });

    test("páginas e API trazem nosniff e Referrer-Policy; a API não é guardada em cache", async () => {
      for (const rota of ["/", "/api/servicos", "/health"]) {
        const r = await fetch(api.base + rota);
        assert.equal(r.headers.get("x-content-type-options"), "nosniff", rota);
        assert.equal(r.headers.get("referrer-policy"), "no-referrer", rota);
      }
      assert.equal((await fetch(`${api.base}/api/servicos`)).headers.get("cache-control"), "no-store");
      assert.equal((await fetch(`${api.base}/`)).headers.get("x-powered-by"), null);
    });
  });
});
