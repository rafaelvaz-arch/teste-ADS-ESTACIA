import 'dotenv/config'; // OBRIGATÓRIO: Deve ser a primeira linha do ficheiro
import express from 'express';
import saidaRoutes from './routes/saidaRoutes.js';

const app = express();

app.use(express.json());
app.use(saidaRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` Servidor a rodar na porta ${PORT}`));