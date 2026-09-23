-- Inserir Shopping e Setores
INSERT INTO shoppings (id, nome, endereco, taxa_hora_padrao) 
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Shopping Center Cidade Jardim', 'SCN - Asa Norte, Brasília - DF', 8.50);

INSERT INTO plantas_shopping (id, shopping_id, nome_setor, descricao_referencia, capacidade_vagas) VALUES
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Setor A - Norte', 'Próx. Lojas Americanas', 60),
('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Setor B - Sul', 'Próx. C&A e Riachuelo', 50);

-- Inserir Vaga Principal (Exemplo das telas: A-145)
INSERT INTO vagas (id, planta_id, codigo, tipo, status, posicao_x, posicao_y)
VALUES ('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'A-145', 'COMUM', 'LIVRE', 120.50, 85.00);

-- Inserir Passos de Navegação (encontremeucarro.html / navegacao.html)
INSERT INTO passos_navegacao (planta_id, origem_local, passo_numero, instrucao, distancia_metros) VALUES
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Riachuelo', 1, 'Saia da porta principal da Riachuelo em direção ao Átrio Central', 15),
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Riachuelo', 2, 'Siga pelo Átrio Central em direção ao Bolsão do Setor A', 180);