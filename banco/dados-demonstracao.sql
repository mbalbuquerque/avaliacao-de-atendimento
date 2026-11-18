-- Dados FICTÍCIOS de demonstração do Avalie o Atendimento (20 avaliações). Nenhum dado pessoal.
--
-- Isto NÃO é mock: são linhas de verdade, gravadas no PostgreSQL e lidas pela mesma API que
-- atende os estudantes. Servem para o painel não aparecer vazio na apresentação.
-- Laboratórios fica com 2 avaliações de propósito: mostra "Amostra insuficiente".
--
-- Carga opcional:  npm run banco -- --demonstracao
-- É idempotente por dentro: o próprio INSERT não faz nada se a primeira avaliação desta carga já
-- estiver no banco (nenhum valor de controle fica escrito no código da aplicação).
-- As datas são relativas a "agora" e se espalham pelos últimos 5 dias.

INSERT INTO avaliacoes (servico_id, nota, comentario, criada_em)
SELECT v.servico_id, v.nota, v.comentario, v.criada_em
FROM (VALUES
  -- Secretaria
  (1, 5, 'Atendimento rápido e organizado.', now() - interval '118 hours'),
  (1, 4, 'Resolveram meu pedido no mesmo dia.', now() - interval '112 hours'),
  (1, 4, NULL, now() - interval '106 hours'),
  (1, 3, 'A fila demorou um pouco.', now() - interval '100 hours'),
  (1, 5, NULL, now() - interval '94 hours'),
  (1, 4, 'Funcionários educados.', now() - interval '88 hours'),
  -- Biblioteca
  (2, 5, 'Ótimo acervo e silêncio para estudar.', now() - interval '82 hours'),
  (2, 4, NULL, now() - interval '76 hours'),
  (2, 5, 'Empréstimo fácil.', now() - interval '70 hours'),
  (2, 3, 'Faltam tomadas nas mesas.', now() - interval '64 hours'),
  (2, 4, NULL, now() - interval '58 hours'),
  (2, 5, 'Bibliotecária muito prestativa.', now() - interval '52 hours'),
  -- Cantina
  (3, 3, 'Preço um pouco alto.', now() - interval '46 hours'),
  (3, 4, 'Lanche saboroso.', now() - interval '40 hours'),
  (3, 2, 'Fila grande no intervalo.', now() - interval '34 hours'),
  (3, 4, NULL, now() - interval '28 hours'),
  (3, 5, 'Opções saudáveis, gostei.', now() - interval '22 hours'),
  (3, 3, NULL, now() - interval '16 hours'),
  -- Laboratórios
  (4, 5, 'Máquinas rápidas.', now() - interval '10 hours'),
  (4, 4, NULL, now() - interval '4 hours')
) AS v (servico_id, nota, comentario, criada_em)
WHERE NOT EXISTS (
  SELECT 1 FROM avaliacoes a
   WHERE a.servico_id = 1 AND a.comentario = 'Atendimento rápido e organizado.'
);
