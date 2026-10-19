import { supabase } from '../config/supabaseClient.js';

export async function validarSaida(req, res) {
  const { id_estadia } = req.body;

  // 1. Validação simples do corpo da requisição
  if (!id_estadia) {
    return res.status(400).json({ 
      sucesso: false, 
      erro: 'O campo id_estadia é obrigatório.' 
    });
  }

  try {
    // 2. Chama a Stored Procedure criada no Postgres
    const { data: resultado, error } = await supabase.rpc('fn_validar_janela_saida', {
      p_id_estadia: id_estadia
    });

    if (error) {
      console.error('Erro na RPC Supabase:', error);
      return res.status(500).json({ sucesso: false, erro: 'Erro no banco de dados ao validar saída.' });
    }

    // 3. Trata os retornos com base no resultado da Procedure
    
    // CASO A: Saída Liberada (<= 20 min)
    if (resultado.liberado) {
      return res.status(200).json({
        liberado: true,
        mensagem: resultado.mensagem,
        minutos_decorridos: resultado.minutos_decorridos
      });
    }

    // CASO B: Tempo Excedido (> 20 min)
    if (resultado.motivo === 'JANELA_EXCEDIDA') {
      return res.status(402).json({
        liberado: false,
        motivo: 'JANELA_EXCEDIDA',
        mensagem: 'Janela de 20 minutos excedida. Pagamento complementar necessário.',
        minutos_decorridos: resultado.minutos_decorridos,
        minutos_excedidos: resultado.minutos_excedidos,
        valor_excedente: resultado.valor_excedente
      });
    }

    // CASO C: Pagamento Pendente ou Outro Motivo
    return res.status(400).json({
      liberado: false,
      motivo: resultado.motivo,
      mensagem: resultado.mensagem
    });

  } catch (err) {
    console.error('Erro interno:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno no servidor.' });
  }
}