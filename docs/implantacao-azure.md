# Implantação na Azure (Nível A)

**Situação: implantado (Nível A).** A aplicação está publicada no Azure App Service e usa
PostgreSQL 16 gerenciado. Este documento registra a configuração adotada e serve como roteiro
de reprodução. Os prints obrigatórios continuam pendentes em `evidencias/`.

## Antes de começar

> **Atenção (ficha do professor):**
> - Use **somente a assinatura indicada pelo professor**. Todo recurso criado gera responsabilidade de
>   custo e de exclusão. Nenhum grupo cria máquina virtual ou plano pago sem autorização.
> - Crie os recursos numa **região permitida pela assinatura**. Se a política recusar a região, recrie
>   na região listada na mensagem de erro.
> - **Regra dos 15 minutos:** bloqueados por infraestrutura há 15 minutos? Desçam um nível (A para B,
>   B para C), registrem o motivo no painel da turma e sigam construindo o produto.
> - Começar pelo `/health` mostra se o problema está na aplicação ou entre a aplicação e o banco.

Nada de segredo no repositório. Os valores abaixo em MAIÚSCULAS (`INICIAIS`, `SENHA_FORTE` etc.) são
**placeholders**: troque na hora, no terminal, e nunca faça commit deles. O `.env` está no `.gitignore`.

Variáveis de apoio para os comandos (bash). No PowerShell, defina as mesmas variáveis com
`$GRUPO = "rg-cloud-g01"` e troque a barra invertida de continuação de linha pelo acento grave:

```bash
GRUPO=rg-cloud-g01
REGIAO=brazilsouth          # ou a região permitida pela assinatura
APP=app-cloud-g01-INICIAIS  # nome global e único
SERVIDOR=pg-cloud-g01-INICIAIS
```

## 1. Entrar e conferir a assinatura

```bash
az login
az account show --query "{assinatura:name, id:id}" -o table   # confirme que é a assinatura do professor
```

## 2. Grupo de recursos

```bash
az group create --name $GRUPO --location $REGIAO --tags aula=cloud-challenge grupo=g01
```

## 3. App Service (Linux, plano gratuito F1)

```bash
az appservice plan create --name plan-cloud-g01 --resource-group $GRUPO \
  --location $REGIAO --sku F1 --is-linux

az webapp create --name $APP --resource-group $GRUPO --plan plan-cloud-g01 \
  --runtime "NODE:22-lts"
```

Confira os nomes de runtime com `az webapp list-runtimes --os linux`.

## 4. PostgreSQL (Servidor Flexível)

Versão 16, camada Burstable B1ms, 32 GiB, acesso público. Leva de 5 a 15 minutos para ficar pronto:
crie-o logo no início e siga com o resto enquanto espera.

```bash
az postgres flexible-server create --name $SERVIDOR --resource-group $GRUPO \
  --location $REGIAO --version 16 --tier Burstable --sku-name Standard_B1ms \
  --storage-size 32 --admin-user ADMIN_BANCO --admin-password 'SENHA_FORTE' \
  --public-access 0.0.0.0

# Banco da aplicação
az postgres flexible-server db create --resource-group $GRUPO \
  --server-name $SERVIDOR --database-name avalie
```

`--public-access 0.0.0.0` cria a regra "permitir serviços do Azure" (o App Service acessa o banco).
Adicione também o **IP atual** da máquina que vai rodar o script do banco:

```bash
MEU_IP=$(curl -s https://api.ipify.org)
az postgres flexible-server firewall-rule create --resource-group $GRUPO \
  --name $SERVIDOR --rule-name MeuIP --start-ip-address $MEU_IP --end-ip-address $MEU_IP
```

Se a rede do laboratório bloquear a porta 5432, use o Cloud Shell da Azure (já dentro da rede da
Azure) para o passo 6.

## 5. Configurações do aplicativo (variáveis de ambiente)

A string de conexão **nunca** vai para o código. Gere antes o hash da senha do gestor:

```bash
npm run hash -- "SENHA-DO-GESTOR-COM-8-OU-MAIS"     # imprime scrypt$sal$hash
```

