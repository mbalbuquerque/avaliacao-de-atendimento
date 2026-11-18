# Regras de negócio — Avalie o Atendimento

**Projeto:** Cloud Challenge — Grupo 1 | SENAC 2026.2
**Desafio:** 13 — Avalie o Atendimento
**Status:** regras implementadas na API e no banco, cada uma com o teste automatizado que a comprova.

Os testes citados estão em [`tests/api.test.js`](../tests/api.test.js), [`tests/seguranca.test.js`](../tests/seguranca.test.js)
e [`tests/log.test.js`](../tests/log.test.js) e rodam com `npm test`. O formato das rotas está em
[`contrato-api.md`](contrato-api.md) e o modelo de ameaças em [`seguranca.md`](seguranca.md).

## 1. Atores

- **Estudante:** registra avaliação sem login nem cadastro e consulta indicadores e comentários públicos.
- **Gestor:** autentica-se no servidor, consulta todas as avaliações (inclusive as ocultas) e oculta ou
  reexibe comentários.

## 2. Serviços

| ID | Serviço |
|---|---|
| 1 | Secretaria |
| 2 | Biblioteca |
| 3 | Cantina |
| 4 | Laboratórios |

Os IDs são os gerados pelo banco na ordem de inserção do `banco/schema.sql`. O front-end sempre os lê de
`GET /api/servicos`; não deve presumi-los fixos.

## 3. Regras

Cada regra aponta o lugar onde está implementada e o teste que a prova (nome do teste entre aspas).

### 3.1 Registro de avaliações

| Regra | Descrição | Onde está | Teste que comprova |
|---|---|---|---|
| **RN01** Catálogo de serviços | Só serviços cadastrados recebem avaliação. Os quatro serviços entram por script SQL. Serviço inexistente responde 404. | `banco/schema.sql` (`INSERT` e chave estrangeira); `src/app.js` (`POST /api/avaliacoes`) | api: "RF01: os quatro serviços vêm do script SQL inicial"; "serviço inexistente retorna 404" |
| **RN02** Sem cadastro | O estudante não informa nome, e-mail nem matrícula. Nenhuma tabela nem log guarda identificador dele. | `banco/schema.sql` (sem coluna pessoal); formulário público | seguranca: "o banco não tem coluna que identifique o estudante (IP, agente, sessão)"; log: "comentário, cookie, query string e IP nunca aparecem no log" |
| **RN03** Nota obrigatória | Nota **inteira de 1 a 5**. Valores 0, 6, 3,5, texto, lista, objeto ou ausência respondem 400 e nada é gravado. O banco também recusa (`CHECK`). | `src/validacao.js`; `banco/schema.sql` | api: "CA1: nota 0, 6, 3.5, texto ou ausente retornam 400 e nada é gravado"; "CA1: notas de 1 a 5 são aceitas com HTTP 201"; "restrições no banco recusam nota inválida mesmo sem passar pela API"; seguranca: "servico_id e nota como texto, lista ou objeto retornam 400" |
| **RN04** Comentário opcional | Pode ficar vazio; com texto, no **máximo 280 caracteres**, contados por caractere (acento e emoji valem 1), com espaços das pontas removidos. 281 responde 400. Corpo acima de 10 KB responde 413. | `src/validacao.js`; `banco/schema.sql` (`VARCHAR(280)`); `src/app.js` (limite do corpo) | api: "CA2: comentário de 281 caracteres retorna 400; de 280 é aceito"; "CA2: conta caracteres, não bytes (acentos e emoji valem 1)"; seguranca: "corpo acima de 10 KB retorna 413" |
| **RN05** Serviço válido | A avaliação referencia um serviço existente: a chave estrangeira garante no banco e a API responde 404 (inclusive para ids absurdos). | `banco/schema.sql`; `src/app.js` | api: "serviço inexistente retorna 404"; "restrições no banco recusam nota inválida mesmo sem passar pela API" |
| **RN06** Persistência | As avaliações ficam no PostgreSQL e continuam disponíveis depois de reiniciar a aplicação. `localStorage` não é usado para dados. | `src/db.js`; `banco/schema.sql` | api: "persistência: depois de reiniciar a aplicação o registro continua lá"; "banco novo: traz só os 4 serviços e nenhuma avaliação: nada é inventado" |
| **RN07** Campos controlados pelo servidor | `id`, `oculta` e `criada_em` não podem ser escolhidos pelo cliente: campos extras no corpo são ignorados. | `src/validacao.js` (só lê `servico_id`, `nota`, `comentario`) | seguranca: "campos extras (id, oculta, criada_em) são ignorados: não dá para criar já oculto nem escolher o id"; "poluição de protótipo no corpo não altera o comportamento" |

### 3.2 Indicadores

