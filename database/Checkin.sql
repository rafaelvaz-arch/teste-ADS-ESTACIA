-- 1. Adicionar colunas de controle de reserva na tabela vagas existente
ALTER TABLE public.vagas 
ADD COLUMN IF NOT EXISTS reservado_por integer REFERENCES public.usuarios(id_usuario),
ADD COLUMN IF NOT EXISTS reservada_ate timestamptz;

-- 2. Liberar permissões RLS para leitura e atualização das vagas
DROP POLICY IF EXISTS "Acesso vagas" ON public.vagas;
CREATE POLICY "Acesso vagas" ON public.vagas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. Função para RESERVAR vaga ao iniciar rota (válida por 5 minutos)
CREATE OR REPLACE FUNCTION public.reservar_vaga(p_codigo_vaga text, p_id_usuario int)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_linhas int;
BEGIN
  UPDATE public.vagas
  SET status = 'RESERVADA',
      reservado_por = p_id_usuario,
      reservada_ate = now() + interval '5 minutes',
      atualizado_em = now()
  WHERE codigo_vaga = p_codigo_vaga
    AND (status = 'LIVRE' OR (status = 'RESERVADA' AND reservada_ate < now()));

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  RETURN v_linhas > 0;
END;
$$;

-- 4. Função ATÔMICA de CHECK-IN (O coração da demonstração)
CREATE OR REPLACE FUNCTION public.realizar_checkin(p_codigo_vaga text, p_id_usuario int)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_vaga int;
BEGIN
  -- Tenta ocupar a vaga em uma única operação atômica
  UPDATE public.vagas
  SET status = 'OCUPADA',
      reservado_por = NULL,
      reservada_ate = NULL,
      atualizado_em = now()
  WHERE codigo_vaga = p_codigo_vaga
    AND (
      status = 'LIVRE' 
      OR (status = 'RESERVADA' AND reservado_por = p_id_usuario)
      OR (status = 'RESERVADA' AND reservada_ate < now())
    )
  RETURNING id_vaga INTO v_id_vaga;

  -- Se atualizou, o check-in foi aceito
  IF v_id_vaga IS NOT NULL THEN
    RETURN json_build_object('sucesso', true, 'id_vaga', v_id_vaga, 'mensagem', 'Check-in confirmado!');
  ELSE
    RETURN json_build_object('sucesso', false, 'mensagem', 'Esta vaga já está em uso ou reservada para outro veículo.');
  END IF;
END;
$$;