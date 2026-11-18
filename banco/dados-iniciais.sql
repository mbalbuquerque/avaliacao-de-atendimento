-- Dados fictícios para a demonstração (20 avaliações). Nenhum dado pessoal.
-- Laboratórios fica com 2 avaliações de propósito: mostra "amostra insuficiente".
-- Execute depois do schema.sql. Não rode duas vezes no mesmo banco.

INSERT INTO avaliacoes (servico_id, nota, comentario) VALUES
  -- Secretaria (6)
  (1, 5, 'Atendimento rápido e organizado.'),
  (1, 4, 'Resolveram meu pedido no mesmo dia.'),
  (1, 4, NULL),
  (1, 3, 'A fila demorou um pouco.'),
  (1, 5, NULL),
  (1, 4, 'Funcionários educados.'),
  -- Biblioteca (6)
  (2, 5, 'Ótimo acervo e silêncio para estudar.'),
  (2, 4, NULL),
  (2, 5, 'Empréstimo fácil.'),
  (2, 3, 'Faltam tomadas nas mesas.'),
  (2, 4, NULL),
  (2, 5, 'Bibliotecária muito prestativa.'),
  -- Cantina (6)
  (3, 3, 'Preço um pouco alto.'),
  (3, 4, 'Lanche saboroso.'),
  (3, 2, 'Fila grande no intervalo.'),
  (3, 4, NULL),
  (3, 5, 'Opções saudáveis, gostei.'),
  (3, 3, NULL),
  -- Laboratórios (2): amostra insuficiente
  (4, 5, 'Máquinas rápidas.'),
  (4, 4, NULL);
