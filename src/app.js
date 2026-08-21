/**
 * @file app.js
 * @description Configuração principal da aplicação Express do Kids9.
 * Registra os middlewares de parsing de requisição, pasta de arquivos estáticos (frontend),
 * rotas de API públicas/privadas de check-in e o middleware global de tratamento de erros.
 */

const express = require('express');
const checkinRoutes = require('./routes/checkin.routes');

const app = express();

// Middlewares globais para parsing e decodificação do corpo de requisições
app.use(express.json()); // Permite JSON no body (ex: requisições AJAX)
app.use(express.urlencoded({ extended: true })); // Permite URL-encoded no body (ex: submits de formulários padrão)

// Servir os arquivos estáticos da pasta 'public' (HTML, CSS, JS e imagens do painel cliente)
app.use(express.static('public'));

/**
 * Rota básica de monitoramento de integridade do servidor (Healthcheck).
 * Utilizado por sistemas de orquestração ou monitoramento externo para verificar uptime.
 * 
 * @name GET /health
 * @function
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

// Registrar todas as rotas da API de check-in/check-out no prefixo '/api/checkins'
app.use('/api/checkins', checkinRoutes);

/**
 * Middleware global e centralizado para tratamento de erros inesperados (crash recovery).
 * Evita que falhas não capturadas exponham detalhes técnicos (stack trace) ao usuário.
 */
app.use((err, req, res, next) => {
  console.error('[APP CRASH] Erro não capturado interceptado pelo middleware global:', err);
  res.status(500).json({ 
    error: 'Ocorreu um erro interno crítico no servidor.' 
  });
});

module.exports = app;

