import { Router } from 'express';
import { getHistoricoEstadias, getReciboDigital } from '../controllers/estadiasController.js';

const router = Router();

// Endpoint de Histórico: GET /api/v1/estadias/historico
router.get('/historico', getHistoricoEstadias);

// Endpoint de Recibo: GET /api/v1/estadias/recibo
router.get('/recibo', getReciboDigital);

export default router;