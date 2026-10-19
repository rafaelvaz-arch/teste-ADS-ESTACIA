import { Router } from 'express';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração do Mercado Pago SDK
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || ''
});
const payment = new Payment(mpClient);

// ROTA 1: Gerar QR Code Pix
router.post('/pix/gerar', async (req, res) => {
  try {
    const { id_estadia, valor, email, nome, apelido, cpf } = req.body;

    if (!valor || !id_estadia) {
      return res.status(400).json({ error: 'Faltam dados obrigatórios (id_estadia, valor).' });
    }

    const response = await payment.create({
      body: {
        transaction_amount: Number(valor),
        description: `Pagamento Estadia #${id_estadia} - ADS-ESTACIA`,
        payment_method_id: 'pix',
        payer: {
          email: email || 'cliente@estacia.com',
          first_name: nome || 'Cliente',
          last_name: apelido || 'Estacia',
          identification: { type: 'CPF', number: cpf || '05748832151' }
        },
        metadata: { id_estadia }
      }
    });

    // Marca como PENDENTE no Supabase
    await supabase
      .from('estadias')
      .update({ 
        status_pagamento: 'PENDENTE',
        metodo_pagamento: 'PIX',
        data_hora_pagamento: null
      })
      .eq('id_estadia', id_estadia);

    return res.status(201).json({
      message: 'Cobrança Pix gerada com sucesso!',
      pagamento_id: response.id,
      qr_code: response.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: response.point_of_interaction?.transaction_data?.qr_code_base64,
      status: response.status
    });
  } catch (error) {
    console.error('Erro ao gerar Pix:', error);
    return res.status(500).json({ error: 'Falha ao gerar cobrança Pix.', details: error.message });
  }
});

// ROTA 2: Confirmar Pagamento Manualmente (Para testes de PIX e acionamento no botão do Frontend)
router.post('/confirmar-manual', async (req, res) => {
  try {
    const { id_estadia, metodo_pagamento } = req.body;

    if (!id_estadia) {
      return res.status(400).json({ error: 'ID da estadia não fornecido.' });
    }

    const { error } = await supabase
      .from('estadias')
      .update({
        status_pagamento: 'PAGO',
        metodo_pagamento: metodo_pagamento || 'PIX',
        data_hora_pagamento: new Date().toISOString()
      })
      .eq('id_estadia', id_estadia);

    if (error) throw error;

    return res.status(200).json({ message: 'Estadia marcada como PAGO no Supabase com sucesso!' });
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error);
    return res.status(500).json({ error: 'Erro ao atualizar banco de dados.', details: error.message });
  }
});

// ROTA 3: Processar Cartão de Crédito (Modo Teste/Homologação)
router.post('/cartao/processar', async (req, res) => {
  try {
    const { id_estadia, valor } = req.body;

    if (!valor || !id_estadia) {
      return res.status(400).json({ error: 'Dados insuficientes para processar o cartão.' });
    }

    // Atualiza no Supabase usando 'CARTAO_CREDITO' para respeitar a constraint do banco
    const { error } = await supabase
      .from('estadias')
      .update({ 
        status_pagamento: 'PAGO', 
        metodo_pagamento: 'CARTAO_CREDITO',
        data_hora_pagamento: new Date().toISOString()
      })
      .eq('id_estadia', id_estadia);

    if (error) throw error;

    return res.status(200).json({
      message: 'Transação de cartão processada com sucesso.',
      status: 'approved'
    });
  } catch (error) {
    console.error('Erro ao processar cartão:', error);
    return res.status(500).json({ error: 'Falha ao processar cartão de crédito.', details: error.message });
  }
});

// ROTA 4: Webhook do Mercado Pago (Caso venha de produção/ngrok)
router.post('/webhooks/pagamento', async (req, res) => {
  try {
    const { type, data, action } = req.body;
    const paymentId = data?.id || req.query['data.id'] || req.query.id;

    if (paymentId && (type === 'payment' || action?.includes('payment'))) {
      const paymentInfo = await payment.get({ id: paymentId });

      if (paymentInfo.status === 'approved' && paymentInfo.metadata?.id_estadia) {
        await supabase
          .from('estadias')
          .update({ 
            status_pagamento: 'PAGO',
            data_hora_pagamento: new Date().toISOString()
          })
          .eq('id_estadia', paymentInfo.metadata.id_estadia);
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Erro no Webhook:', error);
    return res.status(500).send('Webhook Error');
  }
});

export default router;