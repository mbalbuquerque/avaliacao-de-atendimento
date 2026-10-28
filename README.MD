
# Avalie o Atendimento — Frontend

Projeto acadêmico do Grupo 1 — Cloud Challenge — SENAC 2026.2.

## Objetivo

Criar uma aplicação web para avaliações anônimas dos serviços
da instituição, permitindo acompanhar indicadores de satisfação.

## Tecnologias

- HTML5
- CSS3
- JavaScript
- localStorage (somente protótipo)

## Paleta

- Azul principal: #0482C2
- Azul escuro: #035680
- Azul destaque: #05ACFF
- Grafite: #3D3D3D
- Cinza: #C2C3C5

## Funcionalidades

- Avaliação anônima.
- Seleção de serviço.
- Notas de 1 a 5 estrelas.
- Comentários opcionais de até 280 caracteres.
- Contagem de avaliações por serviço.
- Média com uma casa decimal.
- Regra de amostra insuficiente.
- Distribuição de notas.
- Moderação demonstrativa.
- Interface responsiva.

## Regra de negócio

Serviços com menos de três avaliações não apresentam média.

Exemplo:

Notas: 5, 4 e 4
Quantidade: 3
Média: 4,3

Com apenas duas avaliações, exibir:

"Amostra insuficiente"

## Executar

No terminal, dentro da pasta do projeto:

python -m http.server 5500

Acessar:

http://localhost:5500

## Limitações

Este frontend ainda não utiliza banco de dados.

Os dados são armazenados no navegador por meio do localStorage.

A moderação não possui autenticação e não deve ser utilizada
como área administrativa real.

## Próximas etapas

1. Integrar com o backend.
2. Conectar ao PostgreSQL.
3. Implementar validações no servidor.
4. Criar rota GET /health.
5. Proteger a moderação com autenticação.
6. Realizar testes de persistência.
7. Implantar na Azure.

## Equipe

- Antônio Enzo — DADOS
- Emmanuel Luis — DADOS
- Everson José — NUVEM
- Gabriel Eduardo — QA
- José Allamberg — DEV
- Marcelo Barbosa — DEV
