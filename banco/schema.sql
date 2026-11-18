-- Esquema do Avalie o Atendimento (PostgreSQL 16).
-- Pode ser executado mais de uma vez: usa IF NOT EXISTS e ON CONFLICT.

CREATE TABLE IF NOT EXISTS servicos (
  id   SMALLSERIAL PRIMARY KEY,
  nome VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS avaliacoes (
  id          SERIAL PRIMARY KEY,
  servico_id  SMALLINT    NOT NULL REFERENCES servicos (id),
  -- Nota inteira de 1 a 5: o banco recusa qualquer outro valor, mesmo que a API falhe.
  nota        SMALLINT    NOT NULL CHECK (nota BETWEEN 1 AND 5),
  -- Comentário opcional de até 280 caracteres.
  comentario  VARCHAR(280),
  -- Moderação: ocultar esconde o comentário da lista pública, mas a nota continua valendo.
  oculta      BOOLEAN     NOT NULL DEFAULT false,
  criada_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Os indicadores agrupam por serviço.
CREATE INDEX IF NOT EXISTS idx_avaliacoes_servico ON avaliacoes (servico_id);

-- Os quatro serviços avaliados (RF01).
INSERT INTO servicos (nome) VALUES
  ('Secretaria'),
  ('Biblioteca'),
  ('Cantina'),
  ('Laboratórios')
ON CONFLICT (nome) DO NOTHING;
