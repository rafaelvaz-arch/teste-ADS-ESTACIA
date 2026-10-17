import { Router } from 'express';
import { validarSaida } from '../controllers/saidaController.js';

const router = Router();

// Endpoint conforme especificado no RF08
router.post('/api/v1/saida/validar', validarSaida);

export default router;