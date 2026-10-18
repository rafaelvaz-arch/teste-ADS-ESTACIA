import 'dotenv/config'; // OBRIGATÓRIO: Deve ser a primeira linha do ficheiro
import express from 'express';
import saidaRoutes from './routes/saidaRoutes.js';
import estadiasRoutes from './routes/estadiasRoutes.js'; // 1. IMPORTAÇÃO DA NOVA ROTA

const app = express();

app.use(express.json());

// Rotas existentes
app.use(saidaRoutes);

// 2. NOVO REGISTRO: Rotas do Histórico e Recibo Digital (RF09)
app.use('/api/v1/estadias', estadiasRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` Servidor a rodar na porta ${PORT}`));