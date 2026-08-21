const axios = require('axios');
const WhatsAppProvider = require('./whatsapp.provider');
const config = require('../../config/environment');

/**
 * Estratégia de envio Oficial utilizando a Cloud API do WhatsApp (Meta/Facebook).
 */
class MetaProvider extends WhatsAppProvider {
  constructor() {
    super();
    this.token = config.whatsapp.meta.token;
    this.phoneNumberId = config.whatsapp.meta.phoneNumberId;
    this.apiVersion = config.whatsapp.meta.apiVersion;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
  }

  /**
   * Inicialização da API Oficial (apenas loga e valida as credenciais).
   */
  async init() {
    console.log('[META-API] Provedor inicializado e configurado.');
  }

  /**
   * Envia uma mensagem de texto simples via API Oficial da Meta.
   */
  async sendText(to, text) {
    let cleanNumber = to.replace(/\D/g, '');
    
    // Se o usuário digitou um 0 na frente do DDD (ex: 081995436658)
    if (cleanNumber.startsWith('0') && cleanNumber.length >= 11) {
      cleanNumber = cleanNumber.substring(1);
    }
    
    // Tratamento para remover o 55 se o usuário já o digitou
    if (cleanNumber.startsWith('55') && cleanNumber.length >= 12) {
      cleanNumber = cleanNumber.substring(2);
    }
    
    // Regra do 9º Dígito do WhatsApp no Brasil
    if (cleanNumber.length === 10 || cleanNumber.length === 11) {
      const ddd = parseInt(cleanNumber.substring(0, 2), 10);
      
      if (cleanNumber.length === 11 && ddd > 28) {
        cleanNumber = cleanNumber.substring(0, 2) + cleanNumber.substring(3);
      } else if (cleanNumber.length === 10 && ddd <= 28) {
        cleanNumber = cleanNumber.substring(0, 2) + '9' + cleanNumber.substring(2);
      }
      
      cleanNumber = `55${cleanNumber}`;
    }

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanNumber,
          type: "text",
          text: { body: text }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`[META-API] Mensagem de texto enviada com sucesso para ${cleanNumber}. Message ID: ${response.data.messages[0].id}`);
      return response.data;
    } catch (error) {
      const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      console.error(`[META-API ERROR] Falha ao enviar mensagem de texto para ${cleanNumber}:`, errorMsg);
      throw new Error(`Meta Cloud API Error: ${errorMsg}`);
    }
  }

  /**
   * Envia uma mensagem baseada em template registrado na Meta.
   */
  async sendTemplate(to, templateName, variables) {
    let cleanNumber = to.replace(/\D/g, '');
    
    // Se o usuário digitou um 0 na frente do DDD (ex: 081995436658)
    if (cleanNumber.startsWith('0') && cleanNumber.length >= 11) {
      cleanNumber = cleanNumber.substring(1);
    }
    
    // Tratamento para remover o 55 se o usuário já o digitou
    if (cleanNumber.startsWith('55') && cleanNumber.length >= 12) {
      cleanNumber = cleanNumber.substring(2);
    }
    
    // Regra do 9º Dígito do WhatsApp no Brasil
    if (cleanNumber.length === 10 || cleanNumber.length === 11) {
      const ddd = parseInt(cleanNumber.substring(0, 2), 10);
      
      if (cleanNumber.length === 11 && ddd > 28) {
        cleanNumber = cleanNumber.substring(0, 2) + cleanNumber.substring(3);
      } else if (cleanNumber.length === 10 && ddd <= 28) {
        cleanNumber = cleanNumber.substring(0, 2) + '9' + cleanNumber.substring(2);
      }
      
      cleanNumber = `55${cleanNumber}`;
    }

    // Mapear os parâmetros/variáveis para o formato exigido pela Meta
    const parameters = variables.map(val => ({
      type: "text",
      text: String(val)
    }));

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanNumber,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: "pt_BR"
            },
            components: [
              {
                type: "body",
                parameters: parameters
              }
            ]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`[META-API] Template "${templateName}" enviado com sucesso para ${cleanNumber}. Message ID: ${response.data.messages[0].id}`);
      return response.data;
    } catch (error) {
      const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      console.error(`[META-API ERROR] Falha ao enviar template "${templateName}" para ${cleanNumber}:`, errorMsg);
      throw new Error(`Meta Cloud API Template Error: ${errorMsg}`);
    }
  }
}

module.exports = MetaProvider;
