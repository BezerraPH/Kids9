const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkin.controller');

const config = require('../config/environment');

// Middleware de Autenticação Administrativa
const adminAuth = (req, res, next) => {
  const adminPin = req.headers['x-admin-pin'];
  if (!adminPin || adminPin !== config.adminPin) {
    return res.status(403).json({ error: 'Acesso negado. PIN Administrativo inválido ou ausente.' });
  }
  next();
};

// Rota para registrar uma nova entrada (Check-in)
router.post('/', checkinController.create.bind(checkinController));

// Rota para listar todos os check-ins ativos (Painel / Painel Público)
router.get('/active', checkinController.listActive.bind(checkinController));

// Rota para obter o histórico de check-ins (Protegida)
router.get('/history', adminAuth, checkinController.getHistory.bind(checkinController));

// Rota para obter estatísticas do dashboard (Protegida)
router.get('/stats', adminAuth, checkinController.getStats.bind(checkinController));

// Rota para buscar detalhes de um check-in específico
router.get('/:id', checkinController.getById.bind(checkinController));

// Rota para registrar uma saída (Check-out) enviando o PIN
router.post('/:id/checkout', checkinController.checkout.bind(checkinController));

module.exports = router;
