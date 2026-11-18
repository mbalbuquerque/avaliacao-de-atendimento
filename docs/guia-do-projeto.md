# Guia do projeto: entender, explicar e apresentar

Para quem vai ler e apresentar o **Avalie o Atendimento** (Grupo 1, Desafio 13). Tudo o que o professor pediu, o que já está
feito, onde está cada coisa, como funciona por dentro, como o trabalho foi conduzido e o que dizer na apresentação.
A ficha diz que **a pergunta pode cair em qualquer integrante**, então leia do começo ao fim, principalmente as seções 3, 4 e 8.

## 1. O que o professor pediu (ficha do Cloud Challenge)

A ideia central da ficha: **publicar uma página bonita sem banco de dados não é entregar**. Vale mais um produto simples que
guarda dados de verdade, sobrevive a um reinício e que o grupo sabe justificar.

**Regras gerais**
- Tela web ou API, com pelo menos um cadastro, uma consulta e uma atualização, e dados **num banco** (lista em memória ou arquivo não conta).
- Validação no servidor e erros claros (400, 404, 409, 503) sem expor detalhe interno.
- Rota `GET /health` que testa a conexão com o banco.
- String de conexão só na variável `DATABASE_URL`; o `.env` nunca vai para o Git.
- Consultas parametrizadas (nunca concatenar texto digitado no SQL).
- Só dados fictícios; README com arquitetura, testes e evidências.
- Azure App Service para rodar; banco e linguagem livres, **com justificativa no README**.

**Desafio 13 (o nosso)**: coletar avaliações anônimas de serviços (secretaria, biblioteca, cantina, laboratórios) e mostrar médias confiáveis.

| Código | O que pede |
|---|---|
| RF1 | Os serviços vêm de um script de dados iniciais |
| RF2 | Registrar avaliação anônima: serviço, nota inteira de 1 a 5, comentário opcional de até 280 caracteres |
| RF3 | Painel por serviço: média (1 casa decimal), quantidade e distribuição das notas (regra central) |
| RF4 | Menos de 3 avaliações: mostra "amostra insuficiente" no lugar da média (regra central) |
| RF5 | Moderação: o gestor oculta um comentário; a nota continua contando na média |
| CA1 | Nota 0, 6 ou 3,5 devolve 400 |
| CA2 | Comentário com 281 caracteres devolve 400 |
| CA3 | Notas 5, 4 e 4 no mesmo serviço: média 4,3 e quantidade 3 |
| CA4 | Serviço com 2 avaliações: "amostra insuficiente" |
| CA5 | Comentário oculto some da lista pública e a média não muda |

**Decisões que o grupo precisa saber justificar** (a ficha cobra): média com `AVG` no banco ou na aplicação; relacional ou Table Storage;
anonimato contra prevenção de abuso (como impedir 100 notas 1).

**Evidências obrigatórias (E1 a E6)**: E1 URL pública; E2 prova de persistência (4 prints do registro `G01-PALAVRA`); E3 casos de teste (mínimo
5, sendo 2 negativos); E4 diagrama de arquitetura no README; E5 variáveis de ambiente com valor oculto e `.gitignore` com `.env`; E6 README completo
e link do vídeo do pitch. Específico do desafio: print do painel com "amostra insuficiente" e o teste do CA3 com o cálculo à mão.

**O que o README precisa ter**: problema e usuário, requisitos com status, diagrama e uma decisão justificada (o que se ganha e o que se perde),
modelo de dados com restrições, como executar, tabela de testes, **dificuldade superada** (problema, diagnóstico, causa, solução) e limitações.

**Como será avaliado**: atendimento ao problema (regra central com um caso recusado), persistência e integridade, integração com a nuvem (nível
alcançado, `/health`, caminho da requisição até o banco), testes e evidências, segurança (nenhum segredo no repo, usuário do banco sem privilégio de
administrador, erros sem detalhe interno) e apresentação (clareza, trade-off, dificuldade e limitações com honestidade). Extras só contam depois do núcleo.

## 2. O que foi feito e onde está cada coisa

