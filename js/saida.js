async function validarSaidaCancela(idEstadia) {
  const resposta = await fetch('http://localhost:3000/api/v1/saida/validar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_estadia: idEstadia })
  });

  const dados = await resposta.json();

  if (dados.liberado) {
    alert('Cancela liberada! ' + dados.mensagem);
    // Envia sinal via MQTT/HTTP para a barra física da cancela subir
  } else if (dados.motivo === 'JANELA_EXCEDIDA') {
    alert(`Tempo excedido! Valor a pagar: R$ ${dados.valor_excedente.toFixed(2)}`);
    // Redireciona para a tela de pagamento do valor excedente (Pix QR Code)
  } else {
    alert('Atenção: ' + dados.mensagem);
  }
}