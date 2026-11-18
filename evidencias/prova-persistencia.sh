#!/usr/bin/env bash
# Prova de persistência (passos 1, 2, 3 e 5). O reinício e a consulta SQL são manuais.
# Uso: ./evidencias/prova-persistencia.sh [URL_BASE] [PALAVRA]
# Exemplo: ./evidencias/prova-persistencia.sh http://localhost:3000 G01-PALAVRA

BASE="${1:-http://localhost:3000}"
PALAVRA="${2:-G01-PALAVRA}"

agora() { date "+%d/%m/%Y %H:%M:%S"; }
titulo() { printf '\n[%s] %s\n' "$(agora)" "$1"; }

titulo "Passo 1: cadastrar o registro ${PALAVRA} pela aplicação"
RESP=$(curl -s -w '\nHTTP %{http_code}' -X POST "${BASE}/api/avaliacoes" \
  -H 'Content-Type: application/json' \
  -d "{\"servico_id\":1,\"nota\":5,\"comentario\":\"${PALAVRA}\"}")
echo "$RESP"

titulo "Passo 2: listar os registros pela aplicação (PRINT 1)"
curl -s "${BASE}/api/comentarios" | grep -o "{[^}]*${PALAVRA}[^}]*}" || echo "Registro ${PALAVRA} NAO encontrado na lista."

titulo "Passo 3: anotar o iniciado_em do /health (PRINT 2)"
ANTES=$(curl -s "${BASE}/health")
echo "$ANTES"
INICIO_ANTES=$(echo "$ANTES" | grep -o '"iniciado_em":"[^"]*"')

titulo "Passo 4: reinicie a aplicação agora"
echo "Nível A: botão Reiniciar no portal ou az webapp restart --name APP --resource-group rg-cloud-g01"
echo "Níveis B e C: pare e inicie o processo (npm start)."
read -r -p "Quando a aplicação voltar, pressione Enter para continuar... " _

titulo "Passo 5: conferir que iniciado_em mudou e que o registro continua lá (PRINT 3)"
DEPOIS=$(curl -s "${BASE}/health")
echo "$DEPOIS"
INICIO_DEPOIS=$(echo "$DEPOIS" | grep -o '"iniciado_em":"[^"]*"')
if [ -n "$INICIO_ANTES" ] && [ "$INICIO_ANTES" != "$INICIO_DEPOIS" ]; then
  echo "OK: iniciado_em mudou, a aplicação reiniciou."
else
  echo "ATENÇÃO: iniciado_em não mudou. A aplicação reiniciou mesmo?"
fi
curl -s "${BASE}/api/comentarios" | grep -o "{[^}]*${PALAVRA}[^}]*}" \
  && echo "OK: o registro ${PALAVRA} continua listado." \
  || echo "FALHA: o registro ${PALAVRA} sumiu depois do reinício."

titulo "Passo 6 (manual): mostrar a mesma linha direto no banco (PRINT 4)"
cat <<SQL
Editor de consultas da Azure, Cloud Shell com psql ou outro cliente SQL:

  SELECT id, servico_id, nota, comentario, oculta, criada_em
    FROM avaliacoes
   WHERE comentario = '${PALAVRA}';
SQL
