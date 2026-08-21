/**
 * @file server.js
 * @description Ponto de entrada (Bootstrap) da aplicação Kids9 Backend.
 * Inicializa a conexão com o banco de dados, executa scripts de migração automática do esquema SQL,
 * inicia o cliente de envio de mensagens do WhatsApp em segundo plano, ativa os jobs agendados (cron)
 * e inicia o servidor HTTP do Express.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config/environment');
const db = require('./config/database');
const messagingService = require('./services/messaging.service');
const alertJob = require('./jobs/alert.job');
const app = require('./app');

/**
 * Inicialização e orquestração geral de startup da aplicação Kids9.
 * Conecta ao banco de dados, inicializa tabelas, ativa o provedor de WhatsApp de forma assíncrona,
 * inicializa o cron job de monitoramento e inicia o servidor HTTP.
 * 
 * @async
 * @function bootstrap
 * @returns {Promise<void>}
 */
async function bootstrap() {
  try {
    console.log('==================================================');
    console.log('         INICIANDO KIDS9 BACKEND SYSTEM           ');
    console.log('==================================================\n');

    // 1. Validar conexão inicial com o banco de dados PostgreSQL
    console.log('[BOOTSTRAP] Estabelecendo conexão com o PostgreSQL...');
    await db.pool.query('SELECT NOW()');
    console.log('[BOOTSTRAP] Conexão com o banco de dados OK!');

    // 2. Executar inicialização automática do esquema SQL caso init.sql esteja disponível
    const sqlPath = path.join(__dirname, 'database', 'init.sql');
    if (fs.existsSync(sqlPath)) {
      console.log('[BOOTSTRAP] Executando/Verificando tabelas no banco de dados...');
      const initSql = fs.readFileSync(sqlPath, 'utf8');
      await db.pool.query(initSql);
      console.log('[BOOTSTRAP] Estrutura de tabelas verificada com sucesso!');
    } else {
      console.warn('[BOOTSTRAP WARNING] Script init.sql não localizado em src/database/init.sql.');
    }

    // 3. Inicializar Provedor do WhatsApp em segundo plano.
    // Desta forma, o startup da aplicação HTTP não é bloqueado por latências na conexão
    // com o servidor WAHA ou com a API da Meta Cloud.
    console.log('[BOOTSTRAP] Inicializando cliente WhatsApp em segundo plano...');
    messagingService.init().catch(err => {
      console.error('[BOOTSTRAP ERROR] Falha ao inicializar o provedor do WhatsApp:', err.message);
    });

    // 4. Iniciar Cron Jobs de monitoramento e envio automático de alertas de tempo esgotando
    console.log('[BOOTSTRAP] Iniciando Job de alertas em segundo plano...');
    alertJob.start();

    // 5. Iniciar o Servidor HTTP Express
    app.listen(config.port, () => {
      console.log(`\n[BOOTSTRAP] Servidor executando na porta ${config.port}`);
      console.log(`[BOOTSTRAP] Ambiente: ${config.nodeEnv}`);
      console.log(`[BOOTSTRAP] Provedor de Mensagens ativo: ${config.whatsapp.provider.toUpperCase()}`);
      console.log('\n==================================================');
      console.log('            KIDS9 PRONTO PARA OPERAÇÃO            ');
      console.log('==================================================\n');
    });
  } catch (error) {
    console.error('\n[BOOTSTRAP ERROR] Falha grave e irrecuperável ao inicializar a aplicação:', error);
    process.exit(1);
  }
}

// Ouvir sinais do sistema operacional para encerramento limpo (Graceful Shutdown)
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

/**
 * Encerra graciosamente todos os serviços ativos (Cron Jobs, conexões com banco de dados)
 * antes de fechar o processo do Node.js.
 * 
 * @async
 * @function gracefulShutdown
 * @returns {Promise<void>}
 */
async function gracefulShutdown() {
  console.log('\n[SHUTDOWN] Desligando servidor Kids9 graciosamente...');
  
  // Parar cron job de verificação de alertas
  alertJob.stop();

  // Fechar o pool de conexões do banco de dados PostgreSQL
  try {
    await db.pool.end();
    console.log('[SHUTDOWN] Pool do PostgreSQL encerrado.');
  } catch (err) {
    console.error('[SHUTDOWN ERROR] Falha ao fechar pool do PostgreSQL:', err.message);
  }

  process.exit(0);
}

// Iniciar bootstrap geral do sistema
bootstrap();

