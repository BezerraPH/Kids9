const cron = require('node-cron');
const db = require('../config/database');
const messagingService = require('../services/messaging.service');

// Expressão cron: roda a cada 1 minuto
const cronExpression = '*/1 * * * *';

/**
 * Função principal do Job que verifica se há clientes a 5 minutos do check-out.
 */
const checkPlaytimeAlerts = async () => {
  const startTime = Date.now();
  console.log('[CRON] Iniciando varredura de prazos de checkout...');

  try {
    // Query para selecionar contatos ativos cujo horário previsto de saída seja igual ou menor a
    // 5 minutos do momento atual e que ainda não tenham recebido o alerta.
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

    console.log(`[CRON] Encontrado(s) ${result.rowCount} registro(s) que precisam de notificação de tempo.`);

    for (const record of result.rows) {
      const { id, child_name, parent_phone } = record;
      
      try {
        // Disparar o envio via WhatsApp (usa a estratégia ativa sob o capô)
        await messagingService.sendFiveMinAlert(parent_phone, { childName: child_name });

        // Marcar como enviado no banco de dados
        await db.query('UPDATE checkins SET alert_sent = TRUE, alert_attempts = alert_attempts + 1 WHERE id = $1;', [id]);
        console.log(`[CRON] Alerta enviado e registrado para o ID ${id} (Telefone: ${parent_phone}).`);
      } catch (error) {
        console.error(`[CRON ERROR] Falha ao processar alerta para o ID ${id} (Telefone: ${parent_phone}):`, error.message);
        // Incrementar tentativas para que não fique em loop infinito caso o número seja inválido
        await db.query('UPDATE checkins SET alert_attempts = alert_attempts + 1 WHERE id = $1;', [id]);
      }
    }
  } catch (error) {
    console.error('[CRON ERROR] Erro na execução da varredura de banco de dados:', error.message);
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[CRON] Varredura finalizada. Tempo de processamento: ${duration}ms`);
  }
};

// Criar a agenda sem iniciá-la automaticamente
const task = cron.schedule(cronExpression, checkPlaytimeAlerts, {
  scheduled: false
});

module.exports = {
  start: () => {
    task.start();
    console.log(`[CRON] Agendador de tarefas ativo. Frequência: Roda a cada minuto.`);
    
    // Executa uma varredura inicial no bootstrap caso o servidor tenha reiniciado com tarefas pendentes
    checkPlaytimeAlerts();
  },
  stop: () => {
    task.stop();
    console.log('[CRON] Agendador de tarefas parado.');
  },
  checkPlaytimeAlerts
};
