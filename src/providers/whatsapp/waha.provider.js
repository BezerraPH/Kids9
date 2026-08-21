/**
 * @file waha.provider.js
 * @description Estratégia de envio Gratuita utilizando o WAHA (WhatsApp HTTP API).
 * Totalmente compatível com WAHA v2. Gerencia automaticamente o ciclo de vida da sessão
 * no startup e simula o envio de templates oficiais da Meta transformando-os em mensagens
 * textuais amigáveis.
 */

const axios = require('axios');
const WhatsAppProvider = require('./whatsapp.provider');
const config = require('../../config/environment');

/**
 * Provedor de mensagens gratuito WAHA.
 * @extends WhatsAppProvider
 */
class WahaProvider extends WhatsAppProvider {
  constructor() {
    super();
    this.apiUrl = config.whatsapp.waha.apiUrl;
    this.apiKey = config.whatsapp.waha.apiKey;
    this.sessionName = config.whatsapp.waha.sessionName || 'default';

    // Configurar cliente HTTP Axios padrão com cabeçalhos de autenticação do WAHA se disponíveis
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: headers
    });
  }

  /**
   * Tenta resolver o nome da sessão ativa em execução no WAHA.
   * Útil para recuperar sessões que estejam operacionais sem depender
   * apenas do nome estático configurado no arquivo .env.
   * 
   * @async
   * @returns {Promise<string>} O nome da sessão ativa resolvida (ex: 'default', 'NTEK')
   */
  async getOrResolveSession() {
    // Se a sessão configurada já for diferente do padrão 'default', consideramos válida
    if (this.sessionName !== 'default') {
      return this.sessionName;
    }

    try {
      console.log(`[WAHA-API] Tentando resolver sessão ativa dinamicamente no servidor WAHA...`);
      const response = await this.client.get('/api/sessions?all=true');
      const sessions = response.data || [];

      // Procura alguma sessão que esteja com o status operacional 'WORKING'
      const workingSession = sessions.find(s => s.status === 'WORKING');
      if (workingSession) {
        this.sessionName = workingSession.name;
        console.log(`[WAHA-API] Sessão ativa operacional localizada dinamicamente: '${this.sessionName}'`);
      } else if (sessions.length > 0) {
        this.sessionName = sessions[0].name;
        console.log(`[WAHA-API] Nenhuma sessão ativa encontrada. Usando primeira registrada: '${this.sessionName}'`);
      }
    } catch (err) {
      console.warn('[WAHA-API WARNING] Falha ao resolver sessão dinamicamente:', err.message);
    }

    return this.sessionName;
  }

  /**
   * Inicializa a conexão com o servidor WAHA.
   * Consulta as sessões existentes, valida o status da sessão configurada, cria caso não exista
   * e envia o sinal de inicialização (start) de forma assíncrona.
   * 
   * @override
   * @async
   * @returns {Promise<void>}
   */
  async init() {
    console.log(`[WAHA-API] Inicializando conexão com o WAHA em ${this.apiUrl}...`);
    try {
      // 1. Consultar a lista de todas as sessões registradas no WAHA
      let sessions = [];
      try {
        const response = await this.client.get('/api/sessions?all=true');
        sessions = response.data || [];
        console.log(`[WAHA-API] Sessões encontradas na base do WAHA:`, sessions.map(s => `${s.name} (${s.status})`));
      } catch (listErr) {
        console.warn('[WAHA-API WARNING] Falha ao recuperar lista de sessões no bootstrap:', listErr.message);
      }

      // 2. Verificar se a sessão configurada está presente no servidor
      const configSessionExists = sessions.some(s => s.name === this.sessionName);

      if (!configSessionExists) {
        // Se a sessão configurada não existir, tenta se associar a qualquer outra ativa ('WORKING')
        const workingSession = sessions.find(s => s.status === 'WORKING');
        if (workingSession) {
          this.sessionName = workingSession.name;
          console.log(`[WAHA-API] Sessão configurada ausente. Usando sessão ativa localizada: '${this.sessionName}'`);
        } else if (sessions.length > 0) {
          this.sessionName = sessions[0].name;
          console.log(`[WAHA-API] Selecionando primeira sessão registrada no WAHA: '${this.sessionName}'`);
        }
      } else {
        console.log(`[WAHA-API] Sessão configurada identificada na base do WAHA: '${this.sessionName}'`);
      }

      // 3. Garantir que a sessão resolvida esteja rodando ('WORKING')
      const sessionUrl = `/api/sessions/${this.sessionName}`;
      let startSession = false;

      try {
        const response = await this.client.get(sessionUrl);
        const sessionStatus = response.data.status;
        console.log(`[WAHA-API] Status atual da sessão '${this.sessionName}': ${sessionStatus}`);

        if (sessionStatus !== 'WORKING') {
          startSession = true;
        }
      } catch (getErr) {
        // Se retornar status 404, significa que a sessão ainda não existe e precisa ser criada
        if (getErr.response && getErr.response.status === 404) {
          console.log(`[WAHA-API] Sessão '${this.sessionName}' inexistente no WAHA. Solicitando criação...`);
          try {
            await this.client.post('/api/sessions', { name: this.sessionName });
            console.log(`[WAHA-API] Sessão '${this.sessionName}' criada com sucesso.`);
          } catch (createErr) {
            console.error(`[WAHA-API] Falha ao criar a sessão no servidor:`, createErr.message);
          }
          startSession = true;
        } else {
          console.warn('[WAHA-API WARNING] Falha ao consultar status individual da sessão:', getErr.message);
          startSession = true;
        }
      }

      // 4. Se a sessão não estiver ativa, envia a rota POST /api/sessions/{session}/start
      if (startSession) {
        console.log(`[WAHA-API] Enviando comando de START para a sessão '${this.sessionName}'...`);
        try {
          await this.client.post(`/api/sessions/${this.sessionName}/start`, {});
          console.log(`[WAHA-API] Comando de inicialização enviado com sucesso para a sessão '${this.sessionName}'.`);
        } catch (startErr) {
          console.warn(`[WAHA-API WARNING] Sessão já em processo de inicialização ou erro no start:`, startErr.message);
        }
      } else {
        console.log(`[WAHA-API] Sessão '${this.sessionName}' já está operacional (WORKING).`);
      }

    } catch (error) {
      const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      console.error('[WAHA-API ERROR] Falha crítica ao inicializar módulo WAHA:', errorMsg);
    }
  }

  /**
   * Envia uma mensagem de texto simples via WAHA.
   * 
   * @override
   * @async
   * @param {string} to Número de telefone do destinatário
   * @param {string} text Conteúdo de texto da mensagem
   * @returns {Promise<any>} Dados de resposta da API
   */
  async sendText(to, text) {
    const session = await this.getOrResolveSession();
    let cleanNumber = to.replace(/\D/g, '');

    // Se o usuário digitou um 0 na frente do DDD (ex: 081995436658 -> 81995436658)
    if (cleanNumber.startsWith('0') && cleanNumber.length >= 11) {
      cleanNumber = cleanNumber.substring(1);
    }

    // Tratamento para remover o 55 se o usuário já o digitou
    if (cleanNumber.startsWith('55') && cleanNumber.length >= 12) {
      cleanNumber = cleanNumber.substring(2);
    }

    // Regra do 9º Dígito do WhatsApp no Brasil:
    // DDDs 11 a 28: Mantém o 9º dígito (11 dígitos no total)
    // DDDs 31 a 99: Remove o 9º dígito (10 dígitos no total)
    if (cleanNumber.length === 10 || cleanNumber.length === 11) {
      const ddd = parseInt(cleanNumber.substring(0, 2), 10);

      if (cleanNumber.length === 11 && ddd > 28) {
        // Remove o 9º dígito para DDDs > 28
        cleanNumber = cleanNumber.substring(0, 2) + cleanNumber.substring(3);
      } else if (cleanNumber.length === 10 && ddd <= 28) {
        // Adiciona o 9º dígito para DDDs <= 28, caso tenha sido omitido
        cleanNumber = cleanNumber.substring(0, 2) + '9' + cleanNumber.substring(2);
      }

      cleanNumber = `55${cleanNumber}`;
    } else if (cleanNumber.length < 10) {
      console.warn(`[WAHA-API WARNING] Número telefônico muito curto para normalização: ${cleanNumber}`);
    }

    // O WAHA exige que o chatId termine com a extensão '@c.us' para chats individuais
    const chatId = cleanNumber.includes('@c.us') ? cleanNumber : `${cleanNumber}@c.us`;

    console.log(`[WAHA-API] Enviando mensagem de texto para ${chatId} usando a sessão '${session}'...`);
    try {
      const response = await this.client.post('/api/sendText', {
        session: session,
        chatId: chatId,
        text: text
      });

      console.log(`[WAHA-API] Mensagem enviada com sucesso para ${chatId}. Message ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      console.error(`[WAHA-API ERROR] Falha ao enviar mensagem via WAHA para ${chatId} usando '${session}':`, errorMsg);
      throw new Error(`WAHA API Error: ${errorMsg}`);
    }
  }

  /**
   * Simula o envio de template convertendo parâmetros estruturados em uma mensagem de texto amigável.
   * 
   * @override
   * @async
   * @param {string} to Número de telefone do destinatário
   * @param {string} templateName Nome do template (ex: 'template_checkin_shopping')
   * @param {any[]} variables Lista ordenada de valores dinâmicos
   * @returns {Promise<any>} Dados de resposta da API
   */
  async sendTemplate(to, templateName, variables) {
    let text = '';

    // Mapeamento dos templates oficiais da Meta para textos corridos equivalentes
    if (templateName === 'template_checkin_shopping') {
      // Formato esperado das variáveis: [childName, shopping, tempoMinutos, pin]
      const childName = variables.length >= 4 ? variables[0] : 'A criança';
      const shopping = variables.length >= 4 ? variables[1] : variables[0];
      const tempo = variables.length >= 4 ? variables[2] : variables[1];
      const pin = variables.length >= 4 ? variables[3] : variables[2];
      
      text = `Olá! ${childName} acaba de fazer o check-in no brinquedo do Shopping ${shopping}. O tempo contratado é de ${tempo} minutos. Para realizar o check-out com segurança, informe o código PIN: ${pin} ao funcionário.`;
    } else if (templateName === 'template_five_min_alert') {
      // Formato esperado das variáveis: [childName]
      const childName = variables[0] || 'a criança';
      text = `Olá! Restam apenas 5 minutos de tempo de brinquedo para ${childName}. Por favor, aproxime-se do balcão para realizar o check-out.`;
    } else {
      // Fallback genérico para templates desconhecidos
      text = `[Kids9 Alerta] Variáveis: ${variables.join(' | ')}`;
    }

    return this.sendText(to, text);
  }
}

module.exports = WahaProvider;
