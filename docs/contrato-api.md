# Contrato de API — Avalie o Atendimento

**Projeto:** Cloud Challenge — Grupo 1  
**Versão:** 1.0 — Proposta para validação da equipe  
**Status:** Planejamento de integração

## 1. Objetivo

Definir o contrato de comunicação entre o frontend web, o backend e o banco de dados PostgreSQL da aplicação Avalie o Atendimento.

O sistema permitirá avaliações anônimas dos serviços institucionais e a visualização de indicadores agregados.

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
| Serviço inexistente | HTTP 404 |
| Banco indisponível | HTTP 503 |

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

Retorna apenas comentários públicos não ocultos.

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

O formato definitivo das credenciais será definido pela equipe de backend.

A autenticação deverá utilizar uma sessão segura e proteger todas as rotas administrativas.

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

- HTTP 200: alteração concluída.
- HTTP 401: gestor não autenticado.
- HTTP 403: acesso não autorizado.
- HTTP 404: avaliação inexistente.

## 5. Monitoramento

### GET `/health`

Deverá verificar o funcionamento da aplicação e a conexão real com o PostgreSQL.

Exemplo de resposta HTTP 200:

```json
{
  "status": "ok",
  "database": "connected"
}
```

Se o banco estiver indisponível, a API deverá retornar HTTP 503.

## 6. Segurança e anonimato

O sistema não deverá associar avaliações a nome, matrícula ou e-mail.

Não deverão ser utilizados identificadores persistentes para rastrear estudantes.

O backend deverá utilizar:

- Consultas SQL parametrizadas.
- Validação de dados no servidor.
- Credenciais em variáveis de ambiente.
- Senhas administrativas armazenadas com hash seguro.
- HTTPS na implantação.
- Autorização para rotas administrativas.
- Proteção contra abuso sem comprometer o anonimato.

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

**Observação:** este documento representa o contrato proposto. A equipe deverá validar os endpoints e os formatos JSON antes de iniciar a integração definitiva.