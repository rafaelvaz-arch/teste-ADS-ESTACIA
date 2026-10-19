import { supabase } from '../config/supabaseClient.js';
import { gerarPDFRecibo } from '../services/pdfService.js';

/**
 * RF09 - Buscar Histórico de Estadias do Usuário Logado
 * Rota: GET /api/v1/estadias/historico
 */
export const getHistoricoEstadias = async (req, res) => {
  try {
    const idUsuario = req.user?.id_usuario || req.query.id_usuario;

    if (!idUsuario) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'ID do usuário não fornecido.'
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    const { data: historico, count, error } = await supabase
      .from('vw_historico_estadias')
      .select('*', { count: 'exact' })
      .eq('id_usuario', idUsuario)
      .order('data_hora_pagamento', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return res.status(200).json({
      sucesso: true,
      dados: historico,
      paginacao: {
        pagina_atual: page,
        itens_por_pagina: limit,
        total_registros: count,
        total_paginas: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno ao buscar histórico de estadias.',
      erro: error.message
    });
  }
};

/**
 * RF09 - Gerar Recibo Digital (JSON ou PDF)
 * Rota: GET /api/v1/estadias/recibo
 */
export const getReciboDigital = async (req, res) => {
  try {
    const idUsuario = req.user?.id_usuario || req.query.id_usuario;
    const idEstadia = req.query.id_estadia;

    if (!idEstadia || !idUsuario) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'ID da estadia e ID do usuário são obrigatórios.'
      });
    }

    const { data: estadia, error } = await supabase
      .from('vw_historico_estadias')
      .select('*')
      .eq('id_estadia', idEstadia)
      .eq('id_usuario', idUsuario)
      .single();

    if (error || !estadia) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Comprovante não encontrado ou não pertence a este usuário.'
      });
    }

    const reciboFormatado = {
      comprovante_nro: `EST-${estadia.id_estadia}-${new Date(estadia.data_hora_pagamento).getTime()}`,
      estadia: {
        id: estadia.id_estadia,
        veiculo: estadia.placa_veiculo,
        tipo_identificacao: estadia.tipo_identificacao
      },
      localizacao: {
        shopping: estadia.nome_shopping,
        piso: estadia.nivel_piso,
        setor: estadia.nome_setor,
        vaga: estadia.codigo_vaga,
        cidade_uf: `${estadia.cidade}/${estadia.uf}`
      },
      periodo: {
        entrada: estadia.data_hora_entrada,
        saida: estadia.data_hora_saida,
        pagamento: estadia.data_hora_pagamento
      },
      valores: {
        valor_base: estadia.valor_total || 0,
        valor_excedente: estadia.valor_excedente || 0,
        valor_total_pago: estadia.valor_final_pago,
        metodo_pagamento: estadia.metodo_pagamento
      }
    };

    // AQUI É O PASSO 2: Caso o parâmetro format=pdf seja informado, envia o Stream do PDF
    if (req.query.format === 'pdf') {
      const pdfDoc = gerarPDFRecibo(reciboFormatado);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="recibo.pdf"');
      pdfDoc.pipe(res);
      pdfDoc.end();
      return;
    }

    // Caso contrário, retorna em formato JSON
    return res.status(200).json({
      sucesso: true,
      recibo: reciboFormatado
    });
  } catch (error) {
    console.error('Erro ao gerar recibo:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao gerar recibo digital.',
      erro: error.message
    });
  }
};