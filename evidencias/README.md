# Evidências da entrega

Pasta exigida pela ficha da atividade. Todo print deve mostrar **data e hora visíveis**
(relógio do sistema ou do navegador). Nunca use nome, e-mail ou matrícula reais nas evidências.

`GXX-PALAVRA` na ficha vira **`G01-PALAVRA`** (Grupo 1). A palavra do dia é anunciada pelo professor
durante a aula; nos nomes de arquivo e nos comandos abaixo, troque `PALAVRA` por ela.

## Lista de evidências (E1 a E6)

| Código | Evidência | Arquivo sugerido | Situação |
|---|---|---|---|
| E1 | Registro do ambiente: URL pública (Nível A) ou descrição do ambiente (Níveis B e C) | `E1-ambiente.png` | **Pronto**: `qa/E1-url-publica-e-health.png` |
| E2 | Prova de persistência: os quatro prints do registro `G01-PALAVRA` | `E2-print1-lista.png`, `E2-print2-iniciado-em-antes.png`, `E2-print3-depois-do-reinicio.png`, `E2-print4-consulta-sql.png` | Ensaio pronto (`ensaio-persistencia/`); **oficial pendente da palavra do dia** |
| E3 | Casos de teste: pelo menos 5, sendo 2 negativos, com esperado e obtido | `qa/E3-saida-dos-testes.png` e a tabela do README | **Pronto**: 109 testes e 27 e2e (`qa/`) |
| E4 | Diagrama de arquitetura | no README (mermaid) | Pronto |
| E5 | Configuração segura: print das variáveis de ambiente com o valor oculto e o `.gitignore` com `.env` | `E5-variaveis-ocultas.png`, `E5-gitignore.png` | **Pronto**: `qa/E5-variaveis-e-gitignore.png` |
| E6 | README completo e link do vídeo do pitch de 90 segundos | README + `E6-pitch.txt` com o link | README pronto; **vídeo pendente** |

Se o ambiente for o Nível C (local), o E1 é a descrição do ambiente (versões, comandos) com prints do
terminal e do navegador.

## Prova de persistência (E2), em 6 passos

1. Pela aplicação, cadastre o registro `G01-PALAVRA` (o script faz isso por `POST /api/avaliacoes`,
   com a palavra no comentário).
2. Liste os registros pela aplicação (`GET /api/comentarios`). **Print 1.**
3. Anote o campo `iniciado_em` da rota `/health`. **Print 2.**
4. Reinicie a aplicação. Nível A: botão **Reiniciar** no portal ou `az webapp restart`.
   Níveis B e C: pare e inicie o processo.
5. Confira que `iniciado_em` mudou e que o registro continua listado. **Print 3.**
6. Mostre a mesma linha numa consulta direta ao banco (Editor de consultas, Cloud Shell com `psql` ou
   cliente SQL). **Print 4.**

Consulta do passo 6:

```sql
SELECT id, servico_id, nota, comentario, oculta, criada_em
  FROM avaliacoes
 WHERE comentario = 'G01-PALAVRA';
```

### Scripts

Os scripts executam os passos 1, 2, 3 e 5 e imprimem cada resposta com data e hora, para facilitar os
prints. O reinício (passo 4) e a consulta SQL (passo 6) são manuais.

```bash
# Linux, macOS ou Git Bash
./evidencias/prova-persistencia.sh http://localhost:3000 G01-PALAVRA
```

```powershell
# Windows PowerShell
.\evidencias\prova-persistencia.ps1 -Base http://localhost:3000 -Palavra G01-PALAVRA
```

Na Azure, use a URL pública no lugar de `http://localhost:3000`.

## Outros prints úteis

- `npm test` com os 70 testes passando (E3).
- `/health` respondendo `connected` (E1).
- Dashboard com um serviço em "amostra insuficiente" (CA4), quando a integração do painel estiver pronta.
- Comentário ocultado que some da lista pública sem mudar a média (CA5).

## Evidências já geradas (18/11/2026)

Geradas a partir da execução real (produção, testes e Azure), sem desenho à mão: cada imagem traz o título, a URL ou o
comando e a **data e hora da captura (horário de Recife)** no cabeçalho. Nenhuma contém segredo.

### QA final (`evidencias/qa/`)

| Código | O que prova | Arquivo |
|---|---|---|
| E1 | Ambiente publicado (Nível A): `/health` com o banco conectado e a página inicial | `qa/E1-url-publica-e-health.png` |
| E3 | Saída completa de `npm test` (109 testes, passaram) e o texto original | `qa/E3-saida-dos-testes.png`, `qa/E3-saida-dos-testes.txt` |
| E3 | Resumo: casos de aceite CA1 a CA5, casos negativos (400, 401, 403, 404) e cobertura | `qa/E3-resumo-ca1-ca5-e-cobertura.png` |
| E5 | Variáveis do App Service **com os valores ocultos** (só os nomes), `.gitignore` com `.env` e `git ls-files .env` vazio | `qa/E5-variaveis-e-gitignore.png` |
| Desafio 13 | Painel mostrando **"Amostra insuficiente"** em um serviço com menos de 3 avaliações | `qa/D13-painel-amostra-insuficiente.png` |
| Desafio 13 | CA3 (notas 5, 4 e 4 resultam em média 4,3): teste `CA3` na saída do E3, que roda também no CI contra PostgreSQL 16 real | `qa/E3-resumo-ca1-ca5-e-cobertura.png` |
| Resumo | Valores medidos (indicadores, variáveis, regra de ignore) | `qa/resumo-evidencias-qa.json` |

### Ensaio da prova de persistência (E2), com a palavra `G01-ENSAIO`

É um **ensaio** da prova que o professor pede, feito em produção para validar o roteiro. **Não substitui** a prova com a palavra do dia
anunciada pelo professor, que ainda será feita na aula e substitui estes arquivos.

| Print | O que mostra | Arquivo |
|---|---|---|
| 1 | Registro cadastrado pelo formulário e listado pela aplicação | `ensaio-persistencia/E2-print1-lista-pela-aplicacao-evidencia.png` |
| 2 | `/health` antes do reinício (`iniciado_em`) | `ensaio-persistencia/E2-print2-health-antes-evidencia.png` |
| 3 | Depois do reinício: `iniciado_em` mudou e o registro continua listado | `ensaio-persistencia/E2-print3a-health-depois-evidencia.png`, `E2-print3b-lista-depois-evidencia.png` |
| 4 | A mesma linha vista direto no PostgreSQL da Azure (saída real da consulta, desenhada numa tela) | `ensaio-persistencia/E2-print4-consulta-direta-banco.png` |

Ainda pendentes (dependem de pessoas e do dia): a prova com a palavra do dia, o `PROF-HHMM` do teste do professor e o vídeo do pitch (E6).

