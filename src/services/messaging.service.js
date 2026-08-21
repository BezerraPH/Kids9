/**
 * @file messaging.service.js
 * @description Serviço unificado de mensageria do Kids9.
 * Atua como uma fachada (Facade Pattern) simplificada sobre as classes provedoras de WhatsApp.
 * Centraliza as regras de negócio de templates e delega as chamadas de baixo nível para a 
 * estratégia ativa obtida através da fábrica.
 */

const WhatsAppFactory = require('../providers/whatsapp/whatsapp.factory');

class MessagingService {
  constructor() {
    /**
     * Instância do provedor de WhatsApp ativa obtida dinamicamente da Factory.
     * @type {import('../providers/whatsapp/whatsapp.provider')}
     */
    this.provider = WhatsAppFactory.getProvider();
  }

  /**
   * Inicializa o provedor de WhatsApp ativo.
   * Método executado de forma assíncrona no bootstrap do servidor Express.
   * 
   * @async
   * @returns {Promise<void>}
   */
  async init() {
    await this.provider.init();
  }

  /**
   * Envia a notificação de PIN de segurança após o registro de entrada (check-in) de uma criança.
   * O disparo do alerta é feito de forma assíncrona para não onerar o tempo de resposta da API REST.
   * 
   * @async
   * @param {string} to Número de telefone do responsável com DDD (ex: '81999999999').
   * @param {object} data Dados do check-in para formatação da mensagem.
   * @param {string} data.childName Nome completo da criança cadastrada.
   * @param {string} data.shopping Nome da filial/unidade (ex: 'Kids9 Park Shopping Recife').
   * @param {number} data.playtimeMinutes Quantidade de minutos contratados.
   * @param {string} data.pin Código PIN numérico de segurança para liberação.
   * @returns {Promise<any>} Resposta bruta de envio do provedor.
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
   * Envia o alerta de tempo expirando (quando restam apenas 5 minutos para o checkout previsto).
   * Disparado automaticamente pelo Cron Job de monitoramento.
   * 
   * @async
   * @param {string} to Número de telefone do responsável com DDD.
   * @param {object} data Dados do alerta de encerramento de tempo.
   * @param {string} data.childName Nome da criança.
   * @returns {Promise<any>} Resposta bruta de envio do provedor.
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

// Exporta uma única instância global do serviço de mensagens (Singleton)
module.exports = new MessagingService();