| Pedido | Situação | Onde ver |
|---|---|---|
| Nível A (nuvem completa) | Feito: App Service + PostgreSQL 16 na Azure | https://app-cloud-g01-en.azurewebsites.net e `/health` |
| RF1 a RF5 e CA1 a CA5 | Feitos e testados | [README](../README.md) seção 3 e 7; [regras-de-negocio.md](regras-de-negocio.md) |
| `/health` com teste do banco | Feito | `src/app.js` |
| Validação, 400/404/413/429/503 sem detalhe interno | Feito | `src/validacao.js`, [contrato-api.md](contrato-api.md) |
| Banco com restrições (CHECK, FK, NOT NULL, UNIQUE) | Feito | `banco/schema.sql` |
| Usuário do banco sem privilégio de administrador | Feito: só lê, insere e oculta | `banco/permissoes.sql` |
| `DATABASE_URL` fora do código, `.env` no `.gitignore` | Feito | `.env.example`, `.gitignore`; print E5 |
| Consultas parametrizadas | Feito (há teste de injeção) | `src/db.js`, `tests/seguranca.test.js` |
| 20 avaliações por script para demonstração | Feito, opcional | `banco/dados-demonstracao.sql` |
| Requisições prontas | Feito | `requests.http` |
| Testes (mín. 5, com 2 negativos) | **109 testes + 27 de navegador** | `tests/`, `npm test`, print E3 |
| README no formato da ficha, com dificuldade superada | Feito | [README](../README.md) |
| CI/CD (extra) | Feito: testes, CodeQL, Gitleaks, ZAP, deploy automático | `.github/workflows/`, [ci-cd.md](ci-cd.md) |
| Evidências E1, E3, E5, painel "amostra insuficiente" | **Prontas** (prints com data e hora) | `evidencias/qa/` |
| E2 prova de persistência | **Ensaio feito** com `G01-ENSAIO`; a oficial é hoje | `evidencias/ensaio-persistencia/` |
| E6 vídeo do pitch | **Falta gravar** (roteiro na seção 7) | grupo |

Mapa das pastas: `src/` é a API; `banco/` são os scripts SQL; `js/`, `css/` e os `.html` são o front; `tests/` são os testes; `docs/` é a documentação;
`evidencias/` são os prints; `.github/workflows/` é o CI/CD.

## 3. Como funciona (o que você precisa saber explicar)

**Caminho de uma requisição** (a pergunta mais provável): o estudante abre a página no navegador, que fala por HTTPS com o **Azure App Service**
(um servidor Node.js com Express que entrega as telas e a API no mesmo endereço). Ao enviar uma avaliação, o front faz `POST /api/avaliacoes`.
O servidor **valida** (serviço existe, nota inteira de 1 a 5, comentário até 280) e, se estiver certo, faz um `INSERT` **parametrizado** no
**PostgreSQL gerenciado** (a string de conexão vem da variável `DATABASE_URL`). Se estiver errado, devolve 400 sem gravar nada. O dashboard chama
`GET /api/indicadores`, e **o banco calcula** quantidade, distribuição e média (`ROUND(AVG(nota)::numeric, 1)`); com menos de 3 avaliações a
API devolve `media: null` e a tela mostra "amostra insuficiente".

**Regra central**: média confiável. Média de 1 ou 2 votos engana, então só aparece com 3 ou mais. Conta de cabeça: notas 5, 4 e 4 somam 13,
13 ÷ 3 = 4,33, que arredonda para **4,3**.

**Moderação**: o gestor entra com usuário e senha (a senha é guardada como hash `scrypt`; a sessão é um cookie assinado, `HttpOnly`, `SameSite=Strict`
e `Secure`). Ocultar um comentário só muda a coluna `oculta`; a nota **nunca é apagada**, por isso a média não muda. O usuário do banco que a aplicação
usa nem tem permissão de alterar nota ou apagar linha.

**Por que PostgreSQL e não Table Storage (a decisão justificada)**: ganha-se restrições no próprio banco (`CHECK` de nota, chave estrangeira,
`VARCHAR(280)`) e a média num `AVG` só, fácil de conferir à mão. Perde-se em custo (o servidor cobra por hora e precisa ser parado ao fim da aula;
o Table Storage custa quase nada) e em simplicidade (há firewall, TLS e string de conexão para configurar).

**Anonimato contra abuso**: não existe nome, e-mail nem matrícula em tabela nenhuma. Para evitar 100 notas 1, há limite de requisições por IP, guardado só
**em memória** por 1 minuto (não grava IP em disco, banco nem log). É um controle simples: limitação registrada no README.

**Segurança em uma frase**: segredos só em variáveis de ambiente, SQL parametrizado, validação no servidor, CSP restrita, sem `innerHTML` no front (contra XSS),
senha com hash, usuário do banco com privilégio mínimo e erros sem detalhe interno.

**Por que HTML/CSS/JS puros no front**: são poucas telas, sem regra de negócio no cliente. Menos dependências e menos superfície de ataque, e uma só aplicação para publicar.

## 4. Como o trabalho foi feito (o processo)

