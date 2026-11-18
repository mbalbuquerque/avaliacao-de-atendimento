-- Usuário da aplicação com o mínimo de privilégio (nunca o administrador do servidor).
-- Execute como administrador, depois do schema.sql. A senha NÃO fica no repositório:
-- crie o usuário antes com
--   CREATE ROLE app_avaliacao LOGIN PASSWORD '<senha gerada>';
-- e coloque essa senha só na variável DATABASE_URL do App Service.

GRANT CONNECT ON DATABASE avaliacao TO app_avaliacao;
GRANT USAGE ON SCHEMA public TO app_avaliacao;

-- Serviços: só leitura.
GRANT SELECT ON servicos TO app_avaliacao;

-- Avaliações: ler, inserir e, na moderação, mudar apenas a coluna "oculta".
-- A nota e o comentário nunca podem ser alterados nem apagados pela aplicação.
GRANT SELECT, INSERT ON avaliacoes TO app_avaliacao;
GRANT UPDATE (oculta) ON avaliacoes TO app_avaliacao;
GRANT USAGE ON SEQUENCE avaliacoes_id_seq TO app_avaliacao;
