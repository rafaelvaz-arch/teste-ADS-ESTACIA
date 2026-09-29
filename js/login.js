// js/login.js

document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();

  const emailInput = document.getElementById('email').value.trim();
  const senhaInput = document.getElementById('senha').value.trim();
  const btnEntrar = document.getElementById('btnEntrar');

  btnEntrar.textContent = 'Verificando...';
  btnEntrar.disabled = true;

  try {
    // Busca na tabela 'usuarios' se existe alguém com este e-mail e senha
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id_usuario, nome_completo, email')
      .eq('email', emailInput)
      .eq('senha_hash', senhaInput)
      .maybeSingle();

    if (error) {
      alert('Erro ao conectar ao banco de dados: ' + error.message);
      btnEntrar.textContent = 'Entrar';
      btnEntrar.disabled = false;
      return;
    }

    if (!usuario) {
      alert('E-mail ou senha incorretos.');
      btnEntrar.textContent = 'Entrar';
      btnEntrar.disabled = false;
      return;
    }

    // Salva a sessão do usuário logado no navegador
    localStorage.setItem('usuarioLogado', JSON.stringify(usuario));

    // Redireciona para a tela principal
    window.location.href = 'principal.html';

  } catch (err) {
    console.error('Erro no login:', err);
    alert('Ocorreu um erro ao tentar entrar. Verifique o console.');
    btnEntrar.textContent = 'Entrar';
    btnEntrar.disabled = false;
  }
});