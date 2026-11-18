# Prova de persistência (passos 1, 2, 3 e 5). O reinício e a consulta SQL são manuais.
# Uso: .\evidencias\prova-persistencia.ps1 [-Base URL] [-Palavra PALAVRA]
# Exemplo: .\evidencias\prova-persistencia.ps1 -Base http://localhost:3000 -Palavra G01-PALAVRA

param(
  [string]$Base = "http://localhost:3000",
  [string]$Palavra = "G01-PALAVRA"
)

function Titulo($texto) {
  Write-Host ""
  Write-Host ("[{0}] {1}" -f (Get-Date -Format "dd/MM/yyyy HH:mm:ss"), $texto)
}

function Listar() {
  $lista = Invoke-RestMethod -Uri "$Base/api/comentarios" -Method Get
  return @($lista | Where-Object { $_.comentario -eq $Palavra })
}

Titulo "Passo 1: cadastrar o registro $Palavra pela aplicação"
$corpo = @{ servico_id = 1; nota = 5; comentario = $Palavra } | ConvertTo-Json
try {
  $criada = Invoke-RestMethod -Uri "$Base/api/avaliacoes" -Method Post -ContentType "application/json" -Body $corpo
  Write-Host ("HTTP 201: " + ($criada | ConvertTo-Json -Compress))
} catch {
  Write-Host ("Falha ao cadastrar: " + $_.Exception.Message)
}

Titulo "Passo 2: listar os registros pela aplicação (PRINT 1)"
$achados = Listar
if ($achados.Count -gt 0) { $achados | Format-Table id, servico, nota, comentario, criada_em -AutoSize }
else { Write-Host "Registro $Palavra NAO encontrado na lista." }

Titulo "Passo 3: anotar o iniciado_em do /health (PRINT 2)"
$antes = Invoke-RestMethod -Uri "$Base/health" -Method Get
Write-Host ($antes | ConvertTo-Json -Compress)

Titulo "Passo 4: reinicie a aplicação agora"
Write-Host "Nível A: botão Reiniciar no portal ou az webapp restart --name APP --resource-group rg-cloud-g01"
Write-Host "Níveis B e C: pare e inicie o processo (npm start)."
Read-Host "Quando a aplicação voltar, pressione Enter para continuar"

Titulo "Passo 5: conferir que iniciado_em mudou e que o registro continua lá (PRINT 3)"
$depois = Invoke-RestMethod -Uri "$Base/health" -Method Get
Write-Host ($depois | ConvertTo-Json -Compress)
if ($depois.iniciado_em -ne $antes.iniciado_em) { Write-Host "OK: iniciado_em mudou, a aplicação reiniciou." }
else { Write-Host "ATENÇÃO: iniciado_em não mudou. A aplicação reiniciou mesmo?" }

$achados = Listar
if ($achados.Count -gt 0) { Write-Host "OK: o registro $Palavra continua listado."; $achados | Format-Table id, servico, nota, comentario, criada_em -AutoSize }
else { Write-Host "FALHA: o registro $Palavra sumiu depois do reinício." }

Titulo "Passo 6 (manual): mostrar a mesma linha direto no banco (PRINT 4)"
Write-Host "Editor de consultas da Azure, Cloud Shell com psql ou outro cliente SQL:"
Write-Host ""
Write-Host "  SELECT id, servico_id, nota, comentario, oculta, criada_em"
Write-Host "    FROM avaliacoes"
Write-Host "   WHERE comentario = '$Palavra';"
