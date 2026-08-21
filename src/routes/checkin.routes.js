/**
 * @file checkin.routes.js
 * @description Definições de rotas HTTP do Express para as operações da API do Kids9.
 * Inclui o middleware de autenticação administrativa e vincula as rotas aos métodos correspondentes
 * do CheckinController.
 */

const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkin.controller');
const config = require('../config/environment');

/**
 * Middleware de Autenticação Administrativa.
 * Valida a presença e o valor correto do PIN administrativo enviado através do cabeçalho HTTP personalizado 'x-admin-pin'.
 * Caso o PIN seja incorreto ou ausente, bloqueia a requisição retornando status 403 (Forbidden).
 * 
 * @param {import('express').Request} req Requisição HTTP Express
 * @param {import('express').Response} res Resposta HTTP Express
 * @param {import('express').NextFunction} next Função callback para passar a execução ao próximo middleware/rota
 * @returns {void|import('express').Response} Retorna erro 403 se falhar
 */
const adminAuth = (req, res, next) => {
  const adminPin = req.headers['x-admin-pin'];
  if (!adminPin || adminPin !== config.adminPin) {
    return res.status(403).json({ error: 'Acesso negado. PIN Administrativo inválido ou ausente.' });
  }
  next();
};

// ----------------------------------------------------------------------------
// ROTAS PÚBLICAS / OPERACIONAIS (Sem necessidade de autenticação por cabeçalho)
// ----------------------------------------------------------------------------

/**
 * Rota para registrar uma nova entrada de criança (Check-in).
 * @name POST /
 */
router.post('/', checkinController.create.bind(checkinController));

/**
 * Rota para listar todos os check-ins ativos (exibição no painel do operador e na TV).
 * @name GET /active
 */
router.get('/active', checkinController.listActive.bind(checkinController));

/**
 * Rota para buscar os detalhes individuais de um check-in específico pelo ID.
 * @name GET /:id
 */
router.get('/:id', checkinController.getById.bind(checkinController));

/**
 * Rota para registrar a saída de uma criança (Check-out) informando o código PIN.
 * @name POST /:id/checkout
 */
router.post('/:id/checkout', checkinController.checkout.bind(checkinController));

// ----------------------------------------------------------------------------
// ROTAS ADMINISTRATIVAS PROTEGIDAS (Exigem cabeçalho 'x-admin-pin')
// ----------------------------------------------------------------------------

/**
 * Rota para obter o histórico geral recente de check-ins (últimos 100).
 * Protegida por PIN administrativo.
 * @name GET /history
 */
router.get('/history', adminAuth, checkinController.getHistory.bind(checkinController));

/**
 * Rota para obter consolidados estatísticos e ocupação horária do dia atual.
 * Protegida por PIN administrativo.
 * @name GET /stats
 */
router.get('/stats', adminAuth, checkinController.getStats.bind(checkinController));

module.exports = router;
