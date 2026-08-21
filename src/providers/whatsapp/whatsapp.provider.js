/**
 * Interface/Classe Base abstrata para os Provedores de WhatsApp (Padrão Strategy).
 * Garante que qualquer provedor siga a mesma interface pública de envio de mensagens.
 */
class WhatsAppProvider {
  constructor() {
    if (this.constructor === WhatsAppProvider) {
      throw new Error("A classe abstrata 'WhatsAppProvider' não pode ser instanciada diretamente.");
    }
  }

  /**
   * Inicializa a conexão ou cliente do provedor.
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error("O método 'init()' deve ser implementado pela classe filha.");
  }

  /**
   * Envia uma mensagem de texto simples para um número de telefone.
   * @param {string} to Número de telefone com DDI e DDD (ex: '5511999999999')
   * @param {string} text Conteúdo da mensagem de texto
   * @returns {Promise<any>} Resposta do provedor
   */
  async sendText(to, text) {
    throw new Error("O método 'sendText(to, text)' deve ser implementado pela classe filha.");
  }

  /**
   * Envia uma mensagem utilizando um template (obrigatório na API oficial Meta, simulado na gratuita).
   * @param {string} to Número de telefone com DDI e DDD
   * @param {string} templateName Identificador do template de mensagem
   * @param {any[]} variables Lista ordenada de valores para substituir os parâmetros do template
   * @returns {Promise<any>} Resposta do provedor
   */
  async sendTemplate(to, templateName, variables) {
    throw new Error("O método 'sendTemplate(to, templateName, variables)' deve ser implementado pela classe filha.");
  }
}

module.exports = WhatsAppProvider;
