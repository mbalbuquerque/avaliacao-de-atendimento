// Aplicação Express: API do Avalie o Atendimento + arquivos do front-end.
// O banco entra por parâmetro (criarApp(db)), o que permite testar com um
// PostgreSQL em memória e trocar a conexão sem mexer nas rotas.

const express = require("express");
const path = require("path");
const { validarAvaliacao } = require("./validacao");
const auth = require("./auth");

const RAIZ = path.join(__dirname, "..");
const ID_MAXIMO = 2147483647; // limite do tipo INTEGER do PostgreSQL

// Limite simples em memória, por IP. Não grava nada em disco nem no banco:
// o IP vive só alguns minutos na RAM, então o anonimato do estudante não é afetado.
function criarLimite(maximo, janelaMs) {
  const registros = new Map();
  return (ip) => {
    const agora = Date.now();
    const antigos = (registros.get(ip) || []).filter((t) => agora - t < janelaMs);
    if (antigos.length >= maximo) {
      registros.set(ip, antigos);
      return false;
    }
    antigos.push(agora);
    registros.set(ip, antigos);
    return true;
  };
}

function criarApp(db, opcoes = {}) {
  const admin = {
    usuario: process.env.ADMIN_USUARIO,
    senhaHash: process.env.ADMIN_SENHA_HASH,
    segredo: process.env.SESSAO_SEGREDO,
    ...(opcoes.admin || {})
  };
  const adminConfigurado = () =>
    Boolean(admin.usuario && admin.senhaHash && admin.segredo && admin.segredo.length >= 32);

  const limiteAvaliacoes = criarLimite(opcoes.avaliacoesPorMinuto || 30, 60 * 1000);
  const limiteLogin = criarLimite(opcoes.tentativasDeLogin || 10, 15 * 60 * 1000);
  // Muda a cada início da aplicação: serve de prova de reinício (campo iniciado_em do /health).
  const iniciadoEm = new Date().toISOString();

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // atrás do App Service: IP e https vêm dos cabeçalhos do proxy

  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    if (req.path.startsWith("/api") || req.path === "/health") res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "10kb" }));

  // Falha de banco: 503 sem expor detalhe interno (host, usuário, SQL, mensagem do driver).
  function falhaDeBanco(res, erro) {
    console.error("Falha de banco:", erro.code || erro.message);
    return res.status(503).json({ message: "Serviço temporariamente indisponível. Tente novamente em instantes." });
  }
  const assincrono = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // ---------------------------------------------------------------- saúde

  app.get("/health", async (req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ status: "ok", database: "connected", iniciado_em: iniciadoEm });
    } catch (erro) {
      console.error("Health: banco indisponível:", erro.code || erro.message);
      res.status(503).json({ status: "erro", database: "unavailable", iniciado_em: iniciadoEm });
    }
  });

  // ---------------------------------------------------------------- público

  app.get("/api/servicos", assincrono(async (req, res) => {
    try {
      const { rows } = await db.query("SELECT id, nome FROM servicos ORDER BY id");
      res.json(rows);
    } catch (erro) {
      falhaDeBanco(res, erro);
    }
  }));

  app.post("/api/avaliacoes", assincrono(async (req, res) => {
    if (!limiteAvaliacoes(req.ip)) {
      return res.status(429).json({ message: "Muitas avaliações em pouco tempo. Aguarde um minuto." });
    }

    const { erros, dados } = validarAvaliacao(req.body);
    if (erros.length > 0) {
      return res.status(400).json({ message: erros[0], erros });
    }
    if (dados.servico_id > 32767) {
      return res.status(404).json({ message: "Serviço não encontrado." });
    }

    try {
      const { rows } = await db.query(
        "INSERT INTO avaliacoes (servico_id, nota, comentario) VALUES ($1, $2, $3) RETURNING id",
        [dados.servico_id, dados.nota, dados.comentario]
      );
      res.status(201).json({ id: rows[0].id, mensagem: "Avaliação registrada com sucesso." });
    } catch (erro) {
      // 23503 = chave estrangeira: o serviço não existe.
      if (erro.code === "23503") return res.status(404).json({ message: "Serviço não encontrado." });
      falhaDeBanco(res, erro);
    }
  }));

  // Média e quantidade vêm do banco (SQL), não da aplicação. Comentário oculto
  // continua contando: a moderação só esconde o texto, nunca a nota.
  app.get("/api/indicadores", assincrono(async (req, res) => {
    try {
      const { rows } = await db.query(`
        SELECT s.id AS servico_id,
               s.nome,
               COUNT(a.id)::int                                AS quantidade,
               COUNT(*) FILTER (WHERE a.nota = 1)::int         AS n1,
               COUNT(*) FILTER (WHERE a.nota = 2)::int         AS n2,
               COUNT(*) FILTER (WHERE a.nota = 3)::int         AS n3,
               COUNT(*) FILTER (WHERE a.nota = 4)::int         AS n4,
               COUNT(*) FILTER (WHERE a.nota = 5)::int         AS n5,
               ROUND(AVG(a.nota)::numeric, 1)                  AS media
          FROM servicos s
          LEFT JOIN avaliacoes a ON a.servico_id = s.id
         GROUP BY s.id, s.nome
         ORDER BY s.id`);

      res.json(rows.map((r) => {
        const suficiente = r.quantidade >= 3;
        return {
          servico_id: r.servico_id,
          nome: r.nome,
          quantidade: r.quantidade,
          // Menos de 3 avaliações: não divulga a média.
          media: suficiente && r.media !== null ? Number(r.media) : null,
          amostra_suficiente: suficiente,
          distribuicao: { 1: r.n1, 2: r.n2, 3: r.n3, 4: r.n4, 5: r.n5 }
        };
      }));
    } catch (erro) {
      falhaDeBanco(res, erro);
    }
  }));

  app.get("/api/comentarios", assincrono(async (req, res) => {
    try {
      const { rows } = await db.query(`
        SELECT a.id, s.nome AS servico, a.nota, a.comentario, a.criada_em
          FROM avaliacoes a
          JOIN servicos s ON s.id = a.servico_id
         WHERE a.oculta = false AND a.comentario IS NOT NULL
         ORDER BY a.criada_em DESC, a.id DESC
         LIMIT 100`);
      res.json(rows);
    } catch (erro) {
      falhaDeBanco(res, erro);
    }
  }));

  // ---------------------------------------------------------------- gestor

  // Bloqueia requisição de outro site: o navegador manda Origin nas escritas.
  function mesmaOrigem(req, res, next) {
    const origem = req.get("origin");
    if (origem && origem !== `${req.protocol}://${req.get("host")}`) {
      return res.status(403).json({ message: "Origem não autorizada." });
    }
    next();
  }

  function exigirGestor(req, res, next) {
    const usuario = auth.lerSessao(auth.lerCookie(req.get("cookie"), auth.COOKIE), admin.segredo);
    if (!usuario) return res.status(401).json({ message: "É necessário autenticar-se." });
    req.gestor = usuario;
    next();
  }

  app.post("/api/admin/login", mesmaOrigem, (req, res) => {
    if (!adminConfigurado()) {
      return res.status(503).json({ message: "Moderação não configurada neste ambiente." });
    }
    if (!limiteLogin(req.ip)) {
      return res.status(429).json({ message: "Muitas tentativas. Aguarde alguns minutos." });
    }

    const usuario = typeof req.body?.usuario === "string" ? req.body.usuario : "";
    const senha = typeof req.body?.senha === "string" ? req.body.senha : "";

    // Confere a senha sempre, mesmo com usuário errado: o tempo de resposta não revela qual falhou.
    const senhaOk = auth.conferirSenha(senha, admin.senhaHash);
    if (!senhaOk || usuario !== admin.usuario) {
      return res.status(401).json({ message: "Usuário ou senha incorretos." });
    }

    const segura = req.secure ? "; Secure" : "";
    res.set("Set-Cookie",
      `${auth.COOKIE}=${auth.criarSessao(usuario, admin.segredo)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${auth.VALIDADE_MS / 1000}${segura}`);
    res.json({ usuario });
  });

  app.post("/api/admin/logout", mesmaOrigem, (req, res) => {
    res.set("Set-Cookie", `${auth.COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    res.json({ mensagem: "Sessão encerrada." });
  });

  app.get("/api/admin/me", exigirGestor, (req, res) => res.json({ usuario: req.gestor }));

  app.get("/api/admin/avaliacoes", exigirGestor, assincrono(async (req, res) => {
    try {
      const { rows } = await db.query(`
        SELECT a.id, s.nome AS servico, a.nota, a.comentario, a.oculta, a.criada_em
          FROM avaliacoes a
          JOIN servicos s ON s.id = a.servico_id
         ORDER BY a.criada_em DESC, a.id DESC
         LIMIT 500`);
      res.json(rows);
    } catch (erro) {
      falhaDeBanco(res, erro);
    }
  }));

  app.patch("/api/admin/avaliacoes/:id", mesmaOrigem, exigirGestor, assincrono(async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ message: "Identificador inválido." });
    }
    const id = Number(req.params.id);
    if (id < 1 || id > ID_MAXIMO) {
      return res.status(404).json({ message: "Avaliação não encontrada." });
    }
    if (typeof req.body?.oculta !== "boolean") {
      return res.status(400).json({ message: "oculta deve ser verdadeiro ou falso." });
    }

    try {
      // Só muda a visibilidade: a nota nunca é apagada nem alterada na moderação.
      const { rows } = await db.query(
        "UPDATE avaliacoes SET oculta = $1 WHERE id = $2 RETURNING id, oculta",
        [req.body.oculta, id]
      );
      if (rows.length === 0) return res.status(404).json({ message: "Avaliação não encontrada." });
      res.json(rows[0]);
    } catch (erro) {
      falhaDeBanco(res, erro);
    }
  }));

  app.use("/api", (req, res) => res.status(404).json({ message: "Recurso não encontrado." }));

  // ---------------------------------------------------------------- front-end

  // Só o que o navegador precisa: o resto da pasta (server.js, banco/, .env...) nunca é servido.
  for (const pasta of ["css", "js", "icons"]) {
    app.use(`/${pasta}`, express.static(path.join(RAIZ, pasta)));
  }
  const paginas = ["index.html", "dashboard.html", "admin.html", "admin-login.html",
    "offline.html", "manifest.webmanifest", "sw.js"];
  for (const arquivo of paginas) {
    app.get(`/${arquivo}`, (req, res) => {
      if (arquivo === "sw.js") res.set("Cache-Control", "no-cache");
      res.sendFile(path.join(RAIZ, arquivo));
    });
  }
  app.get("/", (req, res) => res.sendFile(path.join(RAIZ, "index.html")));

  app.use((req, res) => res.status(404).type("text/plain").send("Página não encontrada."));

  // Erros inesperados: resposta genérica, detalhe só no log do servidor.
  app.use((erro, req, res, next) => {
    if (res.headersSent) return next(erro);
    if (erro.type === "entity.parse.failed") return res.status(400).json({ message: "JSON inválido." });
    if (erro.type === "entity.too.large") return res.status(413).json({ message: "Requisição grande demais." });
    console.error("Erro inesperado:", erro.message);
    res.status(500).json({ message: "Erro interno. Tente novamente." });
  });

  return app;
}

module.exports = { criarApp };
