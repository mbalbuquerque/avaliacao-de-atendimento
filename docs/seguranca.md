# Segurança — Avalie o Atendimento

Modelo de ameaças curto do sistema, com o que está implementado, onde está, qual teste comprova e o que
**continua aberto**. Os testes citados estão em `tests/` e rodam com `npm test`. O resultado das varreduras
automáticas está em [`relatorio-seguranca.md`](relatorio-seguranca.md).

**O que o sistema protege:** a integridade das notas (a média não pode ser adulterada), o anonimato do
estudante e o acesso do gestor à moderação.

## 1. Ameaças

### T1. Injeção de SQL e dado inválido no banco

- **Impacto:** alterar ou apagar avaliações, ler dados que não deveria, ou gravar nota/comentário inválido e
  distorcer a média.
- **Controle implementado:**
  - Toda consulta é parametrizada (`$1`, `$2`...), sem concatenar texto do usuário: `src/app.js`, `src/db.js`.
  - Validação de tipo e tamanho no servidor: `src/validacao.js`.
  - O próprio banco recusa dado inválido: `CHECK (nota BETWEEN 1 AND 5)`, `VARCHAR(280)` e chave estrangeira
    em `banco/schema.sql`.
  - O usuário do banco usado pela aplicação (`app_avaliacao`) só pode ler, inserir avaliações e atualizar a
    coluna `oculta`: `banco/permissoes.sql`. Nota, `DELETE` e `DROP` são bloqueados.
- **Testes:** api: "injeção de SQL no comentário é gravada como texto (consulta parametrizada)"; "restrições no
  banco recusam nota inválida mesmo sem passar pela API"; seguranca: "servico_id e nota como texto, lista ou
  objeto retornam 400"; "identificadores absurdos na moderação não causam erro de banco"; "poluição de
  protótipo no corpo não altera o comportamento".
- **Risco que continua aberto:** as permissões de `banco/permissoes.sql` **não são testadas no CI** (o CI cria o
  banco só com o `schema.sql`). Foram conferidas à mão no PostgreSQL da Azure, com transação desfeita
  (inserir e ocultar permitidos; alterar nota, apagar e derrubar tabela bloqueados). Se alguém conectar com o
  usuário administrador, essas travas não valem.

### T2. Sessão do gestor forjada ou roubada

- **Impacto:** quem controla a sessão oculta comentários legítimos, e o gestor perde a confiança no painel.
- **Controle implementado:**
  - Senha do gestor com hash `scrypt` e comparação em tempo constante; sessão assinada com HMAC-SHA256 e
    validade de 8 horas: `src/auth.js`.
  - Cookie `HttpOnly` (o JavaScript da página não lê), `SameSite=Strict` e `Secure` em HTTPS: `src/app.js`.
  - A senha é conferida mesmo com usuário errado, e as duas falhas dão a mesma resposta (não revela se o
    usuário existe).
  - Sem as variáveis do gestor, o login responde 503 e nunca libera.
- **Testes:** seguranca, grupo "sessão" (assinatura trocada, carga alterada, outro segredo, sessão vencida,
  cookie com lixo); api: "login: senha errada e usuário errado retornam 401 com a mesma mensagem"; "login
  correto cria cookie HttpOnly/SameSite e libera a moderação"; "sem variáveis do gestor o login responde 503
  (nunca libera)". O teste de "cookie com lixo" achou e corrigiu um defeito real (cookie com `%%%` derrubava a
  rota com erro 500).
- **Risco que continua aberto:**
  - **Não há revogação no servidor:** `logout` apaga o cookie no navegador, mas um cookie roubado continua
    valendo até vencer (8 horas). Trocar `SESSAO_SEGREDO` invalida todas as sessões de uma vez (seção 4).
  - Existe um único gestor, sem cadastro, sem recuperação de senha e sem segundo fator.
  - O segredo de assinatura é único: se vazar, qualquer sessão pode ser forjada até ele ser trocado.

### T3. Força bruta no login e abuso (spam) de avaliações

- **Impacto:** adivinhar a senha do gestor; encher o painel de notas falsas e distorcer as médias.
- **Controle implementado:**
  - Login: no máximo 10 tentativas por IP a cada 15 minutos; depois disso, 429 mesmo com a senha certa, sem criar
    sessão.
  - Avaliações: no máximo 30 por minuto por IP; a excedente responde 429 e não é gravada.
  - Corpo limitado a 10 KB (413).
  - Os limites ficam **só na memória** da aplicação e o IP não é gravado em disco, no banco nem no log (preserva
    o anonimato): `src/app.js`.
