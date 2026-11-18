# Design do front-end

Registro do redesenho das cinco telas (issue #22). Stack mantida: HTML, CSS e JavaScript puros servidos
pelo Express. Não há framework: são cinco telas e nenhuma regra de negócio no cliente, então um framework só
aumentaria dependências e superfície de ataque.

## Identidade

- **Tom:** claro, direto e institucional. O público usa o celular, em poucos segundos, sem cadastro.
- **Cor principal:** azul (`--primaria`), com âmbar só nas estrelas de nota (`--estrela`).
- **Marca:** quadrado arredondado com uma estrela em SVG inline e o nome "Avalie o Atendimento".
- **Tipografia:** fontes do sistema (`system-ui`), sem arquivo de fonte externo.
- **Tema:** claro e escuro automáticos por `prefers-color-scheme`; as cores trocam só nos tokens.

## Tokens (`css/tokens.css`)

| Grupo | Variáveis |
|---|---|
| Cores | `--fundo`, `--superficie`, `--superficie-2`, `--borda`, `--texto`, `--texto-2`, `--primaria`, `--primaria-hover`, `--foco`, `--estrela`, `--ok`, `--erro`, `--aviso`, `--info` (cada estado com `-fundo`) e `--grafico-1` a `--grafico-4` |
| Espaçamento | `--e1` a `--e8` (escala de 4 px: 0,25 a 4 rem) |
| Raio | `--r-sm`, `--r-md`, `--r-lg`, `--r-pill` |
| Tipografia | `--fonte`, `--t-sm`, `--t-base`, `--t-lg`, `--t-xl`, `--t-2xl` (fluida com `clamp`) |
| Medidas | `--alvo` (44 px, tamanho mínimo de toque), `--largura` (72 rem) |

Os pares de texto e fundo foram conferidos para contraste AA (4,5:1) nos dois temas.

## Arquivos de estilo

`tokens.css` (valores) -> `base.css` (reset, cabeçalho, botões, campos, painéis, avisos, selos, estados,
tabela, rodapé, página central) -> um arquivo por tela: `index.css`, `dashboard.css`, `admin.css`, `login.css`.
Nenhuma tela usa estilo ou script inline, nem biblioteca ou fonte de CDN (a CSP do servidor permite só `'self'`).
O Chart.js é dependência do npm, com versão exata, servido em `/vendor/chart.umd.js`.

## Telas

| Tela | Arquivo | Conteúdo |
|---|---|---|
| Avaliar | `index.html` | apresentação, resumo, formulário, painel por serviço, comentários públicos |
| Dashboard | `dashboard.html` | métricas, filtro por serviço, três gráficos e tabela por serviço |
| Login do gestor | `admin-login.html` | usuário e senha, erro claro, sem dado na URL |
| Moderação | `admin.html` | resumo, filtros, lista com ocultar e reexibir |
| Sem conexão | `offline.html` | aviso de que nada é enviado sem conexão e como tentar de novo |

## Estados de cada tela

| Estado | Como aparece |
|---|---|
| Carregando | esqueleto animado (parado quando o usuário pede menos movimento) ou texto "Carregando…" |
| Vazio | caixa tracejada com a explicação ("Nenhum comentário público ainda…") |
| Erro | aviso vermelho com a mensagem do servidor ou da rede e botão "Tentar de novo" |
| Sucesso | aviso verde, só depois do 201 do servidor (envio) ou do 200 (moderação) |
| Amostra insuficiente | selo âmbar "Amostra insuficiente" no lugar da média (menos de 3 avaliações) |
| Sem conexão | indicador no cabeçalho e envio recusado, sem confirmar nada |

## Acessibilidade

- Atalho "Ir para o conteúdo", `lang="pt-BR"`, um `h1` por tela, regiões e títulos associados.
- Foco visível em tudo (anel de 3 px), alvos de toque de pelo menos 44 px, rótulo em todo campo.
- A nota é um grupo de botões de rádio (`fieldset` + `legend`), navegável por teclado: a ordem visual
  é a ordem do DOM (1 a 5), então as setas seguem o que se vê. O leitor de tela anuncia "N estrelas".
- Barras de distribuição são `<progress>` com texto; gráficos têm `role="img"`, descrição e uma tabela
  equivalente na mesma página.
- Mensagens em regiões `aria-live`; `prefers-reduced-motion` desliga animações e transições.
- Layout fluido sem rolagem horizontal a partir de 360 px; duas colunas só a partir de 60 rem.

## Formulários sem JavaScript

Os dois formulários declaram `method="post"` e `action`, então, mesmo com o JavaScript bloqueado, o envio
nativo nunca coloca usuário, senha ou comentário na URL (nada de `GET` com query string).