Gere também um segredo aleatório de 32 caracteres ou mais para assinar a sessão do gestor
(`openssl rand -hex 32`). Depois configure (use **aspas simples**, o hash tem `$`):

```bash
az webapp config appsettings set --name $APP --resource-group $GRUPO --settings \
  DATABASE_URL='postgres://ADMIN_BANCO:SENHA_FORTE@SERVIDOR.postgres.database.azure.com:5432/avalie?sslmode=require' \
  ADMIN_USUARIO='gestor' \
  ADMIN_SENHA_HASH='scrypt$SAL_HEX$HASH_HEX' \
  SESSAO_SEGREDO='SEGREDO_ALEATORIO_COM_32_CARACTERES_OU_MAIS' \
  SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

(`SERVIDOR` na URL é o nome do servidor criado no passo 4, ou seja, `pg-cloud-g01-INICIAIS`.)
Se a senha do banco tiver caractere especial (`@`, `:`, `/`, `#`), codifique-o na URL.
Tire um print das variáveis com o valor oculto (evidência E5).

### Configurações opcionais

Além das cinco obrigatórias, o app aceita ajustes opcionais nas mesmas "Configurações do aplicativo", todos com
padrão (tabela completa no `README.md` e comentários em `.env.example`): `LIMITE_GERAL_POR_MINUTO`,
`LIMITE_AVALIACOES_POR_MINUTO`, `LIMITE_LOGIN_TENTATIVAS`, `LIMITE_LOGIN_JANELA_MINUTOS`, `SESSAO_HORAS`,
`TAMANHO_MAXIMO_CORPO_KB`, `COMENTARIOS_PUBLICOS_MAXIMO`, `AVALIACOES_GESTOR_MAXIMO`, `BANCO_CONEXOES_MAXIMAS`,
`BANCO_TIMEOUT_CONEXAO_MS` e `BANCO_TIMEOUT_OCIOSO_MS`. Valor inválido derruba a subida com uma mensagem clara
no log, para o erro aparecer no primeiro minuto e não só em produção. Exemplo:

```bash
az webapp config appsettings set --name app-cloud-g01-XX --resource-group rg-cloud-g01 \
  --settings SESSAO_HORAS=4 LIMITE_GERAL_POR_MINUTO=300
```

## 6. Criar as tabelas e os serviços no banco da Azure

Da raiz do repositório, apontando para o banco da Azure (a variável vale só nesse comando):

```bash
DATABASE_URL='postgres://ADMIN_BANCO:SENHA_FORTE@SERVIDOR.postgres.database.azure.com:5432/avalie?sslmode=require' \
  npm run banco
```

O `schema.sql` cria as tabelas e os quatro serviços e não carrega nenhuma avaliação: sem a carga de demonstração o painel mostra só o que
os estudantes enviarem. Para a apresentação, acrescente `-- --demonstracao` ao comando (`npm run banco -- --demonstracao`):
carrega 20 avaliações fictícias, só uma vez. Se a conexão recusar o certificado, tente `sslmode=no-verify` apenas
neste comando de preparação e registre o motivo (esse ajuste não foi testado neste projeto ainda).

## 7. Publicar a aplicação

Com o terminal na raiz do projeto e `az login` feito:

```bash
az webapp up --name $APP --resource-group $GRUPO --plan plan-cloud-g01 \
  --runtime "NODE:22-lts" --location $REGIAO
```

Se preferir o deploy por GitHub (Centro de Implantação) ou pela extensão Azure App Service do VS Code,
funcionam do mesmo jeito. O App Service executa `npm start` e escuta na porta de `PORT`.

## 8. Verificar

```bash
curl https://$APP.azurewebsites.net/health
# esperado: {"status":"ok","database":"connected","iniciado_em":"..."}

curl https://$APP.azurewebsites.net/api/indicadores
```

Abra a URL pública no navegador (evidência E1). Se der *Application Error*, abra o fluxo de log
(passo 10) e confira a porta, as dependências e a variável `DATABASE_URL`.

