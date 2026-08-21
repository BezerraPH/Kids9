const db = require('../config/database');
const messagingService = require('./messaging.service');

/**
 * Serviço que implementa as regras de negócio de Check-in e Check-out do Kids9.
 */
class CheckinService {
  /**
   * Registra a entrada de uma criança, calcula o tempo previsto de saída, gera o PIN e dispara a notificação WhatsApp.
   */
  async createCheckin({ childName, parentPhone, paymentMethod, paymentValue, playtimeMinutes, shopping }) {
    // Gerar PIN aleatório de 4 dígitos
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const playtime = parseInt(playtimeMinutes, 10);
    
    const checkinTime = new Date();
    const expectedCheckoutTime = new Date(checkinTime.getTime() + playtime * 60 * 1000);

    const queryText = `
      INSERT INTO checkins 
      (child_name, parent_phone, payment_method, payment_value, playtime_minutes, checkin_time, expected_checkout_time, pin, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
      RETURNING *;
    `;
    
    const values = [
      childName,
      parentPhone,
      paymentMethod,
      parseFloat(paymentValue),
      playtime,
      checkinTime,
      expectedCheckoutTime,
      pin
    ];

    const result = await db.query(queryText, values);
    const checkin = result.rows[0];

    // Enviar o alerta de PIN de forma assíncrona para não atrasar a resposta da API HTTP
    const shoppingName = shopping || 'Kids9 Park';
    messagingService.sendCheckinAlert(parentPhone, {
      childName,
      shopping: shoppingName,
      playtimeMinutes: playtime,
      pin: pin
    }).catch(err => {
      console.error(`[CHECKIN-SERVICE ERROR] Falha no envio assíncrono do PIN de check-in para ${parentPhone}:`, err.message);
    });

    return checkin;
  }

  /**
   * Realiza a saída da criança validando o PIN do responsável ou usando o PIN mestre do administrador.
   */
  async checkout(id, { pin, isAdminOverride, adminPin }) {
    // Buscar o registro correspondente
    const selectResult = await db.query('SELECT * FROM checkins WHERE id = $1;', [id]);
    
    if (selectResult.rowCount === 0) {
      throw new Error('Registro de check-in não encontrado.');
    }

    const checkin = selectResult.rows[0];

    if (checkin.status === 'completed') {
      throw new Error('Check-out já realizado anteriormente.');
    }

    // Se não for liberação do administrador, valida o PIN do WhatsApp
    if (!isAdminOverride) {
      if (!pin) {
        throw new Error('Código PIN é obrigatório para check-out.');
      }
      if (checkin.pin !== String(pin).trim()) {
        throw new Error('Código PIN inválido.');
      }
    } else {
      const config = require('../config/environment');
      if (adminPin !== config.adminPin) {
        throw new Error('PIN administrativo inválido.');
      }
      console.log(`[CHECKIN-SERVICE] Check-out com liberação de administrador para o ID ${id}`);
    }

    // Gravar o horário real do checkout e alterar status para concluído
    const updateQuery = `
      UPDATE checkins 
      SET status = 'completed', actual_checkout_time = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const updateResult = await db.query(updateQuery, [id]);
    return updateResult.rows[0];
  }

  /**
   * Retorna os registros ativos no painel com cálculo de tempo restante em minutos.
   */
  async getActiveCheckins() {
    const queryText = `
      SELECT *, 
        EXTRACT(EPOCH FROM (expected_checkout_time - NOW()))/60 as remaining_minutes
      FROM checkins 
      WHERE status = 'active'
      ORDER BY expected_checkout_time ASC;
    `;
    const result = await db.query(queryText);
    return result.rows;
  }

  /**
   * Busca um registro de check-in por ID.
   */
  async getCheckinById(id) {
    const result = await db.query('SELECT * FROM checkins WHERE id = $1;', [id]);
    return result.rows[0] || null;
  }

  /**
   * Retorna o histórico de todos os check-ins (últimos 100).
   */
  async getHistoryCheckins() {
    const queryText = `
      SELECT *,
        EXTRACT(EPOCH FROM (expected_checkout_time - NOW()))/60 as remaining_minutes
      FROM checkins 
      ORDER BY checkin_time DESC 
      LIMIT 100;
    `;
    const result = await db.query(queryText);
    return result.rows;
  }

  /**
   * Processa métricas financeiras e ocupação horária do dia atual.
   */
  async getDashboardStats() {
    // 1. Crianças ativas agora
    const activeResult = await db.query("SELECT COUNT(*) FROM checkins WHERE status = 'active';");
    const activeCount = parseInt(activeResult.rows[0].count, 10);

    // 2. Faturamento e ticket médio do dia atual
    const todayResult = await db.query(`
      SELECT 
        COALESCE(SUM(payment_value), 0) as total,
        COALESCE(AVG(payment_value), 0) as average,
        COUNT(*) as count
      FROM checkins 
      WHERE checkin_time >= CURRENT_DATE;
    `);
    const revenueToday = parseFloat(todayResult.rows[0].total);
    const avgTicket = parseFloat(todayResult.rows[0].average);
    const totalCount = parseInt(todayResult.rows[0].count, 10);

    // 3. Ocupação horária (check-ins por hora hoje)
    const hourlyResult = await db.query(`
      SELECT EXTRACT(HOUR FROM checkin_time) as hour, COUNT(*) as count
      FROM checkins
      WHERE checkin_time >= CURRENT_DATE
      GROUP BY hour
      ORDER BY hour;
    `);

    // Mapear resultado em 24h com fallback de 0
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    for (const r of hourlyResult.rows) {
      const h = parseInt(r.hour, 10);
      if (h >= 0 && h < 24) {
        hourlyData[h].count = parseInt(r.count, 10);
      }
    }

    return {
      activeCount,
      revenueToday,
      avgTicket: parseFloat(avgTicket.toFixed(2)),
      totalCount,
      hourlyData
    };
  }
}

module.exports = new CheckinService();
