-- 1. Libera as vagas 145, 102 e 103 (limpando reservas antigas e botando como LIVRE)
UPDATE public.vagas
SET status = 'LIVRE',
    reservado_por = NULL,
    reservada_ate = NULL,
    atualizado_em = now()
WHERE codigo_vaga IN ('A-145', 'A-102', 'A-103');

-- 2. Garante que a vaga 104 esteja OCUPADA
UPDATE public.vagas
SET status = 'OCUPADA',
    atualizado_em = now()
WHERE codigo_vaga = 'A-104';