## 9. Prova de persistência e reinício

Rode `evidencias/prova-persistencia.sh` (ou `.ps1`) apontando para a URL pública. Para o passo do
reinício:

```bash
az webapp restart --name $APP --resource-group $GRUPO
```

Depois confira que `iniciado_em` mudou e que o registro `G01-PALAVRA` continua listado. Mostre a
mesma linha numa consulta direta ao banco (Editor de consultas ou Cloud Shell com `psql`).

## 10. Logs

```bash
az webapp log config --name $APP --resource-group $GRUPO \
  --application-logging filesystem --level information
az webapp log tail --name $APP --resource-group $GRUPO
```

No portal: Monitoramento, Logs do Serviço de Aplicativo, Log de aplicativo (Sistema de arquivos) e
depois Fluxo de log.

## 11. Encerramento (custos)

Antes de sair, pare o que cobra por hora:

```bash
az postgres flexible-server stop --name $SERVIDOR --resource-group $GRUPO
```

Na data informada pelo professor, exclua o grupo de recursos inteiro:

```bash
az group delete --name $GRUPO --yes --no-wait
```

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| *Application Error* depois do deploy | A aplicação não ouve a porta `PORT` ou faltam dependências | Abrir o fluxo de log; o `server.js` já usa `process.env.PORT` |
| `/health` com 503 ou timeout | Firewall do banco não libera a origem, ou `DATABASE_URL` errada | Conferir a regra "serviços do Azure" e a string de conexão |
| `ECONNREFUSED` com localhost | `DATABASE_URL` não carregada | Configurar a variável no App Service ou usar `npm run dev` com `.env` |
| `password authentication failed` | Usuário ou senha errados, ou caractere especial sem codificação na URL | Testar o mesmo login no Cloud Shell |
| `no pg_hba.conf entry ... no encryption` | Conexão sem TLS | Usar `sslmode=require` |
| Erro de política ao criar recurso | Região não permitida pela assinatura | Recriar na região listada na mensagem |
| Datas com 3 horas de diferença | O App Service usa UTC | O banco guarda `TIMESTAMPTZ`; converter na exibição |

## Deploy automático (GitHub Actions)

O workflow `.github/workflows/deploy.yml` roda a cada push na `main`: lint, testes com cobertura e,
**se o segredo existir**, publica no App Service e confere o `/health`. Sem o segredo ele apenas avisa
e termina sem erro.

Para ligar a publicação automática (quem for administrador do repositório):

1. Gerar o perfil de publicação do app (contém credenciais: não imprimir em canal público, não colocar no Git):
   ```bash
   az webapp deployment list-publishing-profiles --name app-cloud-g01-en --resource-group rg-cloud-g01 --xml
   ```
2. No GitHub: Settings > Secrets and variables > Actions > New repository secret, nome
   `AZURE_WEBAPP_PUBLISH_PROFILE`, valor = o XML inteiro.
3. Se o `az` reclamar de autenticação básica, habilitar a publicação por credenciais no App Service
   (Configuração > Configurações gerais > "SCM Basic Auth Publishing Credentials").
4. Fazer um push na `main` e acompanhar a aba Actions.

O perfil só vale para este app e pode ser revogado em "Redefinir perfil de publicação" no portal.

### Variáveis do repositório dos workflows

Os workflows `deploy.yml` e `seguranca.yml` não têm o nome do app nem a URL escritos no meio do código: leem
**variáveis do repositório** (Settings > Secrets and variables > Actions > aba Variables; não são segredos):

| Variável | Padrão se não existir | Usada por |
|---|---|---|
| `AZURE_WEBAPP_NAME` | `app-cloud-g01-en` | `deploy.yml` (nome do App Service) |
| `APP_URL` | `https://<AZURE_WEBAPP_NAME>.azurewebsites.net` | `deploy.yml` (conferência do `/health`) e `seguranca.yml` (alvo do ZAP) |

Se o app for recriado com outro nome, é só mudar essas variáveis, sem editar workflow.
