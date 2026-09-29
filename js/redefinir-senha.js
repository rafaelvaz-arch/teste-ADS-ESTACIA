// js/redefinir-senha.js

document.getElementById('formRedefinir').addEventListener('submit', async (e) => {
  e.preventDefault();

  const novaSenha = document.getElementById('novaSenha').value;
  const confirmarSenha = document.getElementById('confirmarSenha').value;
  const btnSalvar = document.getElementById('btnSalvar');

  // 1. Validar se o cliente do Supabase foi carregado
  if (typeof supabase === 'undefined') {
    alert('Erro: O cliente do Supabase não foi carregado. Verifique o ficheiro js/supabaseClient.js');
    return;
  }

  // 2. Capturar o e-mail da URL (?email=exemplo@email.com)
  const urlParams = new URLSearchParams(window.location.search);
  let email = urlParams.get('email');

  if (!email) {
    alert('Erro: Nenhum e-mail foi encontrado no link. Solicite a redefinição novamente.');
    return;
  }

  email = email.trim().toLowerCase();

  if (novaSenha !== confirmarSenha) {
    alert('As senhas introduzidas não coincidem!');
    return;
  }

  btnSalvar.textContent = 'A guardar...';
  btnSalvar.disabled = true;

  try {
    console.log('Iniciando atualização para o e-mail:', email);

    // 3. Atualizar na coluna 'senha_hash'
    const { data, error } = await supabase
      .from('usuarios')
      .update({ senha_hash: novaSenha })
      .eq('email', email)
      .select();

    console.log('Resultado do Supabase - Data:', data);
    console.error('Resultado do Supabase - Error:', error);

    if (error) {
      alert('Erro do Supabase: ' + error.message);
      btnSalvar.textContent = 'Salvar Nova Senha';
      btnSalvar.disabled = false;
      return;
    }

    if (!data || data.length === 0) {
      alert(`Atenção: Não foi encontrado nenhum utilizador com o e-mail "${email}" ou o Supabase bloqueou a leitura (falta política SELECT no RLS).`);
      btnSalvar.textContent = 'Salvar Nova Senha';
      btnSalvar.disabled = false;
      return;
    }

    alert('Senha alterada com sucesso! Já pode fazer login.');
    window.location.href = 'index.html';

  } catch (err) {
    console.error('Erro de execução:', err);
    alert('Erro na aplicação: ' + (err.message || err));
    btnSalvar.textContent = 'Salvar Nova Senha';
    btnSalvar.disabled = false;
  }
});