- **Testes:** seguranca: "força bruta: depois do limite de tentativas o IP recebe 429, mesmo com a senha certa";
  "limite de avaliações por minuto responde 429 e não grava a excedente"; "corpo acima de 10 KB retorna 413".
- **Risco que continua aberto:** o controle é simples. Ele zera quando a aplicação reinicia e se multiplicaria com
  mais de uma instância; quem usa muitos IPs diferentes passa por ele; e, como a avaliação é anônima, **não há
  como impedir totalmente o spam sem identificar o estudante**. O IP vem do proxy do Azure (`trust proxy`).

### T4. Quebra do anonimato do estudante

- **Impacto:** o estudante deixa de falar com franqueza se puder ser identificado; exposição de dado pessoal.
- **Controle implementado:**
  - Nenhuma tabela tem nome, e-mail, matrícula, IP ou agente: `banco/schema.sql`.
  - O log da aplicação registra só método, rota (pelo padrão), status e tempo; nunca IP, corpo, cookie, query
    string nem comentário: `src/app.js` (middleware de log).
  - O formulário avisa para não informar dados pessoais no comentário.
- **Testes:** seguranca: "o banco não tem coluna que identifique o estudante (IP, agente, sessão)"; log: os 6
  testes, em especial "comentário, cookie, query string e IP nunca aparecem no log" e "caminho com quebra de linha
  não forja linhas no log".
- **Risco que continua aberto:**
  - O estudante pode digitar dado pessoal no comentário; só a moderação manual (ocultar) trata isso, e o sistema
    não detecta sozinho.
  - O Azure App Service pode guardar registros de acesso da plataforma fora do controle do código; isso **não foi
    verificado** nesta entrega.
  - Quem tem acesso administrativo ao banco enxerga todos os comentários.

### T5. CSRF e exposição de arquivos ou segredos

- **Impacto:** outro site fazer o navegador do gestor moderar sem querer; vazamento de código, `.env` ou
  credenciais.
- **Controle implementado:**
  - Login, logout e moderação com cabeçalho `Origin` de outro site respondem 403 (`mesmaOrigem` em `src/app.js`),
    além do `SameSite=Strict` do cookie.
  - O servidor entrega só `css/`, `js/`, `icons/` e as páginas listadas; `server.js`, `src/`, `banco/`, `.env`,
    `.git` e `node_modules` respondem 404, e travessia de diretório não funciona.
  - `.env` está no `.gitignore`; o `.env.example` só tem nomes e valores falsos; o Gitleaks procura segredos no
    histórico (`.github/workflows/seguranca.yml`).
  - A API responde com `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` e `Referrer-Policy:
    no-referrer`, sem `X-Powered-By`.
- **Testes:** api: "moderação com Origin de outro site é bloqueada (403)"; "a API não serve arquivos do servidor
  (código, banco, .env)"; seguranca: "login e logout de outra origem (CSRF) são bloqueados"; "travessia de
  diretório e arquivos ocultos não são servidos"; "não existem rotas destrutivas: DELETE, PUT e PATCH nas
  avaliações retornam 404".