1. **Leitura da ficha** e escolha do **Nível A**; a infraestrutura foi criada com o Azure CLI (grupo `rg-cloud-g01`, plano F1 Linux, App Service Node 22, PostgreSQL Flexible Server 16 B1ms).
2. **Modelagem e banco primeiro**: `schema.sql` com as restrições, `permissoes.sql` com o usuário de privilégio mínimo. A regra central ficou numa consulta SQL.
3. **API** com as regras, validação e erros; depois o **front integrado à API** (o antigo modo "demonstração" com `localStorage` foi removido, para não haver dado de mentira).
4. **Testes junto com o código**: cada regra e cada caso de aceite virou teste automático, rodando contra um PostgreSQL de verdade. Um teste de segurança achou um erro real (cookie malformado derrubava a rota com 500) e foi corrigido.
5. **Fluxo de equipe**: para cada item, uma **issue**, uma **branch**, um **pull request** com `Closes #N`, **CI verde** e só então o merge; as branches mescladas foram apagadas. É o que a seção 10 do README lista.
6. **CI/CD**: a cada push o GitHub Actions roda lint, testes com cobertura, testes contra PostgreSQL 16, auditoria de dependências, CodeQL e Gitleaks; o deploy publica sozinho na Azure e confere o `/health`.
7. **Identidade visual** a partir do protótipo do Stitch, com contraste de cores medido e corrigido (acessibilidade AA), tema claro e escuro.
8. **Documentação e evidências** geradas da execução real (com data e hora).

Dado fictício **não é mock**: mock é código falso no lugar do real; aqui os testes usam PostgreSQL de verdade e os dados de demonstração são linhas fictícias gravadas no banco real.

## 5. Dificuldade superada (história real, para contar)

Em produção o login do gestor dava **401** mesmo com a senha certa, mas localmente funcionava. Diagnóstico: a senha estava certa; o que chegou ao Azure é que estava errado.
Causa: o hash tem o formato `scrypt$sal$hash` e o shell tratou os `$` como variáveis, **corrompendo o hash** ao configurar o app (e um reinício assíncrono ainda atrasou a conferência).
Solução: ler o arquivo com um script em Node (sem expansão do shell), **validar o formato do hash antes de enviar** e esperar o `iniciado_em` do `/health` mudar antes de testar de novo.
Texto completo na seção 11 do [README](../README.md).

## 6. A noite de hoje: o que acontece e quem faz

Horários da ficha (código congela às 21h20):

| Horário | O que | Quem |
|---|---|---|
| até 19h05 | Ponto 1: explicar o problema em 1 minuto e mostrar diagrama, modelo de dados com uma restrição, rotas e quem faz o quê | todos; diagrama e modelo estão no README (seções 4 e 5) |
| **19h55** | Professor anuncia a **palavra do dia**. Cadastrar `G01-PALAVRA` pela aplicação, listar pela aplicação (print 1), anotar `iniciado_em` (print 2) | NUVEM/DADOS: rodar o script de prova (abaixo) |
| até 20h05 | Conferir a mesma linha direto no banco (print 4). Um grupo da ilha confere e anota no painel | DADOS |
| **20h35** | Reiniciar a aplicação e conferir que o registro continua (print 3) | NUVEM |
| 20h40 a 21h10 | O professor abre a URL e cadastra **`PROF-HHMM`**; mostrar na apresentação | todos |
| até 21h20 | Código congelado; demonstrar a regra central, E3, README e evidências | QA |
| 21h30 | Feira nas ilhas e palco: **pitch de 90 s** | todos |
| 21h52 | Parar o que cobra por hora (**PostgreSQL**) | NUVEM |

**Prova de persistência (E2), pelo script** (quem tem a Azure logada, a partir da pasta do projeto): o script cadastra `G01-<PALAVRA>`, lista, anota o
`iniciado_em`, reinicia, confere e gera os 4 prints com data e hora. Há também roteiro manual em [evidencias/README.md](../evidencias/README.md).
Se o professor quiser o reinício só às 20h35, o registro e os prints 1 e 2 saem às 19h55 e os prints 3 e 4 depois do reinício.

**Se a infraestrutura travar por 15 minutos**: descer um nível (A para B) e registrar o motivo no painel da turma; **o app já está no Nível A funcionando**, então o risco é baixo.

## 7. Pitch de 90 segundos (no formato que a ficha pede)

