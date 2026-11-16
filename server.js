import express from 'express';
import dotenv from 'dotenv';
import pagamentosRouter from './routes/pagamentos.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Libera o acesso do frontend (Live Server / outros domínios) à API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Liga as rotas do Mercado Pago ao servidor
app.use('/api/v1/pagamentos', pagamentosRouter);
app.use('/api/v1', pagamentosRouter);

app.get('/', (req, res) => {
  res.json({ message: 'API ADS-ESTACIA a rodar com sucesso!' });
});

app.listen(PORT, () => {
  console.log(`Servidor a rodar em http://localhost:${PORT}`);
});