| Regra | Descrição | Onde está | Teste que comprova |
|---|---|---|---|
| **RN08** Quantidade e distribuição | Por serviço, conta todas as avaliações válidas (inclusive as de comentário oculto) e a quantidade de cada nota de 1 a 5. Serviço sem avaliação aparece com quantidade 0. | `src/app.js` (`GET /api/indicadores`, `COUNT ... FILTER` no SQL) | api: "CA3: notas 5, 4 e 4 resultam em média 4,3 e quantidade 3"; "CA4: serviço sem avaliação aparece com quantidade 0 e média nula" |
| **RN09** Média | Média aritmética das notas, calculada **no banco** (`ROUND(AVG(nota)::numeric, 1)`), com **uma casa decimal**, só quando há pelo menos 3 avaliações. | `src/app.js` | api: "CA3: notas 5, 4 e 4 resultam em média 4,3 e quantidade 3" |
| **RN10** Amostra insuficiente | Com **menos de 3** avaliações, a API devolve `media: null` e `amostra_suficiente: false` e o painel mostra "Amostra insuficiente". Quantidade e distribuição continuam visíveis. | `src/app.js`; painel (`js/dashboard.js`) | api: "CA4: com duas avaliações a média é nula (amostra insuficiente)" |

Exemplo (CA03):

```text
notas = [5, 4, 4]      quantidade = 3
media = 13 / 3 = 4,333...      media_exibida = 4,3
```

### 3.3 Comentários e moderação

| Regra | Descrição | Onde está | Teste que comprova |
|---|---|---|---|
| **RN11** Comentários públicos | `GET /api/comentarios` devolve só comentários não ocultos e não vazios, do mais novo ao mais antigo, no máximo 100. Avaliação sem comentário conta nos indicadores, mas não aparece na lista. | `src/app.js` | api: "CA5: comentário oculto some da lista pública, mas a nota continua na média"; "lista do gestor traz comentários ocultos; a pública não" |
| **RN12** Moderação sem alterar a nota | O gestor oculta ou reexibe um comentário (`PATCH /api/admin/avaliacoes/{id}` com `oculta` booleano). Ocultar **não apaga a avaliação** e não muda nota, quantidade, distribuição nem média. Não existe rota para apagar ou editar nota ou texto. | `src/app.js`; `banco/permissoes.sql` (o usuário da aplicação só pode atualizar a coluna `oculta`) | api: "CA5: ..."; "moderação valida o corpo: oculta precisa ser booleano"; seguranca: "identificadores absurdos na moderação não causam erro de banco"; "não existem rotas destrutivas: DELETE, PUT e PATCH nas avaliações retornam 404" |

### 3.4 Acesso do gestor

| Regra | Descrição | Onde está | Teste que comprova |
|---|---|---|---|
| **RN13** Autenticação no servidor | Só o gestor autenticado lê dados de moderação ou altera `oculta`. Senha conferida com hash `scrypt`; sessão assinada com HMAC-SHA256, cookie `HttpOnly`, `SameSite=Strict`, `Secure` em HTTPS, validade de 8 horas. Sem sessão, 401. Usuário e senha errados dão a mesma resposta. | `src/auth.js`; `src/app.js` | api: "moderação sem login retorna 401; com cookie falso também"; "login: senha errada e usuário errado retornam 401 com a mesma mensagem"; "login correto cria cookie HttpOnly/SameSite e libera a moderação"; "logout encerra a sessão no navegador"; seguranca: os 5 testes do grupo "sessão" |
| **RN14** Origem das escritas | Login, logout e moderação com cabeçalho `Origin` de outro site respondem 403 (CSRF). | `src/app.js` (`mesmaOrigem`) | api: "moderação com Origin de outro site é bloqueada (403)"; seguranca: "login e logout de outra origem (CSRF) são bloqueados" |
| **RN15** Sem configuração, sem acesso | Sem `ADMIN_USUARIO`, `ADMIN_SENHA_HASH` ou `SESSAO_SEGREDO` (de 32 caracteres ou mais), o login responde 503 e nunca libera. | `src/app.js` | api: "sem variáveis do gestor o login responde 503 (nunca libera)" |

### 3.5 Limites, falhas e privacidade

