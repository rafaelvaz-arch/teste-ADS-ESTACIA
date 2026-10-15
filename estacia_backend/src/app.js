import express from 'express';
import saidaRoutes from './routes/saidaRoutes.js';

const app = express();

// OBRIGATÓRIO: Permitir que o Express leia JSON no corpo (body) das requisições
app.use(express.json());

// Registrar as rotas de saída
app.use(saidaRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));