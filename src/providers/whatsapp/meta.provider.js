/**
 * @file meta.provider.js
 * @description Estratégia de envio Oficial do WhatsApp utilizando a Cloud API da Meta.
 * Formata os envios utilizando o padrão de templates estruturados e valida as credenciais
 * obrigatórias (Token e Phone Number ID).
 */

const axios = require('axios');
const WhatsAppProvider = require('./whatsapp.provider');
const config = require('../../config/environment');

/**
 * Provedor oficial da Meta Cloud API.
 * @extends WhatsAppProvider
 */
class MetaProvider extends WhatsAppProvider {
  constructor() {
    super();
    this.token = config.whatsapp.meta.token;
    this.phoneNumberId = config.whatsapp.meta.phoneNumberId;
    this.apiVersion = config.whatsapp.meta.apiVersion;
    // URL base da Graph API para envio de mensagens
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
  }

  /**
   * Inicialização do Provedor Meta.
   * Apenas confirma a configuração, já que a Meta Cloud API funciona por requisições HTTP sem necessidade de manter sessões persistentes ativas.
   * 
   * @override
   * @async
   * @returns {Promise<void>}
   */
  async init() {
    console.log('[META-API] Provedor de mensagens oficial (Meta Cloud API) inicializado com sucesso.');
  }

  /**
   * Normaliza números telefônicos para o padrão internacional exigido pelo WhatsApp (DDI + DDD + Número).
   * Aplica regras específicas do Brasil (9º dígito e código do país 55).
   * 
   * @private
   * @param {string} phone Número de telefone bruto
   * @returns {string} Número de telefone normalizado
   */
  _normalizePhoneNumber(phone) {
    let cleanNumber = phone.replace(/\D/g, '');
    
    // Remover o zero à esquerda do DDD se o usuário digitou (ex: 081995436658 -> 81995436658)
    if (cleanNumber.startsWith('0') && cleanNumber.length >= 11) {
      cleanNumber = cleanNumber.substring(1);
    }
    
    // Remover código de país '55' caso o usuário já tenha inserido (evita duplicar 5555)
    if (cleanNumber.startsWith('55') && cleanNumber.length >= 12) {
      cleanNumber = cleanNumber.substring(2);
    }
    
    // Aplicação da regra do 9º Dígito no Brasil:
    // DDDs 11 a 28: Exigem o 9º dígito (número deve ter 11 dígitos)
    // DDDs 31 a 99: Não possuem o 9º dígito no WhatsApp (número deve ter 10 dígitos)
    if (cleanNumber.length === 10 || cleanNumber.length === 11) {
      const ddd = parseInt(cleanNumber.substring(0, 2), 10);
      
      if (cleanNumber.length === 11 && ddd > 28) {
        // Remover o 9º dígito (geralmente o dígito no índice 2)
        cleanNumber = cleanNumber.substring(0, 2) + cleanNumber.substring(3);
      } else if (cleanNumber.length === 10 && ddd <= 28) {
        // Inserir o '9' caso tenha sido omitido para DDDs <= 28
        cleanNumber = cleanNumber.substring(0, 2) + '9' + cleanNumber.substring(2);
      }
      
      // Adicionar o DDI 55 (Brasil) no início do número normalizado
      cleanNumber = `55${cleanNumber}`;
    }

    return cleanNumber;
  }

  /**
   * Envia uma mensagem de texto simples via API Oficial da Meta.
   * 
   * @override
   * @async
   * @param {string} to Número de telefone do destinatário
   * @param {string} text Conteúdo da mensagem
   * @returns {Promise<any>} Dados da resposta da API
   */
  async sendText(to, text) {
    const cleanNumber = this._normalizePhoneNumber(to);

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
   * Envia uma mensagem baseada em template registrado no painel da Meta Cloud API.
   * 
   * @override
   * @async
   * @param {string} to Número de telefone do destinatário
   * @param {string} templateName Identificador do template no Meta Manager (ex: 'template_checkin_shopping')
   * @param {any[]} variables Lista ordenada de valores dinâmicos correspondente às variáveis do template (ex: {{1}}, {{2}})
   * @returns {Promise<any>} Dados da resposta da API
   */
  async sendTemplate(to, templateName, variables) {
    const cleanNumber = this._normalizePhoneNumber(to);

    // Mapear os parâmetros/variáveis para o formato específico exigido pela Graph API da Meta
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
              code: "pt_BR" // Idioma padrão das mensagens enviadas no Brasil
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

