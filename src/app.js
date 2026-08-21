const express = require('express');
const checkinRoutes = require('./routes/checkin.routes');

const app = express();

// Middlewares globais para parsing de requisições
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta 'public'
app.use(express.static('public'));

// Rota básica de monitoramento (healthcheck)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

// Registrar rotas de check-in / check-out
app.use('/api/checkins', checkinRoutes);

// Middleware global de tratamento de erros
app.use((err, req, res, next) => {
  console.error('[APP CRASH] Erro não tratado capturado:', err);
  res.status(500).json({ 
    error: 'Ocorreu um erro interno crítico no servidor.' 
  });
});

module.exports = app;
