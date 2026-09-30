// js/recuperar.js

document.getElementById('formRecuperar').addEventListener('submit', async (e) => {
  e.preventDefault();

  const emailInput = document.getElementById('email').value.trim();
  const btnEnviar = document.getElementById('btnEnviar');

  btnEnviar.textContent = 'Enviando...';
  btnEnviar.disabled = true;

  try {
    // 1. Consulta se o e-mail existe na tabela 'usuarios' do Supabase
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('email, nome_completo')
      .eq('email', emailInput)
      .maybeSingle();

    if (error) {
      alert('Erro ao consultar banco de dados: ' + error.message);
      btnEnviar.textContent = 'Enviar Instruções';
      btnEnviar.disabled = false;
      return;
    }

    if (!usuario) {
      alert('E-mail não encontrado no sistema. Verifique o endereço digitado ou crie uma conta.');
      btnEnviar.textContent = 'Enviar Instruções';
      btnEnviar.disabled = false;
      return;
    }

    
    // 2. Parâmetros enviados para o modelo do EmailJS
    const templateParams = {
      to_name: usuario.nome_completo || 'Usuário',
      to_email: emailInput,
      email: emailInput,
      // Removido o '/Front-end' para bater com a raiz do Live Server
      link_redefinicao: window.location.origin + '/Front-end/redefinir-senha.html?email=' + encodeURIComponent(emailInput)
    };

    // 3. Envio do e-mail real via EmailJS
    await emailjs.send('service_011j288', 'template_5fwp89a', templateParams);

    alert('Instruções para redefinição de senha foram enviadas para ' + emailInput + '!');
    window.location.href = 'index.html';

  } catch (err) {
    console.error('Erro na recuperação de senha:', err);
    const mensagemErro = err.text || err.message || JSON.stringify(err);
    alert('Erro ao enviar e-mail: ' + mensagemErro);
    btnEnviar.textContent = 'Enviar Instruções';
    btnEnviar.disabled = false;
  }
});