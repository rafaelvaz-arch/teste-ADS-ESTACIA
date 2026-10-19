// js/pagamento.js - Integração do Ecrã com o Backend Node.js

const API_URL = 'http://localhost:3000/api/v1/pagamentos';

/**
 * Função para chamar o backend e gerar o código Pix
 */
async function gerarPagamentoPix(idEstadia, valorTotal, emailCliente) {
  try {
    const response = await fetch(`${API_URL}/pix/gerar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id_estadia: idEstadia,
        valor: valorTotal,
        email: emailCliente
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao gerar Pix');
    }

    return data;
  } catch (error) {
    console.error('Erro na integração do Pix:', error);
    alert('Não foi possível gerar o código Pix.');
  }
}