| Tempo | O que mostrar | Sugestão do que dizer |
|---|---|---|
| 0 a 15 s | Quem é o usuário, o problema e o que o produto faz | "A unidade só tinha uma caixa de sugestões de papel que ninguém tabulava. O estudante avalia secretaria, biblioteca, cantina e laboratórios sem login, com nota de 1 a 5, e o gestor vê médias confiáveis." |
| 15 a 50 s | **Demo ao vivo** do fluxo principal e da regra central, **incluindo um caso recusado** | Enviar uma avaliação pela tela. Abrir o dashboard: "este serviço tem menos de 3 avaliações, então mostra *amostra insuficiente*, não uma média enganosa". Caso recusado: enviar nota 6 (ou comentário de 281 caracteres) e mostrar o **400**. Mostrar notas 5, 4 e 4 resultando em **4,3**. Ocultar um comentário e mostrar que a média não muda. |
| 50 a 65 s | O registro `G01-PALAVRA` (e o `PROF-HHMM`) e onde esse dado mora | "Aqui está o registro da palavra do dia, o do professor e a linha no PostgreSQL da Azure. Reiniciamos o app e o dado continuou lá, porque mora no banco, não no servidor." |
| 65 a 80 s | Serviços usados e **uma decisão com trade-off** | "App Service para rodar e PostgreSQL gerenciado para guardar. Escolhemos relacional porque o banco impõe as regras e calcula a média; o custo é que o servidor cobra por hora, então paramos no fim da aula." |
| 80 a 90 s | A dificuldade superada e o que ainda falta | "O login dava 401 só em produção: o shell corrompia o `$` do hash da senha. Resolvemos lendo o arquivo sem o shell e validando o formato. Falta: sessão do gestor sem revogação no servidor e limite de abuso só em memória." |

Preparação: abra em abas a URL, o dashboard, o `/health` e o repositório (aba Actions); tenha a palavra do dia à mão; teste a gravação antes. O link do vídeo vai em `E6-pitch.txt` na pasta `evidencias/`.

## 8. Perguntas que podem cair (com a resposta curta)

- **Qual o caminho de uma requisição até o banco?** Seção 3.
- **Por que PostgreSQL?** Restrições no banco e `AVG` exato; custa mais (cobra por hora). Seção 3.
- **A média é calculada onde?** No banco, com `ROUND(AVG(nota)::numeric, 1)`.
- **Como evita injeção de SQL?** Consultas parametrizadas (`$1`, `$2`); há teste de injeção.
- **Onde ficam as senhas e a string de conexão?** Em variáveis de ambiente do App Service; o `.env` está no `.gitignore` (print E5). Nada no repositório (o Gitleaks confere).
- **O que acontece se alguém mandar 100 notas 1?** Há limite por IP em memória; é um controle simples e está nas limitações (anonimato × abuso).
- **O que é o `/health`?** Rota que testa a conexão com o banco; se der 503, o problema é entre a aplicação e o banco.
- **Como provam que persiste?** Registro `G01-PALAVRA` sobrevive ao reinício (`iniciado_em` muda) e aparece em consulta direta ao banco.
- **O gestor consegue apagar uma nota?** Não: só oculta o comentário, e o usuário do banco nem tem permissão de alterar nota.
- **Por que datas podem aparecer 3 horas diferentes?** O App Service usa UTC; gravamos `TIMESTAMPTZ` e convertemos na exibição.
- **O que faltou ou é limitação?** Um único gestor definido por variável, sem revogação de sessão no servidor, limite de abuso por instância, testes só no Chromium. Seção 12 do README.
- **O que custa e o que foi parado?** O PostgreSQL B1ms cobra por hora; ao fim da aula é parado e o grupo de recursos é excluído na data do professor.

## 9. O que ainda falta e quem faz

| Item | Quando | Quem |
|---|---|---|
| Prova de persistência com a palavra do dia (4 prints) e teste `PROF-HHMM` | hoje, a partir de 19h55 | NUVEM e DADOS |
| Gravar o pitch de 90 s e colocar o link em `evidencias/E6-pitch.txt` | até 21h30 | QA, com todos |
| Parar o servidor PostgreSQL | 21h52 | NUVEM |
| Excluir o grupo `rg-cloud-g01` | na data do professor | NUVEM |
| Cada integrante conferir que tem commit e sabe explicar o fluxo | hoje | todos |

Se algo não ficar pronto, **registre como limitação honesta**: a ficha valoriza isso mais do que esconder.

## 10. Para ir mais fundo

[README](../README.md) · [contrato da API](contrato-api.md) · [regras de negócio, cada uma com o teste que a prova](regras-de-negocio.md) ·
[segurança e modelo de ameaças](seguranca.md) · [relatório das varreduras](relatorio-seguranca.md) · [CI/CD](ci-cd.md) ·
[implantação na Azure, comando a comando](implantacao-azure.md) · [evidências](../evidencias/README.md)
