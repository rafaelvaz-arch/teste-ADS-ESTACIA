-- ==============================================================================
-- 1. EXTENSÕES E ENUMS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE status_vaga_enum AS ENUM ('LIVRE', 'OCUPADA', 'RESERVADA', 'MANUTENCAO');
CREATE TYPE tipo_vaga_enum AS ENUM ('COMUM', 'PNE', 'IDOSO', 'VIP', 'ELETRICO');
CREATE TYPE status_sensor_enum AS ENUM ('ONLINE', 'OFFLINE', 'BATERIA_BAIXA', 'DEFEITO');
CREATE TYPE status_sessao_enum AS ENUM ('EM_ABERTO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'FINALIZADO');
CREATE TYPE metodo_pagamento_enum AS ENUM ('PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO');
CREATE TYPE status_pagamento_enum AS ENUM ('PENDENTE', 'CONFIRMADO', 'CANCELADO');

-- ==============================================================================
-- 2. AUTENTICAÇÃO E PERFIS DE USUÁRIOS (index.html, cadastro.html, principal.html)
-- ==============================================================================
CREATE TABLE perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome_completo VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    cpf VARCHAR(14) UNIQUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. SHOPPINGS E ESTRUTURA FÍSICA (principal.html, setores.html)
-- ==============================================================================
CREATE TABLE shoppings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL, -- Ex: "Shopping Center Cidade Jardim"
    endereco VARCHAR(200) NOT NULL, -- Ex: "SCN - Asa Norte, Brasília - DF"
    taxa_hora_padrao NUMERIC(6,2) NOT NULL DEFAULT 8.50, -- Ex: R$ 8,50/hora
    minutos_tolerancia_saida INT NOT NULL DEFAULT 20, -- Tolerância pós-pagamento (20 min)
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE plantas_shopping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shopping_id UUID NOT NULL REFERENCES shoppings(id) ON DELETE CASCADE,
    nome_setor VARCHAR(50) NOT NULL, -- Ex: "Setor A - Norte"
    descricao_referencia VARCHAR(100), -- Ex: "Próx. Lojas Americanas"
    piso_nivel INT NOT NULL DEFAULT 0, -- 0 = Térreo
    capacidade_vagas INT NOT NULL DEFAULT 60,
    url_mapa_svg TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. VAGAS E SENSORES IOT (setores.html, encontremeucarro.html, monitoramento.html)
-- ==============================================================================
CREATE TABLE vagas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planta_id UUID NOT NULL REFERENCES plantas_shopping(id) ON DELETE CASCADE,
    codigo VARCHAR(10) NOT NULL UNIQUE, -- Ex: 'A-145', 'B-089'
    tipo tipo_vaga_enum NOT NULL DEFAULT 'COMUM',
    status status_vaga_enum NOT NULL DEFAULT 'LIVRE',
    posicao_x NUMERIC(8,2) NOT NULL DEFAULT 0.00, -- Para renderização no SVG
    posicao_y NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sensores_vaga (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vaga_id UUID UNIQUE REFERENCES vagas(id) ON DELETE SET NULL,
    numero_serie VARCHAR(50) NOT NULL UNIQUE,
    status status_sensor_enum NOT NULL DEFAULT 'ONLINE',
    nivel_bateria INT CHECK (nivel_bateria BETWEEN 0 AND 100) DEFAULT 100,
    ultima_leitura_em TIMESTAMPTZ DEFAULT NOW(),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. VEÍCULOS E CHECK-IN (checkin.html)
-- ==============================================================================
CREATE TABLE veiculos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
    placa VARCHAR(8) UNIQUE, -- Ex: 'ABC-1234'
    chassi VARCHAR(17) UNIQUE, -- Suporte a identificação por Chassi
    modelo VARCHAR(50),
    cor VARCHAR(30),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. NAVEGAÇÃO E PASSO A PASSO (navegacao.html, encontremeucarro.html)
-- ==============================================================================
CREATE TABLE passos_navegacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planta_id UUID NOT NULL REFERENCES plantas_shopping(id) ON DELETE CASCADE,
    origem_local VARCHAR(100) NOT NULL, -- Ex: "Entrada Sul" ou "Lojas Riachuelo"
    passo_numero INT NOT NULL, -- 1, 2, 3, 4
    instrucao TEXT NOT NULL, -- Ex: "Ao passar pela Entrada Sul, dobre à esquerda"
    distancia_metros INT NOT NULL, -- Ex: 30, 180, 50
    ponto_referencia VARCHAR(100)
);

-- ==============================================================================
-- 7. SESSÕES DE ESTACIONAMENTO E MONITORAÇÃO (monitoramento.html, principal.html)
-- ==============================================================================
CREATE TABLE sessoes_estacionamento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES perfis(id) ON DELETE RESTRICT,
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
    vaga_id UUID NOT NULL REFERENCES vagas(id) ON DELETE RESTRICT,
    data_entrada TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Check-in (ex: 21:44)
    data_saida TIMESTAMPTZ,
    taxa_hora_aplicada NUMERIC(6,2) NOT NULL DEFAULT 8.50, -- R$ 8,50/h
    valor_total NUMERIC(8,2) DEFAULT 0.00, -- R$ 1,98
    limite_saida_em TIMESTAMPTZ, -- Registrado após pagamento (+20 min)
    status status_sessao_enum NOT NULL DEFAULT 'EM_ABERTO',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. TRANSAÇÕES FINANCEIRAS (pagamento.html)
-- ==============================================================================
CREATE TABLE pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sessao_id UUID NOT NULL REFERENCES sessoes_estacionamento(id) ON DELETE RESTRICT,
    valor_pago NUMERIC(8,2) NOT NULL CHECK (valor_pago > 0),
    metodo_pagamento metodo_pagamento_enum NOT NULL, -- PIX ou CARTAO
    codigo_pix_copia_cola TEXT, -- Suporte ao campo copia e cola do PIX
    transacao_external_id VARCHAR(100), -- ID Gateway (ex: MercadoPago / Stripe)
    status_pagamento status_pagamento_enum NOT NULL DEFAULT 'CONFIRMADO',
    pago_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 9. ÍNDICES DE DESEMPENHO E LATÊNCIA
-- ==============================================================================
CREATE INDEX idx_vagas_codigo ON vagas(codigo);
CREATE INDEX idx_vagas_setor_status ON vagas(planta_id, status);
CREATE INDEX idx_sessoes_usuario ON sessoes_estacionamento(usuario_id, status);
CREATE INDEX idx_sessoes_vaga ON sessoes_estacionamento(vaga_id, status);
CREATE INDEX idx_pagamentos_pago_em ON pagamentos(pago_em);