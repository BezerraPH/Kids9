const fs = require('fs');
const path = require('path');
const config = require('./config/environment');
const db = require('./config/database');
const messagingService = require('./services/messaging.service');
const alertJob = require('./jobs/alert.job');
const app = require('./app');

/**
 * Função de inicialização geral da aplicação Kids9.
 */
async function bootstrap() {
  try {
    console.log('==================================================');
    console.log('         INICIANDO KIDS9 BACKEND SYSTEM           ');
    console.log('==================================================\n');

    // 1. Validar conexão com banco de dados
    console.log('[BOOTSTRAP] Estabelecendo conexão com o PostgreSQL...');
    await db.pool.query('SELECT NOW()');
    console.log('[BOOTSTRAP] Conexão com o banco de dados OK!');

    // 2. Executar inicialização de tabelas automática se init.sql estiver disponível
    const sqlPath = path.join(__dirname, 'database', 'init.sql');
    if (fs.existsSync(sqlPath)) {
      console.log('[BOOTSTRAP] Executando/Verificando tabelas no banco de dados...');
      const initSql = fs.readFileSync(sqlPath, 'utf8');
      await db.pool.query(initSql);
      console.log('[BOOTSTRAP] Estrutura de tabelas verificada com sucesso!');
    } else {
      console.warn('[BOOTSTRAP WARNING] Script init.sql não localizado em src/database/init.sql.');
    }

    // 3. Inicializar Provedor do WhatsApp em segundo plano (evita travar o startup do servidor HTTP)
    console.log('[BOOTSTRAP] Inicializando cliente WhatsApp em segundo plano...');
    messagingService.init().catch(err => {
      console.error('[BOOTSTRAP ERROR] Falha ao inicializar o provedor do WhatsApp:', err.message);
    });

    // 4. Iniciar Cron Jobs de monitoramento
    console.log('[BOOTSTRAP] Iniciando Job de alertas em segundo plano...');
    alertJob.start();

    // 5. Iniciar Servidor HTTP Express
    app.listen(config.port, () => {
      console.log(`\n[BOOTSTRAP] Servidor executando na porta ${config.port}`);
      console.log(`[BOOTSTRAP] Ambiente: ${config.nodeEnv}`);
      console.log(`[BOOTSTRAP] Provedor de Mensagens ativo: ${config.whatsapp.provider.toUpperCase()}`);
      console.log('\n==================================================');
      console.log('            KIDS9 PRONTO PARA OPERAÇÃO            ');
      console.log('==================================================\n');
    });
  } catch (error) {
    console.error('\n[BOOTSTRAP ERROR] Falha grave ao inicializar a aplicação:', error);
    process.exit(1);
  }
}

// Tratar encerramento gracioso
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  console.log('\n[SHUTDOWN] Desligando servidor Kids9 graciosamente...');
  
  // Parar cron job
  alertJob.stop();

  // Fechar pool do banco
  try {
    await db.pool.end();
    console.log('[SHUTDOWN] Pool do PostgreSQL encerrado.');
  } catch (err) {
    console.error('[SHUTDOWN ERROR] Falha ao fechar pool do PostgreSQL:', err.message);
  }

  process.exit(0);
}

// Iniciar bootstrap
bootstrap();