| Regra | Descrição | Onde está | Teste que comprova |
|---|---|---|---|
| **RN16** Limite de avaliações | No máximo 30 avaliações por minuto por IP; excedente responde 429 e não é gravado. O IP vive só na memória, por 1 minuto. | `src/app.js` (`criarLimite`) | seguranca: "limite de avaliações por minuto responde 429 e não grava a excedente" |
| **RN17** Limite de tentativas de login | No máximo 10 tentativas de login por IP em 15 minutos; depois disso 429, mesmo com a senha certa, e nenhuma sessão é criada. | `src/app.js` | seguranca: "força bruta: depois do limite de tentativas o IP recebe 429, mesmo com a senha certa" |
| **RN18** Falha de banco | Banco indisponível: rotas de dados e `/health` respondem 503 sem expor host, usuário, SQL nem mensagem do driver. `/health` testa a conexão de verdade e traz `iniciado_em`. | `src/app.js`; `src/db.js` | api: "banco fora do ar: rotas de dados e /health retornam 503 sem expor detalhes"; "/health confirma a conexão com o banco"; "sem DATABASE_URL as rotas de dados respondem 503 e o front continua no ar" |
| **RN19** Erros sem detalhe interno | Nenhuma resposta de erro traz pilha, SQL, driver ou caminho de arquivo; JSON inválido responde 400. | `src/app.js` (manipulador de erros) | api: "JSON malformado retorna 400 sem detalhe interno"; seguranca: "nenhuma resposta de erro expõe pilha, SQL, driver ou caminho"; "cookie vazio, sem ponto ou com lixo é recusado sem derrubar o servidor" |
| **RN20** Anonimato nos logs | Cada requisição gera uma linha JSON com método, rota (pelo padrão, ex.: `/api/admin/avaliacoes/:id`), status e tempo. **Nunca** registra IP, corpo, cookie, query string nem comentário. `/health` fica fora. | `src/app.js` (middleware de log) | log: os 6 testes de "log de requisições" |
| **RN21** Superfície mínima | O servidor entrega só `css/`, `js/`, `icons/` e as páginas listadas. Código, `banco/`, `.env`, `.git` e `node_modules` respondem 404; a API não é guardada em cache (`no-store`) e responde com `nosniff`. | `src/app.js` | api: "a API não serve arquivos do servidor (código, banco, .env)"; "respostas da API não são guardadas em cache e trazem nosniff"; seguranca: "travessia de diretório e arquivos ocultos não são servidos"; "páginas e API trazem nosniff e Referrer-Policy; a API não é guardada em cache" |

## 4. Requisitos funcionais de referência

| Requisito | Regras relacionadas |
|---|---|
| RF01 — Carregar serviços por script SQL | RN01 |
| RF02 — Registrar avaliação anônima com nota de 1 a 5 | RN02–RN07, RN16 |
| RF03 — Exibir média, quantidade e distribuição | RN08–RN09 |
| RF04 — Exibir amostra insuficiente | RN10 |
| RF05 — Ocultar comentário sem alterar média | RN11–RN15 |

## 5. Casos de aceite obrigatórios

| Caso | Entrada | Resultado esperado | Teste automatizado |
|---|---|---|---|
| CA01 | Notas 0, 6 e 3,5 enviadas direto à API | HTTP 400 para cada valor | api: "CA1: nota 0, 6, 3.5, texto ou ausente retornam 400 e nada é gravado" |
| CA02 | Comentário com 281 caracteres direto à API | HTTP 400 | api: "CA2: comentário de 281 caracteres retorna 400; de 280 é aceito" |
| CA03 | Notas 5, 4 e 4 para um serviço isolado | Quantidade 3 e média 4,3 | api: "CA3: notas 5, 4 e 4 resultam em média 4,3 e quantidade 3" |
| CA04 | Apenas duas avaliações para um serviço isolado | "Amostra insuficiente"; média não exibida (`null`) | api: "CA4: com duas avaliações a média é nula (amostra insuficiente)" |
| CA05 | Ocultar o comentário de uma avaliação existente | Some da consulta pública; a nota segue nos indicadores; reexibir devolve | api: "CA5: comentário oculto some da lista pública, mas a nota continua na média" |

Cada teste usa um banco novo, então os dados de um caso não alteram o outro.

## 6. Modelo de dados

Arquivo completo: [`banco/schema.sql`](../banco/schema.sql).

### `servicos`

- `id` — chave primária (`SMALLSERIAL`).
- `nome` — único e obrigatório (`VARCHAR(60)`).

### `avaliacoes`

- `id` — chave primária (`SERIAL`).
- `servico_id` — chave estrangeira para `servicos`, obrigatória.
- `nota` — inteiro de 1 a 5, obrigatório (`CHECK`).
- `comentario` — texto opcional de até 280 caracteres (`VARCHAR(280)`).
- `oculta` — booleano, padrão `false`.
- `criada_em` — `TIMESTAMPTZ`, padrão `now()`.

As restrições valem no banco e são verificadas também na API. O usuário que a aplicação usa em produção
(`app_avaliacao`, [`banco/permissoes.sql`](../banco/permissoes.sql)) só pode ler, inserir avaliações e
atualizar a coluna `oculta`.

## 7. Privacidade

- Nenhuma tabela guarda nome, e-mail, matrícula, IP ou agente do estudante.
- O formulário orienta a não escrever dados pessoais no comentário; comentário impróprio é tratado pela
  moderação (RN12). Isso depende do estudante e do gestor: o sistema não detecta dado pessoal no texto.
- O limite contra abuso e o log não gravam o IP (RN16 e RN20).
- O `schema.sql` só cria os 4 serviços. Para a apresentação existe uma carga opcional de 20 avaliações fictícias
  (`banco/dados-demonstracao.sql`, `npm run banco -- --demonstracao`), gravada no PostgreSQL de verdade e lida pela
  mesma API (não é mock). Cada teste automatizado cria os próprios dados.

## 8. Evidências para a entrega

Para cada caso CA01–CA05 a evidência é o teste da tabela da seção 5 (resultado no CI de cada pull request).
Os registros que dependem de pessoas e do dia (prova de persistência com a palavra do dia, teste do
professor, prints com data e hora) seguem o roteiro de [`evidencias/`](../evidencias/README.md).
