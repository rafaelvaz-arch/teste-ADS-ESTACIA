-- 1. View de Faturamento Diário
CREATE OR REPLACE VIEW vw_contabilidade_faturamento_diario AS
SELECT 
    DATE(p.pago_em) AS data_referencia,
    p.metodo_pagamento,
    COUNT(p.id) AS qtd_transacoes,
    SUM(p.valor_pago) AS faturamento_bruto,
    ROUND(AVG(p.valor_pago), 2) AS ticket_medio
FROM pagamentos p
WHERE p.status_pagamento = 'CONFIRMADO'
GROUP BY DATE(p.pago_em), p.metodo_pagamento
ORDER BY data_referencia DESC;

-- 2. View de Fechamento Mensal
CREATE OR REPLACE VIEW vw_contabilidade_fechamento_mensal AS
SELECT 
    TO_CHAR(p.pago_em, 'YYYY-MM') AS mes_ano,
    s.nome AS shopping_nome,
    COUNT(DISTINCT se.id) AS total_sessoes_atendidas,
    COUNT(p.id) AS total_pagamentos,
    SUM(p.valor_pago) AS receita_total_bruta,
    SUM(CASE WHEN p.metodo_pagamento = 'PIX' THEN p.valor_pago ELSE 0 END) AS receita_pix,
    SUM(CASE WHEN p.metodo_pagamento IN ('CARTAO_CREDITO', 'CARTAO_DEBITO') THEN p.valor_pago ELSE 0 END) AS receita_cartao
FROM pagamentos p
JOIN sessoes_estacionamento se ON p.sessao_id = se.id
JOIN vagas v ON se.vaga_id = v.id
JOIN plantas_shopping ps ON v.planta_id = ps.id
JOIN shoppings s ON ps.shopping_id = s.id
WHERE p.status_pagamento = 'CONFIRMADO'
GROUP BY TO_CHAR(p.pago_em, 'YYYY-MM'), s.nome
ORDER BY mes_ano DESC;

-- 3. View de Receita por Setor
CREATE OR REPLACE VIEW vw_contabilidade_receita_por_setor AS
SELECT 
    ps.nome_setor,
    ps.capacidade_vagas,
    COUNT(DISTINCT se.id) AS total_estadias,
    ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(se.data_saida, NOW()) - se.data_entrada))/3600), 2) AS total_horas_ocupadas,
    COALESCE(SUM(p.valor_pago), 0.00) AS receita_acumulada
FROM plantas_shopping ps
LEFT JOIN vagas v ON ps.id = v.planta_id
LEFT JOIN sessoes_estacionamento se ON v.id = se.vaga_id
LEFT JOIN pagamentos p ON se.id = p.sessao_id AND p.status_pagamento = 'CONFIRMADO'
GROUP BY ps.id, ps.nome_setor, ps.capacidade_vagas
ORDER BY receita_acumulada DESC;