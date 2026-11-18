# Contrato de API — Avalie o Atendimento

**Projeto:** Cloud Challenge — Grupo 1  
**Versão:** 1.2 — Implementado, coberto por testes automatizados e publicado  
**Status:** API implementada (`src/app.js`) e testada (`tests/api.test.js`, `tests/seguranca.test.js`, `tests/log.test.js`). Painel integrado; publicada em https://app-cloud-g01-en.azurewebsites.net.

## 1. Objetivo

Definir o contrato de comunicação entre o frontend web, o backend e o banco de dados PostgreSQL da aplicação Avalie o Atendimento.

O sistema permite avaliações anônimas dos serviços institucionais e a visualização de indicadores agregados.

## 2. Regras obrigatórias

- As avaliações não exigem login ou identificação do estudante.
- Os serviços são cadastrados inicialmente por script SQL.
- A nota deve ser um número inteiro entre 1 e 5.
- O comentário é opcional, com limite de 280 caracteres.
- A média deve apresentar uma casa decimal.
- Serviços com menos de três avaliações devem retornar `media: null` e exibir "Amostra insuficiente".
- Comentários ocultados não aparecem publicamente.
- As notas de comentários ocultados continuam sendo consideradas nos indicadores.
- A moderação é exclusiva de gestores autenticados.
- Os dados devem persistir no PostgreSQL.

## 3. Endpoints públicos

> **Formato dos erros:** toda resposta de erro da API vem em JSON com o campo `message` (e `erros`, na validação). Nenhum erro expõe detalhe interno (host, SQL, mensagem do driver). Rota inexistente em `/api` responde HTTP 404 em JSON.
>
> **Cabeçalhos:** as respostas da API e do `/health` trazem `Cache-Control: no-store`; todas as respostas trazem `X-Content-Type-Options: nosniff` e `Referrer-Policy: no-referrer`, e nenhuma traz `X-Powered-By`.
>
> **Tamanho:** corpo acima de 10 KB responde HTTP 413 e JSON malformado responde HTTP 400.

### GET `/api/servicos`

Retorna os serviços disponíveis para avaliação.

Resposta HTTP 200:

```json
[
  {"id": 1, "nome": "Secretaria"},
  {"id": 2, "nome": "Biblioteca"},
  {"id": 3, "nome": "Cantina"},
  {"id": 4, "nome": "Laboratórios"}
]
```

### POST `/api/avaliacoes`

Registra uma avaliação anônima.

Corpo da requisição:

```json
{
  "servico_id": 1,
  "nota": 5,
  "comentario": "Atendimento rápido e organizado."
}
```

Resposta HTTP 201:

```json
{
  "id": 125,
  "mensagem": "Avaliação registrada com sucesso."
}
```

O frontend não enviará nome, matrícula, e-mail ou identificador pessoal.

Validações obrigatórias:

| Entrada | Resultado |
|---|---|
| Nota 1, 2, 3, 4 ou 5 | Aceitar |
| Nota 0 | HTTP 400 |
| Nota 6 | HTTP 400 |
| Nota 3.5 | HTTP 400 |
| Comentário de 280 caracteres | Aceitar |
| Comentário de 281 caracteres | HTTP 400 |
| `servico_id` ou `nota` que não sejam números inteiros (texto, lista, objeto, decimal) | HTTP 400 |
| Serviço inexistente | HTTP 404 |
| Banco indisponível | HTTP 503 |
| Muitas avaliações do mesmo IP em 1 minuto (limite de 30, só em memória, sem gravar o IP) | HTTP 429 |

### GET `/api/indicadores`

Retorna os indicadores agregados de todos os serviços.

Resposta HTTP 200:

```json
[
  {
    "servico_id": 1,
    "nome": "Secretaria",
    "quantidade": 3,
    "media": 4.3,
    "amostra_suficiente": true,
    "distribuicao": {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 2,
      "5": 1
    }
  }
]
```

Para serviços com menos de três avaliações:

```json
{
  "servico_id": 2,
  "nome": "Biblioteca",
  "quantidade": 2,
  "media": null,
  "amostra_suficiente": false,
  "distribuicao": {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 1,
    "5": 1
  }
}
```

### GET `/api/comentarios`

Retorna apenas comentários públicos (não ocultos e não vazios), do mais novo ao mais antigo, até 100.

Resposta HTTP 200:

```json
[
  {
    "id": 125,
    "servico": "Secretaria",
    "nota": 5,
    "comentario": "Atendimento rápido e organizado.",
    "criada_em": "2026-10-29T14:00:00Z"
  }
]
```

## 4. Endpoints administrativos

### POST `/api/admin/login`

Autentica um gestor.

Requisição (implementada):

```json
{"usuario": "gestor", "senha": "..."}
```

