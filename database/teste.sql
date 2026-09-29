-- ============================================================================
-- DADOS DE TESTE INICIAIS (SEED DATA) - PROJETO ESTACIA
-- ============================================================================

-- 1. Cadastrar a Planta do Shopping
INSERT INTO public.plantas_shopping (nome_shopping, nivel_piso, cidade, uf) 
VALUES ('Shopping EstacIA', 'Piso G1', 'Brasília', 'DF');

-- 2. Cadastrar 3 Setores de Exemplo (vinculados à planta id_planta = 1)
INSERT INTO public.setores (id_planta, nome_setor, ponto_referencia, capacidade_total) VALUES
(1, 'Setor A (Amarelo)', 'Próximo à Praça de Alimentação', 10),
(1, 'Setor B (Azul)', 'Próximo ao Cinema', 10),
(1, 'Setor C (Verde)', 'Próximo ao Hipermercado', 10);

-- 3. Cadastrar Vagas de Exemplo
-- Vagas do Setor A (id_setor = 1)
INSERT INTO public.vagas (id_setor, codigo_vaga, qr_code_hash, status) VALUES
(1, 'A-101', 'HASH_QR_A101', 'LIVRE'),
(1, 'A-102', 'HASH_QR_A102', 'OCUPADA'),
(1, 'A-103', 'HASH_QR_A103', 'LIVRE'),
(1, 'A-104', 'HASH_QR_A104', 'LIVRE');

-- Vagas do Setor B (id_setor = 2)
INSERT INTO public.vagas (id_setor, codigo_vaga, qr_code_hash, status) VALUES
(2, 'B-201', 'HASH_QR_B201', 'OCUPADA'),
(2, 'B-202', 'HASH_QR_B202', 'OCUPADA'),
(2, 'B-203', 'HASH_QR_B203', 'LIVRE');

-- Vagas do Setor C (id_setor = 3)
INSERT INTO public.vagas (id_setor, codigo_vaga, qr_code_hash, status) VALUES
(3, 'C-301', 'HASH_QR_C301', 'LIVRE'),
(3, 'C-302', 'HASH_QR_C302', 'LIVRE');

-- 4. Cadastrar Sensores associados às vagas físicas
INSERT INTO public.sensores_vaga (id_vaga, codigo_hardware, status_deteccao, bateria_porcentagem) VALUES
(1, 'SENS_A101', FALSE, 98),
(2, 'SENS_A102', TRUE,  92),
(3, 'SENS_A103', FALSE, 100),
(4, 'SENS_A104', FALSE, 85),
(5, 'SENS_B201', TRUE,  79);

-- 5. Cadastrar 1 Usuário de Teste
INSERT INTO public.usuarios (nome_completo, email, senha_hash) VALUES
('Usuário Teste EstacIA', 'teste@estacia.com.br', '123456');

-- 6. Cadastrar 1 Estadia Ativa (Check-in do Usuário Teste na vaga A-102)
INSERT INTO public.estadias (id_usuario, id_vaga, tipo_identificacao, identificador_veiculo, status_pagamento) VALUES
(1, 2, 'PLACA', 'ABC1D23', 'PENDENTE');