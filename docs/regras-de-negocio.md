# Regras de negócio — Avalie o Atendimento

**Projeto:** Cloud Challenge — Grupo 1 | SENAC 2026.2  
**Desafio:** 13 — Avalie o Atendimento  
**Status:** regras definidas; validação integral com backend e PostgreSQL pendente.

Este documento detalha os requisitos já previstos no README acadêmico e as decisões de interface tomadas durante o desenvolvimento do frontend. Regras adicionais de segurança e contrato de API são **propostas de implementação** até confirmação pelo backend.

## 1. Atores

- **Estudante:** registra avaliação sem login ou cadastro e consulta indicadores e comentários públicos.
- **Gestor:** consulta avaliações para moderação e oculta/reexibe comentários, mediante autenticação no backend de produção.

## 2. Serviços

| ID usado no frontend demonstrativo | Serviço |
|---|---|
| 1 | Secretaria |
| 2 | Biblioteca |
| 3 | Cantina |
| 4 | Laboratórios |

**RN01 — Catálogo de serviços:** somente serviços cadastrados podem receber avaliações. Os quatro serviços iniciais devem ser inseridos no banco por script SQL. IDs reais devem ser confirmados pela API, não presumidos como fixos.

## 3. Registro de avaliações

**RN02 — Participação sem cadastro:** o estudante não precisa de login nem fornecer nome, e-mail ou matrícula para avaliar. O sistema não deve solicitar esses dados no formulário público.

**RN03 — Nota obrigatória:** cada avaliação deve possuir uma nota inteira de **1 a 5**. Valores como 0, 6, 3,5, texto ou ausência de nota devem ser rejeitados. A API deve responder HTTP 400 para as entradas inválidas previstas em CA01.

**RN04 — Comentário opcional:** o comentário pode ficar vazio e, quando preenchido, deve ter **no máximo 280 caracteres**. Um texto com 281 caracteres deve ser rejeitado pela API com HTTP 400, conforme CA02. A contagem deve ser validada também no servidor.

**RN05 — Serviço válido:** toda avaliação deve referenciar um serviço existente. O backend deve validar `servico_id` e a integridade referencial no banco. O código HTTP para serviço inexistente deve ser acordado no contrato da API.

**RN06 — Persistência:** na versão final, avaliações devem ser gravadas em PostgreSQL e permanecer disponíveis após reinício da aplicação. O armazenamento no `localStorage` é exclusivo do modo demonstração e não comprova esse requisito.

## 4. Indicadores e dashboard

**RN07 — Quantidade por serviço:** contar todas as avaliações válidas registradas para cada serviço, inclusive aquelas com comentários ocultados.

**RN08 — Distribuição de notas:** apresentar a quantidade de avaliações para cada nota de 1, 2, 3, 4 e 5 por serviço.

**RN09 — Média por serviço:** calcular a média aritmética das notas do serviço e exibi-la com **uma casa decimal**, somente quando houver pelo menos três avaliações.

Fórmula:

```text
media = soma_das_notas / quantidade_de_avaliacoes
```

Exemplo CA03:

```text
notas = [5, 4, 4]
quantidade = 3
media = 13 / 3 = 4,333...
media_exibida = 4,3
```

**RN10 — Amostra insuficiente:** quando a quantidade de avaliações de um serviço for **menor que 3**, apresentar **“Amostra insuficiente”** e não exibir a média. A quantidade e a distribuição podem continuar visíveis.

## 5. Comentários e moderação

**RN11 — Comentários públicos:** comentários não ocultos podem aparecer na interface pública. Avaliações sem comentário continuam contando nos indicadores, mas não precisam ocupar espaço na lista de comentários.

**RN12 — Moderação sem alterar a nota:** um gestor autorizado pode ocultar ou reexibir um comentário impróprio. Ocultar o comentário impede sua exibição pública, **mas não apaga a avaliação nem modifica nota, quantidade, distribuição ou média**. A coluna planejada `oculta` controla esse estado.

**Regra de acesso proposta:** em produção, somente gestores autenticados e autorizados podem consultar dados de moderação ou alterar `oculta`. A interface demonstrativa `admin.html` não implementa autenticação real.

## 6. Requisitos funcionais de referência

