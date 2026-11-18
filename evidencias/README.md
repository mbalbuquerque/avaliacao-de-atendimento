# Evidências da entrega

Pasta exigida pela ficha da atividade. Todo print deve mostrar **data e hora visíveis**
(relógio do sistema ou do navegador). Use dados fictícios: nada de nome, e-mail ou matrícula reais.

`GXX-PALAVRA` na ficha vira **`G01-PALAVRA`** (Grupo 1). A palavra do dia é anunciada pelo professor
durante a aula; nos nomes de arquivo e nos comandos abaixo, troque `PALAVRA` por ela.

## Lista de evidências (E1 a E6)

| Código | Evidência | Arquivo sugerido | Situação |
|---|---|---|---|
| E1 | Registro do ambiente: URL pública (Nível A) ou descrição do ambiente (Níveis B e C) | `E1-ambiente.png` | Aplicação Nível A publicada; print com data e hora pendente |
| E2 | Prova de persistência: os quatro prints do registro `G01-PALAVRA` | `E2-print1-lista.png`, `E2-print2-iniciado-em-antes.png`, `E2-print3-depois-do-reinicio.png`, `E2-print4-consulta-sql.png` | Pendente |
| E3 | Casos de teste: pelo menos 5, sendo 2 negativos, com esperado e obtido | `E3-testes.png` (saída de `npm test`) e a tabela do README | 70 testes automatizados e 16 e2e; print pendente |
| E4 | Diagrama de arquitetura | no README (mermaid) | Pronto |
| E5 | Configuração segura: print das variáveis de ambiente com o valor oculto e o `.gitignore` com `.env` | `E5-variaveis-ocultas.png`, `E5-gitignore.png` | Variáveis já configuradas no App Service; prints pendentes |
| E6 | README completo e link do vídeo do pitch de 90 segundos | README + `E6-pitch.txt` com o link | README pronto; vídeo pendente |

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
