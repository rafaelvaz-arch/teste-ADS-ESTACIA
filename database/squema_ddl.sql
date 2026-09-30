-- ============================================================================
-- PROJETO ESTACIA - ESTRUTURA DDL SUPABASE (POSTGRESQL)
-- ============================================================================

-- 1. TABELA: plantas_shopping
CREATE TABLE IF NOT EXISTS public.plantas_shopping (
    id_planta BIGSERIAL PRIMARY KEY,
    nome_shopping VARCHAR(150) NOT NULL,
    nivel_piso VARCHAR(50) NOT NULL,
    cidade VARCHAR(100) NOT NULL DEFAULT 'Brasília',
    uf VARCHAR(2) NOT NULL DEFAULT 'DF',
    imagem_planta_url TEXT,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA: setores
CREATE TABLE IF NOT EXISTS public.setores (
    id_setor BIGSERIAL PRIMARY KEY,
    id_planta BIGINT NOT NULL REFERENCES public.plantas_shopping(id_planta) ON DELETE CASCADE,
    nome_setor VARCHAR(50) NOT NULL,
    ponto_referencia VARCHAR(150),
    capacidade_total INT NOT NULL CHECK (capacidade_total > 0),
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA: vagas
CREATE TABLE IF NOT EXISTS public.vagas (
    id_vaga BIGSERIAL PRIMARY KEY,
    id_setor BIGINT NOT NULL REFERENCES public.setores(id_setor) ON DELETE CASCADE,
    codigo_vaga VARCHAR(20) NOT NULL UNIQUE, -- Ex: 'A-145'
    qr_code_hash VARCHAR(255) UNIQUE,        -- Hash/Token contido no QR Code da vaga
    status VARCHAR(20) NOT NULL DEFAULT 'LIVRE' 
        CHECK (status IN ('LIVRE', 'OCUPADA', 'RESERVADA', 'MANUTENCAO')),
    atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABELA: sensores_vaga (Alimentado pela API de Hardware)
CREATE TABLE IF NOT EXISTS public.sensores_vaga (
    id_sensor BIGSERIAL PRIMARY KEY,
    id_vaga BIGINT NOT NULL UNIQUE REFERENCES public.vagas(id_vaga) ON DELETE CASCADE,
    codigo_hardware VARCHAR(100) NOT NULL UNIQUE, -- ID físico do sensor IoT
    status_deteccao BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = Carro detectado
    bateria_porcentagem INT CHECK (bateria_porcentagem BETWEEN 0 AND 100),
    ultima_leitura TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABELA: usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
    id_usuario BIGSERIAL PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABELA: estadias (Histórico, Check-in e Cobrança)
CREATE TABLE IF NOT EXISTS public.estadias (
    id_estadia BIGSERIAL PRIMARY KEY,
    id_usuario BIGINT NOT NULL REFERENCES public.usuarios(id_usuario),
    id_vaga BIGINT NOT NULL REFERENCES public.vagas(id_vaga),
    tipo_identificacao VARCHAR(10) NOT NULL CHECK (tipo_identificacao IN ('PLACA', 'CHASSI')),
    identificador_veiculo VARCHAR(20) NOT NULL,
    data_hora_entrada TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_hora_saida TIMESTAMPTZ,
    taxa_por_hora NUMERIC(10, 2) NOT NULL DEFAULT 8.50,
    valor_total NUMERIC(10, 2) DEFAULT 0.00,
    status_pagamento VARCHAR(20) NOT NULL DEFAULT 'PENDENTE'
        CHECK (status_pagamento IN ('PENDENTE', 'PAGO', 'CANCELADO')),
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_vagas_codigo ON public.vagas(codigo_vaga);
CREATE INDEX IF NOT EXISTS idx_vagas_status ON public.vagas(status);
CREATE INDEX IF NOT EXISTS idx_estadias_usuario ON public.estadias(id_usuario);

-- ============================================================================
-- TRIGGER: Automação do Status do Sensor para a Vaga
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_sincronizar_status_vaga_sensor()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status_deteccao = TRUE THEN
        UPDATE public.vagas 
        SET status = 'OCUPADA', atualizado_em = CURRENT_TIMESTAMP
        WHERE id_vaga = NEW.id_vaga;
    ELSE
        UPDATE public.vagas 
        SET status = 'LIVRE', atualizado_em = CURRENT_TIMESTAMP
        WHERE id_vaga = NEW.id_vaga AND status = 'OCUPADA';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sincroniza_sensor_vaga
AFTER INSERT OR UPDATE OF status_deteccao ON public.sensores_vaga
FOR EACH ROW EXECUTE FUNCTION fn_sincronizar_status_vaga_sensor();

-- ============================================================================
-- VIEWS DE CONTABILIDADE E OCUPAÇÃO
-- ============================================================================

-- View 1: Para a tela setores.html e navegacao.html
CREATE OR REPLACE VIEW public.vw_ocupacao_setores AS
SELECT 
    s.id_setor,
    s.nome_setor,
    s.ponto_referencia,
    s.capacidade_total,
    COUNT(v.id_vaga) FILTER (WHERE v.status = 'LIVRE') AS vagas_livres,
    COUNT(v.id_vaga) FILTER (WHERE v.status = 'OCUPADA') AS vagas_ocupadas,
    ROUND(
        (COUNT(v.id_vaga) FILTER (WHERE v.status = 'OCUPADA')::NUMERIC / s.capacidade_total::NUMERIC) * 100, 
        2
    ) AS percentual_ocupacao
FROM public.setores s
LEFT JOIN public.vagas v ON s.id_setor = v.id_setor
GROUP BY s.id_setor, s.nome_setor, s.ponto_referencia, s.capacidade_total;

-- View 2: Para o Dashboard do Usuário (principal.html)
CREATE OR REPLACE VIEW public.vw_resumo_usuario AS
SELECT 
    u.id_usuario,
    u.nome_completo,
    u.email,
    COUNT(e.id_estadia) AS total_usos,
    COALESCE(
        ROUND(
            SUM(EXTRACT(EPOCH FROM (COALESCE(e.data_hora_saida, CURRENT_TIMESTAMP) - e.data_hora_entrada)) / 3600)::NUMERIC, 
            0
        ), 0
    ) AS total_horas,
    COALESCE(SUM(e.valor_total) FILTER (WHERE e.status_pagamento = 'PAGO'), 0.00) AS total_gasto
FROM public.usuarios u
LEFT JOIN public.estadias e ON u.id_usuario = e.id_usuario
GROUP BY u.id_usuario, u.nome_completo, u.email;

-- View 3: Contabilidade diária do shopping
CREATE OR REPLACE VIEW public.vw_contabilidade_faturamento_diario AS
SELECT 
    DATE(data_hora_entrada) AS data,
    COUNT(id_estadia) AS total_estadias,
    COUNT(id_estadia) FILTER (WHERE status_pagamento = 'PAGO') AS estadias_pagas,
    COALESCE(SUM(valor_total) FILTER (WHERE status_pagamento = 'PAGO'), 0.00) AS faturamento_total,
    COALESCE(ROUND(AVG(valor_total) FILTER (WHERE status_pagamento = 'PAGO'), 2), 0.00) AS ticket_medio
FROM public.estadias
GROUP BY DATE(data_hora_entrada)
ORDER BY data DESC;

-- ============================================================================
-- DESABILITAR RLS PARA PERMITIR ACESSO DO FRONTEND (TESTES DE DESENVOLVIMENTO)
-- ============================================================================
ALTER TABLE public.plantas_shopping DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.setores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vagas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensores_vaga DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.estadias DISABLE ROW LEVEL SECURITY;