| Requisito | Regras relacionadas |
|---|---|
| RF01 — Carregar serviços por script SQL | RN01 |
| RF02 — Registrar avaliação anônima com nota de 1 a 5 | RN02–RN06 |
| RF03 — Exibir média, quantidade e distribuição | RN07–RN09 |
| RF04 — Exibir amostra insuficiente | RN10 |
| RF05 — Ocultar comentário sem alterar média | RN11–RN12 |

## 7. Casos de aceite obrigatórios

| Caso | Preparação / entrada | Resultado esperado |
|---|---|---|
| CA01 | Enviar notas 0, 6 e 3,5 diretamente à API | HTTP 400 para cada valor |
| CA02 | Enviar comentário com 281 caracteres diretamente à API | HTTP 400 |
| CA03 | Registrar notas 5, 4 e 4 para um serviço isolado | Quantidade 3 e média exibida 4,3 |
| CA04 | Registrar apenas duas avaliações para um serviço isolado | Exibir “Amostra insuficiente”; não exibir média |
| CA05 | Ocultar comentário de avaliação existente | Comentário some da consulta pública; nota segue nos indicadores |

Para CA03 e CA04, usar dados isolados de teste, evitando que registros anteriores alterem os resultados. Para CA05, conferir indicadores antes e depois da ocultação e testar também a reexibição.

## 8. Modelo de dados planejado

### `servicos`

- `id` — chave primária.
- `nome` — nome do serviço.

### `avaliacoes`

- `id` — chave primária.
- `servico_id` — chave estrangeira para `servicos`.
- `nota` — inteiro de 1 a 5.
- `comentario` — texto opcional de até 280 caracteres.
- `oculta` — booleano, padrão falso.
- `criada_em` — data e hora de criação.

Restrições devem ser aplicadas no banco e verificadas também na API. O schema definitivo pertence à equipe de dados.

## 9. Integração planejada

Payload de avaliação proposto:

```json
{
  "servico_id": 1,
  "nota": 5,
  "comentario": "Bom atendimento."
}
```

Endpoints propostos:

| Método | Caminho | Uso |
|---|---|---|
| GET | `/api/servicos` | Catálogo |
| POST | `/api/avaliacoes` | Cadastro |
| GET | `/api/indicadores` | Indicadores |
| GET | `/api/comentarios` | Comentários públicos |
| POST | `/api/admin/login` | Autenticação do gestor |
| GET | `/api/admin/me` | Sessão/permissão |
| GET | `/api/admin/avaliacoes` | Moderação protegida |
| PATCH | `/api/admin/avaliacoes/{id}` | Alterar visibilidade |
| POST | `/api/admin/logout` | Encerrar sessão |
| GET | `/health` | Saúde da aplicação e banco |

**Atenção:** esses caminhos são uma proposta de contrato, não comprovação de endpoints já implementados. O backend deve confirmar formatos de resposta, autenticação, CSRF, erros HTTP e política de CORS quando aplicável.

## 10. Modo demonstração versus produção

| Aspecto | Demonstração | Produção prevista |
|---|---|---|
| Armazenamento | `localStorage` do navegador | PostgreSQL |
| Compartilhamento de dados | Mesmo navegador e origem | Centralizado via API |
| Moderação | Simulação local | Backend com autorização |
| Login de gestor | Tela demonstrativa | Sessão autenticada |
| Validação | Interface e lógica local | API e restrições do banco |
| Persistência após reinício do servidor | Não comprova | Obrigatória |

**Não considerar o frontend demonstrativo como comprovação de segurança, autenticação ou persistência em nuvem.**

## 11. Privacidade e segurança — decisões a validar

- Não solicitar identificação do estudante.
- Orientar a não inserir dados pessoais nos comentários.
- Evitar divulgação de credenciais e dados sensíveis no repositório.
- Validar entradas no backend, inclusive quando o frontend já valida.
- Proteger endpoints administrativos por sessão e autorização.
- Definir políticas de logs, retenção e tratamento de dados técnicos antes do deploy.
- Utilizar HTTPS e medidas adequadas de segurança de sessão.

## 12. Evidências para a entrega

Para cada caso CA01–CA05, registrar: identificador, pré-condições, dados de entrada, endpoint/tela, resultado esperado, resultado obtido, status PASS/FAIL e evidência (captura, resposta HTTP ou log). Incluir também prova de persistência após reinício, resposta do `/health` e evidência de implantação conforme o nível Azure alcançado.
