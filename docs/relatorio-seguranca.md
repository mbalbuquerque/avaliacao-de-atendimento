# Relatório de segurança (verificações automáticas)

Primeira execução: 18/11/2026, no pull request que criou as varreduras (execução do workflow
`Segurança`, artefato `relatorio-zap` guardado na execução). As varreduras rodam em pull request
quando o próprio workflow muda, a cada push na `main` que altere `package-lock.json` ou o workflow,
sob demanda (`workflow_dispatch`) e toda segunda-feira.

## O que cada varredura cobre

| Varredura | Arquivo | O que verifica | O que NÃO verifica |
|---|---|---|---|
| **CodeQL** (JavaScript) | `.github/workflows/codeql.yml` | Análise estática do código do servidor e do front-end: injeção, XSS, uso inseguro de dados do usuário, expressões regulares perigosas | Configuração da Azure, comportamento em produção, lógica de negócio |
| **Gitleaks** | `.github/workflows/seguranca.yml` | Segredos (senhas, tokens, chaves) no código e, nas execuções agendadas e manuais, em todo o histórico do Git | Segredos fora do repositório (configurações do App Service, arquivos locais) |
| **ZAP baseline** | `.github/workflows/seguranca.yml` | Varredura **passiva** da aplicação publicada: observa as respostas HTTP (cabeçalhos, cookies, scripts de terceiros, comentários, dados na URL) | Não ataca nem tenta explorar nada. **Não é teste de invasão.** Não prova que a autorização, a moderação e a lógica de negócio estão corretas (isso é coberto pelos testes automatizados) |
| **npm audit** | `.github/workflows/ci.yml` | Vulnerabilidades conhecidas nas dependências de produção | Vulnerabilidades ainda não publicadas |
| **Dependabot** | `.github/dependabot.yml` | Abre PR semanal com atualizações de npm e de GitHub Actions | Não corrige sozinho nem avalia o impacto |

## Resultado da primeira execução

| Verificação | Resultado |
|---|---|
| CodeQL | passou, sem alertas |
| Gitleaks | **nenhum segredo encontrado** (no pull request o Gitleaks examina só os commits do PR; o histórico inteiro é examinado nas execuções agendadas e manuais) |
| ZAP baseline em `https://app-cloud-g01-en.azurewebsites.net/` | **0 alertas altos (FAIL), 14 avisos e 54 verificações sem apontamento** |

## Avisos do ZAP e triagem

Nenhum aviso é de severidade alta. Eles são listados por origem. **Esta issue não corrige nada do
código:** os itens do grupo A seguem para as issues #14 (cabeçalhos, CSP, Chart.js local) e #15
(front-end).

### A. Do nosso código (a corrigir)

| Aviso (ZAP) | Onde aparece | Ação |
|---|---|---|
| Content Security Policy (CSP) ausente [10038] | `/`, `/index.html`, `/dashboard.html`, `/admin-login.html` | Issue #14 |
| Strict-Transport-Security ausente [10035] | `/`, `/css/style.css`, `/dashboard.html` (e as 404 `/robots.txt` e `/sitemap.xml`) | Issue #14 |
| Anti-clickjacking ausente [10020] | `/`, `/index.html`, `/dashboard.html`, `/admin-login.html` | Issue #14 (`frame-ancestors 'none'`) |
| Permissions-Policy ausente [10063] | `/`, `/admin-login.html`, `/dashboard.html`, `/js/*.js` | Issue #14 |
| Cross-Origin-Embedder-Policy ausente [90004] | páginas e scripts | Issue #14 (avaliar: pode quebrar recursos de terceiros; some junto com o Chart.js local) |
| Script de outro domínio [10017] e Subresource Integrity ausente [90003] | `/dashboard.html` carrega Chart.js de `cdn.jsdelivr.net` | Issue #14: servir o Chart.js pelo próprio servidor |
| Cache-Control a rever [10015] e conteúdo armazenável [10049] | páginas, `style.css`, `manifest.webmanifest` | Issue #14: páginas com `no-cache`; estáticos com validade definida |
| **Informação sensível na URL [10024]** e requisição de autenticação identificada [10111] | `/admin-login.html?...` e `/?comment=...&service=1` | **Achado real, verificado no código:** os formulários de `admin-login.html` (`#loginForm`) e `index.html` (`#reviewForm`) não declaram `method`, então o navegador usa GET. Se o JavaScript não estiver carregado no momento do envio, o **usuário e a senha do gestor e o texto do comentário vão para a URL** (histórico do navegador, logs de proxy). Correção: `method="post"` nos dois formulários (o JavaScript já cancela o envio nativo). Issue #15 |

### B. Falso positivo ou informativo

| Aviso (ZAP) | Onde aparece | Avaliação |
|---|---|---|
| Comentários suspeitos [10027] | `/js/admin.js` | Falso positivo: o comentário do arquivo diz "Nenhuma senha ou token é guardado no navegador" (contém a palavra "senha"). Não há segredo no código |
| Sessão identificada [10112] e autenticação identificada [10111] | `/` | Informativo: o ZAP apenas reconhece o fluxo de login |

### C. Da plataforma Azure (fora do código da aplicação)

| Aviso (ZAP) | Onde aparece | Avaliação |
|---|---|---|
| Cookie com `SameSite=None` [10054] | `/` | Cookies `ARRAffinity` e `ARRAffinitySameSite` criados pelo App Service (afinidade de instância). O cookie de sessão do gestor, criado pela aplicação, usa `SameSite=Strict`. Pode ser desligado em "Afinidade de ARR" no App Service |
| HSTS e cache em `/robots.txt` e `/sitemap.xml` | respostas 404 | Mesmas correções do grupo A; as páginas 404 do Express passam a receber os cabeçalhos junto com a issue #14 |

## O que continua aberto

- Varredura **ativa** do ZAP (full scan) autenticada como gestor, em ambiente de teste; hoje só há a passiva.
- Confirmar nas próximas execuções semanais que os avisos do grupo A sumiram depois das issues #14 e #15.
- Cadastrar o segredo `AZURE_WEBAPP_PUBLISH_PROFILE` (issue #18) para o deploy automático; exige permissão de administrador do repositório.
