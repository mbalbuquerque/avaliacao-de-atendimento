# CI/CD e infraestrutura: guia para revisar e habilitar

Para quem vai revisar o CI/CD (Gabriel) e para quem administra o repositório (Marcelo) e a Azure (Everson).
Tudo abaixo é real e roda hoje: não há nada simulado. A única peça que falta está na seção 4.

## 1. Onde o projeto está hospedado

Tudo na Azure, na assinatura Azure for Students, em um único grupo de recursos.

| Peça | Serviço Azure | Nome | O que faz |
|---|---|---|---|
| Aplicação (front-end **e** API) | **App Service** (Linux, plano F1, Node 22 LTS) | `app-cloud-g01-en` | Um único processo Express serve as páginas e a API; não há hospedagem separada para o front |
| Banco de dados | **Azure Database for PostgreSQL, Flexible Server** 16, B1ms, 32 GiB | `pg-cloud-g01-mqbnr` (banco `avaliacao`) | Guarda serviços e avaliações |
| Grupo de recursos | Resource group | `rg-cloud-g01` (região Brazil South) | Agrupa tudo para excluir de uma vez |

URL pública: https://app-cloud-g01-en.azurewebsites.net · saúde: `/health` (confirma a conexão com o banco).

Configuração da aplicação (variáveis de ambiente no App Service, nunca no repositório): `DATABASE_URL`, `ADMIN_USUARIO`,
`ADMIN_SENHA_HASH`, `SESSAO_SEGREDO`. Lista completa no [`.env.example`](../.env.example).

## 2. Workflows do GitHub Actions

Todos em [`.github/workflows/`](../.github/workflows/). O repositório tem Dependabot semanal para npm e Actions.

| Workflow | Gatilho | O que faz |
|---|---|---|
| `ci.yml` | todo `push` e todo `pull_request` | **4 jobs:** lint e testes com cobertura mínima (90% de linhas, 80% de ramos); a mesma suíte contra um **PostgreSQL 16 real** (service container); testes **e2e no navegador** (Playwright + PostgreSQL 16 real); `npm audit` das dependências de produção |
| `codeql.yml` | `push` na `main`, `pull_request` e toda segunda-feira | Análise estática de segurança (CodeQL, JavaScript) |
| `seguranca.yml` | manual, toda segunda-feira e quando `package-lock.json` ou o próprio arquivo mudam | Gitleaks (segredos no histórico) e ZAP baseline passivo contra a URL publicada, com relatório como artefato |
| `deploy.yml` | `push` na `main` e manual | `testar` (lint e cobertura) → `segredo` (confere se o segredo de publicação existe) → `publicar` (empacota, publica no App Service e confere o `/health`). Sem o segredo, **`publicar` aparece como ignorado**, nunca como sucesso |

Fluxo de trabalho: issue → branch → pull request com `Closes #N` → CI verde → merge na `main`. Ver [README](../README.md), seção 10.

## 3. O que já está provado

- Testes: `npm test` (PGlite, que é PostgreSQL de verdade em memória) e `npm run test:e2e`; no CI rodam contra PostgreSQL 16 real.
- Segurança: testes de ataque (`tests/seguranca.test.js`), cabeçalhos e CSP (`tests/cabecalhos.test.js`), XSS (`tests/xss.test.js`).
- Produção verificada à mão com `curl`: `/health`, cabeçalhos de segurança, arquivos privados em 404 e login do gestor.

## 4. O que falta: um segredo no GitHub (issue #18)

O `deploy.yml` precisa do **perfil de publicação** do App Service (as credenciais de deploy daquele app) guardado como segredo do
repositório com o nome **`AZURE_WEBAPP_PUBLISH_PROFILE`**. É o único passo que falta para o deploy automático funcionar.

Quem faz o quê:

1. **Quem tem a Azure (Everson)** gera o perfil, que é um XML com credenciais:
   ```bash
   az webapp deployment list-publishing-profiles --name app-cloud-g01-en --resource-group rg-cloud-g01 --xml
   ```
   Passar ao administrador do repositório **no privado**, nunca em grupo, issue ou commit.
2. **Quem administra o repositório (Marcelo)** cadastra: Settings → Secrets and variables → Actions → New repository secret →
   nome `AZURE_WEBAPP_PUBLISH_PROFILE`, valor = o XML inteiro. Cadastrar segredo exige permissão de administrador.
3. Dar um push na `main` (ou rodar o workflow manualmente) e conferir na aba Actions que `publicar` rodou e o `/health` passou.

Quem revisa o CI/CD **não precisa de nenhuma credencial** para revisar os workflows. Só precisa delas quem vai cadastrar o segredo.
O nome do app e a URL ficam no topo do `deploy.yml` e podem ser sobrescritos por variáveis do repositório
(`AZURE_WEBAPP_NAME`, `APP_URL`).

## 5. Sugestões para a revisão (todas exigem administrador do repositório)

- Proteger a `main`: exigir pull request e os checks `Lint e testes com cobertura`, `Testes contra PostgreSQL 16`,
  `Testes e2e no navegador (PostgreSQL 16 real)` e `Análise CodeQL (JavaScript)` antes do merge.
- Exigir uma aprovação de outra pessoa nos pull requests (a ficha pede PRs revisados).
- Ligar *secret scanning* e *push protection* do GitHub.
- Opcional: trocar o perfil de publicação por login federado (OIDC) com a Azure, que dispensa guardar credencial no GitHub.

## 6. Rodar tudo localmente

```bash
npm ci
npm run lint
npm run test:cobertura     # testes com cobertura mínima (PGlite)
npm run test:e2e           # navegador real (precisa do Chromium do Playwright)
npm run auditar            # npm audit de produção
```
