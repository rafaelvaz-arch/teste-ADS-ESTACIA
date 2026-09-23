CREATE OR REPLACE FUNCTION public.criar_perfil_novo_usuario()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfis (id, nome_completo, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome_completo', 'Usuário EstacIA'),
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_criar_perfil
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.criar_perfil_novo_usuario();

-- ROW LEVEL SECURITY - RLS
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_estacionamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

-- Permissões de Leitura e Edição do Próprio Perfil
CREATE POLICY "Acesso ao proprio perfil" ON perfis 
  FOR ALL USING (auth.uid() = id);

-- Permissão para visualizar apenas as suas sessões
CREATE POLICY "Acesso as proprias sessoes" ON sessoes_estacionamento 
  FOR SELECT USING (auth.uid() = usuario_id);