- **Risco que continua aberto (nada disto está aplicado ainda):**
  - **Content-Security-Policy, Strict-Transport-Security, `frame-ancestors`/anti-clickjacking e
    Permissions-Policy ainda não existem.** Estão na issue #14, em andamento. O HTTPS já é obrigatório no App
    Service, mas a aplicação ainda não envia o cabeçalho HSTS.
  - O painel carrega o Chart.js de um CDN (`cdn.jsdelivr.net`) sem verificação de integridade; a troca por uma
    cópia servida pelo próprio servidor também é parte da issue #14 e do redesenho (#22).
  - **Os formulários de login (`admin-login.html`) e de avaliação (`index.html`) ainda não declaram
    `method="post"`.** Se o JavaScript não carregar no momento do envio, o navegador usa GET e o usuário e a
    senha do gestor, ou o comentário, vão para a URL. Foi achado pelo ZAP e verificado no código; a correção
    entra no redesenho das telas (issue #22).
  - A senha do gestor e a do banco dependem de quem administra o App Service (seção 4).

### Outros riscos conhecidos

- **Indisponibilidade do banco:** a API responde 503 sem expor detalhe e o `/health` avisa (testes "banco fora do
  ar: rotas de dados e /health retornam 503 sem expor detalhes" e "sem DATABASE_URL as rotas de dados respondem
  503 e o front continua no ar"). Não há réplica nem alta disponibilidade: o servidor é um B1ms único.
- **Custo e limpeza:** o PostgreSQL gerenciado cobra por hora e precisa ser parado no fim da aula.

## 2. O que as varreduras automáticas cobrem

Resumo de [`relatorio-seguranca.md`](relatorio-seguranca.md). São ferramentas de apoio: **nenhuma substitui um
teste de invasão** nem os testes automatizados de comportamento.

| Ferramenta | Quando roda | O que cobre | O que não cobre |
|---|---|---|---|
| **CodeQL** (`codeql.yml`) | push na `main`, pull request e toda semana | análise estática do JavaScript (injeção, XSS, uso inseguro de dados) | configuração da Azure, comportamento em produção, regra de negócio |
| **Gitleaks** (`seguranca.yml`) | toda semana, sob demanda e quando `package-lock.json` ou o workflow mudam | segredos no código e no histórico do Git | segredos que estão só nas configurações do App Service ou em arquivos locais |
| **ZAP baseline** (`seguranca.yml`) | toda semana e sob demanda | varredura **passiva** da aplicação publicada (cabeçalhos, cookies, scripts de terceiros, dados na URL) | não ataca nada; não prova autorização, moderação nem lógica de negócio |
| **npm audit** (`ci.yml`) | todo push e pull request | vulnerabilidades conhecidas nas dependências de produção (nível alto ou crítico) | vulnerabilidade ainda não publicada |
| **Dependabot** (`dependabot.yml`) | toda semana | abre pull request de atualização de npm e Actions | não avalia o impacto nem corrige sozinho |

Resultado da primeira execução (18/11/2026): CodeQL e Gitleaks sem achados, `npm audit` sem vulnerabilidades,
ZAP com 0 alertas altos e 14 avisos. Os avisos que são do nosso código (cabeçalhos ausentes, CDN sem integridade
e os formulários sem `method`) **continuam abertos** e estão listados em T5 e nas issues #14 e #22. Eles só
deixam de constar como abertos depois que uma nova execução do ZAP mostrar que sumiram.

## 3. Segredos

**Onde ficam:**

| Segredo | Onde fica | Quem usa |
|---|---|---|
| `DATABASE_URL` (com a senha do usuário `app_avaliacao`) | Configurações do aplicativo no Azure App Service; no computador, no `.env` (ignorado pelo Git) | a aplicação |
| `ADMIN_USUARIO` e `ADMIN_SENHA_HASH` (hash `scrypt`, nunca a senha) | Configurações do aplicativo; `.env` local | login do gestor |
| `SESSAO_SEGREDO` (32 caracteres ou mais) | Configurações do aplicativo; `.env` local | assinatura da sessão |
| Senha do administrador do PostgreSQL | só com quem administra a Azure (não é usada pela aplicação) | criar tabelas e permissões |
| Perfil de publicação do App Service (`AZURE_WEBAPP_PUBLISH_PROFILE`) | segredo do repositório no GitHub, cadastrado por um administrador (issue #18); ainda não cadastrado | `deploy.yml` |

**O que nunca vai ao Git:** `.env`, senhas, a string de conexão real, o hash real do gestor, o segredo da
sessão, o perfil de publicação e qualquer print que mostre esses valores (nos prints, ocultar o valor). O
repositório só tem o `.env.example` com valores falsos. Se um segredo foi para o Git, **apagar o arquivo não
basta, porque ele continua no histórico**: trocar o segredo na hora.

**Como girar (valores sempre como `<...>`, nunca escritos aqui):**

1. **Senha do gestor.** Gerar o hash com `npm run hash -- "<nova senha>"`. O hash contém `$`: guardar o valor
   em arquivo ou entre aspas simples, nunca deixar o shell expandir. Atualizar `ADMIN_SENHA_HASH` nas
   configurações do aplicativo (`az webapp config appsettings set --settings "@arquivo.json"`) e reiniciar
   (`az webapp restart`). O reinício é assíncrono: esperar uns 30 segundos antes de testar o login.
2. **Todas as sessões do gestor de uma vez** (sessão suspeita ou roubada): trocar `SESSAO_SEGREDO` por um valor
   novo e aleatório de 32 caracteres ou mais, e reiniciar. Todo cookie antigo passa a ser recusado.
3. **Senha do usuário do banco da aplicação.** Com o administrador, `ALTER ROLE app_avaliacao PASSWORD '<nova>'`;
   atualizar `DATABASE_URL` nas configurações do aplicativo e reiniciar.
4. **Senha do administrador do PostgreSQL.** `az postgres flexible-server update --resource-group <grupo>
   --name <servidor> --admin-password <nova>`. A aplicação não usa essa senha.
5. Depois de qualquer troca, conferir `GET /health` (200 com `database: connected`) e o login do gestor.