- HTTP 200: `{"usuario": "gestor"}` e o cookie `sessao` (`HttpOnly`, `SameSite=Strict`, 8 horas, `Secure` quando a conexão é HTTPS).
- HTTP 401: usuário ou senha incorretos (mesma mensagem nos dois casos).
- HTTP 429: mais de 10 tentativas do mesmo IP em 15 minutos.
- HTTP 503: variáveis `ADMIN_USUARIO`, `ADMIN_SENHA_HASH` e `SESSAO_SEGREDO` não configuradas (nunca libera o acesso).

A senha é conferida com hash `scrypt`; a sessão é assinada com HMAC-SHA256. Todas as rotas administrativas exigem o cookie; sem ele respondem HTTP 401. Requisições de escrita com cabeçalho `Origin` de outro site recebem HTTP 403.

### GET `/api/admin/me`

HTTP 200 com `{"usuario": "gestor"}` ou HTTP 401.

### GET `/api/admin/avaliacoes`

Lista até 500 avaliações, **inclusive as ocultas**, com `id`, `servico`, `nota`, `comentario`, `oculta` e `criada_em`. HTTP 401 sem sessão.

### POST `/api/admin/logout`

Encerra a sessão (apaga o cookie no navegador). HTTP 200. Requisição com `Origin` de outro site recebe HTTP 403. O cookie é apagado só no navegador: o servidor não guarda sessões e não as revoga (trocar `SESSAO_SEGREDO` invalida todas).

### PATCH `/api/admin/avaliacoes/{id}`

Altera a visibilidade de um comentário.

Requisição:

```json
{
  "oculta": true
}
```

A nota da avaliação não deve ser excluída ou alterada durante a moderação.

Respostas previstas:

- HTTP 200: alteração concluída, com `{"id": 12, "oculta": true}`.
- HTTP 401: gestor não autenticado.
- HTTP 400: `oculta` não é booleano ou o identificador não é numérico.
- HTTP 403: requisição de outra origem (cabeçalho `Origin` diferente do site).
- HTTP 404: avaliação inexistente (inclusive identificador menor que 1 ou fora do intervalo do banco).
- HTTP 503: banco indisponível.

Só a coluna `oculta` é alterada; não existe rota para editar ou apagar nota ou comentário (`DELETE`, `PUT` e `PATCH` em `/api/avaliacoes` respondem 404).

## 5. Monitoramento

### GET `/health`

Verifica o funcionamento da aplicação e a conexão real com o PostgreSQL (executa uma consulta no banco). Não aparece no log de requisições.

Exemplo de resposta HTTP 200:

```json
{
  "status": "ok",
  "database": "connected",
  "iniciado_em": "2026-11-18T21:00:00.000Z"
}
```

`iniciado_em` muda a cada início da aplicação e serve de prova de reinício na demonstração de persistência.

Se o banco estiver indisponível, a API retorna HTTP 503 com `{"status": "erro", "database": "unavailable", "iniciado_em": "..."}`.

## 6. Segurança e anonimato

O sistema não associa avaliações a nome, matrícula ou e-mail, e não usa identificadores persistentes para rastrear estudantes. O log da aplicação não registra IP, corpo, cookie, query string nem comentário.

O backend utiliza:

- Consultas SQL parametrizadas.
- Validação de dados no servidor.
- Credenciais em variáveis de ambiente.
- Senhas administrativas armazenadas com hash seguro.
- HTTPS na implantação.
- Autorização para rotas administrativas.
- Proteção contra abuso sem comprometer o anonimato (limites em memória, sem gravar o IP).

Modelo de ameaças, controles e riscos que continuam abertos: [seguranca.md](seguranca.md). Regras e o teste de cada uma: [regras-de-negocio.md](regras-de-negocio.md).

## 7. Responsabilidades

| Integrante | Entrega |
|---|---|
| Antônio Enzo | Modelagem relacional e restrições |
| Emmanuel Luis | Consultas SQL e indicadores |
| Everson José | Infraestrutura e configuração Azure |
| Gabriel Eduardo | Testes e evidências |
| José Allamberg | Backend, endpoints e autenticação |
| Marcelo Barbosa | Integração frontend, dashboard e PWA |

## 8. Critérios de aceite

- Cadastro de avaliação retorna HTTP 201.
- Entradas inválidas retornam HTTP 400.
- Média de 5, 4 e 4 retorna 4.3.
- Duas avaliações retornam média nula.
- Comentário ocultado não aparece publicamente.
- A nota de comentário ocultado permanece nos cálculos.
- A aplicação mantém os dados após reinício.
- A rota `/health` confirma conexão com o banco.

---

**Observação:** este documento descreve o que `src/app.js` implementa hoje. Os formatos e códigos acima são conferidos pelos testes automatizados; se o código mudar, este arquivo deve mudar junto.