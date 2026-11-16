ALTER TABLE public.plantas_shopping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensores_vaga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estadias ENABLE ROW LEVEL SECURITY;

-- 1. Remove políticas antigas para evitar conflitos de permissão
DROP POLICY IF EXISTS "Permitir leitura para login" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir cadastro de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.usuarios;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.usuarios;

-- 2. Permite que a requisição de login (feita por visitante/anon) consulte email e senha
CREATE POLICY "Permitir leitura para login"
ON public.usuarios FOR SELECT
TO anon, authenticated
USING (true);

-- 3. Permite novos cadastros na tabela
CREATE POLICY "Permitir cadastro de usuarios"
ON public.usuarios FOR INSERT
TO anon, authenticated
WITH CHECK (true);