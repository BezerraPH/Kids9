/**
 * @file whatsapp.provider.js
 * @description Classe base abstrata que define o contrato para os provedores de WhatsApp (Strategy Pattern).
 * Força que qualquer provedor de envio de mensagens implemente a mesma interface pública,
 * garantindo que a troca entre soluções gratuitas (WAHA) e oficiais (Meta) ocorra de forma transparente.
 */
class WhatsAppProvider {
  constructor() {
    // Impede a instanciação direta desta classe base abstrata.
    if (this.constructor === WhatsAppProvider) {
      throw new Error("A classe abstrata 'WhatsAppProvider' não pode ser instanciada diretamente. Crie uma subclasse.");
    }
  }

  /**
   * Inicializa conexões, clientes HTTP, web sockets ou autenticação específica do provedor.
   * Deve ser executada no bootstrap da aplicação.
   * 
   * @abstract
   * @async
   * @returns {Promise<void>}
   * @throws {Error} Se ocorrer falha ao inicializar o provedor.
   */
  async init() {
    throw new Error("O método 'init()' deve ser obrigatoriamente implementado pela classe filha.");
  }

  /**
   * Envia uma mensagem de texto simples para um destinatário.
   * 
   * @abstract
   * @async
   * @param {string} to Número de telefone do responsável com DDI e DDD (ex: '5511999999999').
   * @param {string} text Conteúdo de texto da mensagem a ser enviada.
   * @returns {Promise<any>} A resposta bruta da API do provedor (JSON ou ID de envio).
   * @throws {Error} Se ocorrer erro no envio da mensagem de texto.
   */
  async sendText(to, text) {
    throw new Error("O método 'sendText(to, text)' deve ser obrigatoriamente implementado pela classe filha.");
  }

  /**
   * Envia uma mensagem estruturada a partir de um template pré-definido.
   * Na API Oficial, isso é enviado nativamente como um template registrado.
   * Em APIs gratuitas/simuladas, o provedor se encarrega de mapear o template para texto corrido.
   * 
   * @abstract
   * @async
   * @param {string} to Número de telefone do responsável com DDI e DDD.
   * @param {string} templateName Nome identificador do template registrado (ex: 'template_checkin_shopping').
   * @param {any[]} variables Lista ordenada de valores que substituirão as variáveis dinâmicas do template.
   * @returns {Promise<any>} A resposta bruta da API do provedor.
   * @throws {Error} Se ocorrer erro no envio do template.
   */
  async sendTemplate(to, templateName, variables) {
    throw new Error("O método 'sendTemplate(to, templateName, variables)' deve ser obrigatoriamente implementado pela classe filha.");
  }
}

module.exports = WhatsAppProvider;

