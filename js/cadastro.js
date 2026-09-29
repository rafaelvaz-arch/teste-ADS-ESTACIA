// js/cadastro.js

document.getElementById('formCadastro').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nomeInput = document.getElementById('nome').value.trim();
  const emailInput = document.getElementById('email').value.trim();
  const senhaInput = document.getElementById('senha').value.trim();
  const btnCadastrar = document.getElementById('btnCadastrar');

  btnCadastrar.textContent = 'A cadastrar...';
  btnCadastrar.disabled = true;

  try {
    // 1. Verifica se já existe um utilizador registado com este e-mail
    const { data: usuarioExistente, error: selectError } = await supabase
      .from('usuarios')
      .select('email')
      .eq('email', emailInput)
      .maybeSingle();

    if (selectError) {
      console.error('Erro na verificação do e-mail:', selectError);
      alert('Erro ao verificar e-mail: ' + selectError.message);
      btnCadastrar.textContent = 'Criar Conta';
      btnCadastrar.disabled = false;
      return;
    }

    if (usuarioExistente) {
      alert('Este e-mail já está registado. Tente iniciar sessão.');
      btnCadastrar.textContent = 'Criar Conta';
      btnCadastrar.disabled = false;
      return;
    }

    // 2. Insere o novo utilizador na tabela 'usuarios'
    const { data, error: insertError } = await supabase
      .from('usuarios')
      .insert([
        {
          nome_completo: nomeInput,
          email: emailInput,
          senha_hash: senhaInput
        }
      ]);

    if (insertError) {
      console.error('Erro na inserção:', insertError);
      alert('Erro ao realizar o registo: ' + insertError.message);
      btnCadastrar.textContent = 'Criar Conta';
      btnCadastrar.disabled = false;
      return;
    }

    alert('Conta criada com sucesso!');
    window.location.href = 'index.html';

  } catch (err) {
    console.error('Erro no registo:', err);
    alert('Erro de ligação: ' + (err.message || err));
    btnCadastrar.textContent = 'Criar Conta';
    btnCadastrar.disabled = false;
  }
});