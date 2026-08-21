/**
 * @file checkin.service.js
 * @description Camada de Serviço que implementa as regras de negócio para Check-in e Check-out do Kids9.
 * Gerencia cálculos de tempo contratado, geração de códigos PIN, liberação de segurança (com ou sem
 * bypass administrativo) e consultas de relatórios financeiros e de ocupação para o dashboard.
 */

const db = require('../config/database');
const messagingService = require('./messaging.service');

class CheckinService {
  /**
   * Registra a entrada de uma criança no espaço de lazer.
   * Calcula o tempo esperado de saída, gera um código PIN numérico aleatório de 4 dígitos
   * e agenda o disparo assíncrono do alerta via WhatsApp para o telefone do responsável.
   * 
   * @async
   * @param {object} params Parâmetros de entrada do check-in
   * @param {string} params.childName Nome completo da criança
   * @param {string} params.parentPhone Telefone do responsável (com DDD)
   * @param {string} params.paymentMethod Método de pagamento (Pix, Crédito, etc.)
   * @param {number|string} params.paymentValue Valor total cobrado
   * @param {number|string} params.playtimeMinutes Tempo de recreação contratado (em minutos)
   * @param {string} [params.shopping] Nome da filial (padrão: 'Kids9 Park')
   * @returns {Promise<object>} O registro de check-in criado e persistido no banco de dados
   */
  async createCheckin({ childName, parentPhone, paymentMethod, paymentValue, playtimeMinutes, shopping }) {
    // Gerar PIN aleatório de 4 dígitos (ex: '2938')
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const playtime = parseInt(playtimeMinutes, 10);
    
    // Calcular horário de entrada e de saída estimada com base no tempo contratado
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

    // Enviar o alerta de PIN de forma totalmente assíncrona (não-bloqueante).
    // Evita que atrasos na API do WhatsApp aumentem a latência da requisição HTTP do operador.
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
   * Realiza a saída (check-out) de uma criança.
   * Valida se a criança está ativa e se o PIN fornecido coincide com o enviado via WhatsApp.
   * Suporta bypass (liberação administrativa) caso o PIN mestre de administrador seja informado.
   * 
   * @async
   * @param {number|string} id ID do registro de check-in
   * @param {object} options Opções de validação de checkout
   * @param {string} [options.pin] Código PIN informado pelo responsável
   * @param {boolean} [options.isAdminOverride] Define se é uma liberação administrativa forcada
   * @param {string} [options.adminPin] PIN do administrador (obrigatório se isAdminOverride for true)
   * @returns {Promise<object>} O registro de check-in atualizado com status 'completed'
   * @throws {Error} Se o registro não for encontrado, se já estiver finalizado ou se o PIN for inválido
   */
  async checkout(id, { pin, isAdminOverride, adminPin }) {
    // 1. Buscar o registro correspondente no banco de dados
    const selectResult = await db.query('SELECT * FROM checkins WHERE id = $1;', [id]);
    
    if (selectResult.rowCount === 0) {
      throw new Error('Registro de check-in não encontrado.');
    }

    const checkin = selectResult.rows[0];

    // 2. Validar se o status do registro já não foi concluído
    if (checkin.status === 'completed') {
      throw new Error('Check-out já realizado anteriormente para esta entrada.');
    }

    // 3. Efetuar validação de liberação por PIN ou Override do Administrador
    if (!isAdminOverride) {
      if (!pin) {
        throw new Error('Código PIN é obrigatório para check-out.');
      }
      if (checkin.pin !== String(pin).trim()) {
        throw new Error('Código PIN inválido.');
      }
    } else {
      // Carregar dinamicamente o config para validar o PIN admin atual
      const config = require('../config/environment');
      if (adminPin !== config.adminPin) {
        throw new Error('PIN de liberação administrativa inválido.');
      }
      console.log(`[CHECKIN-SERVICE] Check-out realizado por liberação administrativa (Bypass) para o ID ${id}`);
    }

    // 4. Gravar o horário real do checkout e alterar o status para concluído
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
   * Recupera a lista de todos os check-ins ativos (crianças que estão brincando no momento).
   * Calcula dinamicamente o tempo restante em minutos (positivo ou negativo se ultrapassado).
   * 
   * @async
   * @returns {Promise<object[]>} Lista de check-ins ativos ordenados por prazo de saída crescente
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
   * Busca os detalhes de um único registro de check-in pelo ID.
   * 
   * @async
   * @param {number|string} id ID do registro
   * @returns {Promise<object|null>} Detalhes do check-in ou null se não localizado
   */
  async getCheckinById(id) {
    const result = await db.query('SELECT * FROM checkins WHERE id = $1;', [id]);
    return result.rows[0] || null;
  }

  /**
   * Retorna o histórico recente de check-ins (limitado aos últimos 100 registros).
   * 
   * @async
   * @returns {Promise<object[]>} Histórico de check-ins ordenados decrescentemente por hora de entrada
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
   * Processa e calcula métricas financeiras acumuladas e a ocupação horária do dia atual.
   * Utilizado para alimentar os painéis gráficos e cartões de KPI do painel do Administrador.
   * 
   * @async
   * @returns {Promise<object>} Objeto contendo contagem ativa, faturamento de hoje, ticket médio e gráfico de 24h
   */
  async getDashboardStats() {
    // 1. Obter quantidade de crianças ativas brincando agora
    const activeResult = await db.query("SELECT COUNT(*) FROM checkins WHERE status = 'active';");
    const activeCount = parseInt(activeResult.rows[0].count, 10);

    // 2. Obter faturamento consolidado, média financeira (ticket médio) e volume total do dia de hoje
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

    // 3. Obter dados de ocupação por hora (agrupamento por hora do checkin no dia de hoje)
    const hourlyResult = await db.query(`
      SELECT EXTRACT(HOUR FROM checkin_time) as hour, COUNT(*) as count
      FROM checkins
      WHERE checkin_time >= CURRENT_DATE
      GROUP BY hour
      ORDER BY hour;
    `);

    // Inicializar vetor de 24 posições com contador zerado para renderização segura do gráfico no front
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
