const WhatsAppFactory = require('../providers/whatsapp/whatsapp.factory');

/**
 * Serviço unificado de Mensagens do Kids9.
 * Orquestra o envio das notificações chamando o Provedor ativo definido via Strategy Pattern.
 */
class MessagingService {
  constructor() {
    // Obtém o provedor configurado no .env
    this.provider = WhatsAppFactory.getProvider();
  }

  /**
   * Inicializa o provedor de mensagens ativo.
   */
  async init() {
    await this.provider.init();
  }

  /**
   * Envia o PIN de check-in de segurança para o telefone do responsável.
   * @param {string} to Número do responsável
   * @param {object} data Dados do check-in
   * @param {string} data.childName Nome da criança
   * @param {string} data.shopping Nome do Shopping
   * @param {number} data.playtimeMinutes Tempo contratado em minutos
   * @param {string} data.pin PIN gerado para segurança
   */
  async sendCheckinAlert(to, { childName, shopping, playtimeMinutes, pin }) {
    console.log(`[MESSAGING] Disparando alerta de Check-in (PIN) para o número: ${to} (Criança: ${childName})`);
    return await this.provider.sendTemplate(
      to,
      'template_checkin_shopping',
      [childName, shopping, playtimeMinutes, pin]
    );
  }

  /**
   * Envia a notificação de tempo esgotando (5 minutos restantes).
   * @param {string} to Número do responsável
   * @param {object} data Dados do alerta
   * @param {string} data.childName Nome da criança
   */
  async sendFiveMinAlert(to, { childName }) {
    console.log(`[MESSAGING] Disparando alerta de 5 minutos restantes para o número: ${to} (Criança: ${childName})`);
    return await this.provider.sendTemplate(
      to,
      'template_five_min_alert',
      [childName]
    );
  }
}

// Exportar uma única instância para reuso em toda a aplicação (Singleton)
module.exports = new MessagingService();
