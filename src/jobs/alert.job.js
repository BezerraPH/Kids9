/**
 * @file alert.job.js
 * @description Job agendado (Cron Job) que monitora o tempo limite de permanência de crianças.
 * Varre o banco de dados periodicamente para detectar crianças cujo tempo contratado está a menos
 * de 5 minutos do fim e envia um alerta sonoro/visual via WhatsApp ao responsável.
 */

const cron = require('node-cron');
const db = require('../config/database');
const messagingService = require('../services/messaging.service');

/**
 * Expressão Cron padrão: Roda a cada 1 minuto, no segundo zero.
 * @type {string}
 */
const cronExpression = '*/1 * * * *';

/**
 * Função principal do Job que consulta o banco de dados em busca de crianças
 * cujo tempo de permanência está se aproximando do fim (<= 5 minutos restantes).
 * Para cada correspondência localizada, dispara a notificação via WhatsApp.
 * 
 * @async
 * @function checkPlaytimeAlerts
 * @returns {Promise<void>}
 */
const checkPlaytimeAlerts = async () => {
  const startTime = Date.now();
  console.log('[CRON] Iniciando varredura automatizada de prazos de checkout...');

  try {
    // Selecionar registros ativos que:
    // 1. Estão com status 'active' (ainda não fizeram check-out)
    // 2. Não receberam a notificação de fim de tempo ('alert_sent' é falso)
    // 3. Têm menos de 3 tentativas de alerta falhos (para não travar a fila com números inválidos)
    // 4. O horário previsto de saída ('expected_checkout_time') ocorre em no máximo 5 minutos a partir de agora
    const queryText = `
      SELECT id, child_name, parent_phone, expected_checkout_time 
      FROM checkins 
      WHERE status = 'active' 
        AND alert_sent = FALSE 
        AND alert_attempts < 3
        AND expected_checkout_time <= NOW() + INTERVAL '5 minutes';
    `;

    const result = await db.query(queryText);

    if (result.rowCount === 0) {
      return;
    }

    console.log(`[CRON] Varredura localizou ${result.rowCount} registro(s) exigindo notificação de tempo exposto.`);

    for (const record of result.rows) {
      const { id, child_name, parent_phone } = record;
      
      try {
        // Disparar o envio do alerta de 5 minutos restantes via serviço unificado de mensageria
        await messagingService.sendFiveMinAlert(parent_phone, { childName: child_name });

        // Marcar como enviado com sucesso e incrementar tentativa no banco de dados
        await db.query('UPDATE checkins SET alert_sent = TRUE, alert_attempts = alert_attempts + 1 WHERE id = $1;', [id]);
        console.log(`[CRON] Alerta disparado e registrado com sucesso para o ID ${id} (Telefone: ${parent_phone}).`);
      } catch (error) {
        console.error(`[CRON ERROR] Falha ao enviar alerta para o ID ${id} (Telefone: ${parent_phone}):`, error.message);
        
        // Incrementar o número de tentativas mesmo em caso de falha.
        // Isso evita loops contínuos de erro caso o número seja inválido ou esteja sem WhatsApp ativo.
        await db.query('UPDATE checkins SET alert_attempts = alert_attempts + 1 WHERE id = $1;', [id]);
      }
    }
  } catch (error) {
    console.error('[CRON ERROR] Falha geral durante execução da query de varredura no banco:', error.message);
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[CRON] Varredura finalizada. Tempo total de processamento: ${duration}ms`);
  }
};

/**
 * Instância da tarefa agendada do cron. Criada desativada por padrão.
 * O ciclo é inicializado explicitamente pelo bootstrap do servidor.
 */
const task = cron.schedule(cronExpression, checkPlaytimeAlerts, {
  scheduled: false
});

module.exports = {
  /**
   * Inicia o agendador de tarefas automatizado.
   * Também executa uma varredura imediatamente na inicialização (bootstrap) para cobrir
   * possíveis desligamentos repentinos do servidor HTTP com alertas pendentes.
   */
  start: () => {
    task.start();
    console.log(`[CRON] Agendador de tarefas ativado com frequência de 1 minuto.`);
    
    // Execução síncrona inicial de segurança no bootstrap
    checkPlaytimeAlerts();
  },
  
  /**
   * Para a execução da tarefa agendada.
   * Invocado graciosamente no encerramento do servidor (graceful shutdown).
   */
  stop: () => {
    task.stop();
    console.log('[CRON] Agendador de tarefas desativado com sucesso.');
  },
  
  checkPlaytimeAlerts
};
