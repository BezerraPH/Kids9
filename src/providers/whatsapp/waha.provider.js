const axios = require('axios');
const WhatsAppProvider = require('./whatsapp.provider');
const config = require('../../config/environment');

/**
 * Estratégia de envio Gratuita utilizando o WAHA (WhatsApp HTTP API).
 * Totalmente compatível com WAHA v2 e autenticação via X-Api-Key.
 */
class WahaProvider extends WhatsAppProvider {
  constructor() {
    super();
    this.apiUrl = config.whatsapp.waha.apiUrl;
    this.apiKey = config.whatsapp.waha.apiKey;
    this.sessionName = config.whatsapp.waha.sessionName || 'default';

    // Configurar cliente HTTP Axios com cabeçalhos de autenticação se disponíveis
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
   * Tenta resolver o nome da sessão ativa em execução.
   * Útil para curar race conditions de inicialização.
   */
  async getOrResolveSession() {
    // Se a sessão atual já for diferente de 'default', consideramos válida (ou configurada explicitamente)
    if (this.sessionName !== 'default') {
      return this.sessionName;
    }

    try {
      console.log(`[WAHA-API] Tentando resolver sessão ativa dinamicamente...`);
      const response = await this.client.get('/api/sessions?all=true');
      const sessions = response.data || [];

      // Tentar identificar uma sessão funcional ativa (WORKING)
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
   * Inicializa a conexão com o WAHA, descobrindo e iniciando a sessão adequada.
   */
  async init() {
    console.log(`[WAHA-API] Inicializando conexão com o WAHA em ${this.apiUrl}...`);
    try {
      // 1. Consultar a lista de sessões disponíveis
      let sessions = [];
      try {
        const response = await this.client.get('/api/sessions?all=true');
        sessions = response.data || [];
        console.log(`[WAHA-API] Sessões encontradas no banco do WAHA:`, sessions.map(s => `${s.name} (${s.status})`));
      } catch (listErr) {
        console.warn('[WAHA-API WARNING] Falha ao recuperar lista de sessões no bootstrap:', listErr.message);
      }

      // 2. Se a sessão configurada ('NTEK' por exemplo) existir na lista, mantemos ela
      const configSessionExists = sessions.some(s => s.name === this.sessionName);

      if (!configSessionExists) {
        // Se a configurada não existir, tenta encontrar qualquer outra WORKING ou registrada
        const workingSession = sessions.find(s => s.status === 'WORKING');
        if (workingSession) {
          this.sessionName = workingSession.name;
          console.log(`[WAHA-API] Sessão ativa operacional localizada e vinculada: '${this.sessionName}'`);
        } else if (sessions.length > 0) {
          this.sessionName = sessions[0].name;
          console.log(`[WAHA-API] Selecionando primeira sessão registrada no WAHA: '${this.sessionName}'`);
        }
      } else {
        console.log(`[WAHA-API] Sessão configurada identificada na base do WAHA: '${this.sessionName}'`);
      }

      // 3. Garantir que a sessão está rodando (enviar comando start se necessário)
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
        if (getErr.response && getErr.response.status === 404) {
          console.log(`[WAHA-API] Sessão '${this.sessionName}' inexistente no WAHA. Criando sessão...`);
          try {
            await this.client.post('/api/sessions', { name: this.sessionName });
            console.log(`[WAHA-API] Sessão '${this.sessionName}' criada com sucesso.`);
          } catch (createErr) {
            console.error(`[WAHA-API] Falha ao criar a sessão:`, createErr.message);
          }
          startSession = true;
        } else {
          console.warn('[WAHA-API WARNING] Falha ao consultar status individual da sessão:', getErr.message);
          startSession = true;
        }
      }

      if (startSession) {
        console.log(`[WAHA-API] Enviando sinal de START para a sessão '${this.sessionName}'...`);
        try {
          // Rota WAHA v2: POST /api/sessions/{session}/start
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
      console.error('[WAHA-API ERROR] Falha crítica de inicialização com o WAHA:', errorMsg);
    }
  }

  /**
   * Envia uma mensagem de texto simples via WAHA.
   */
  async sendText(to, text) {
    const session = await this.getOrResolveSession();
    let cleanNumber = to.replace(/\D/g, '');

    // Se o usuário digitou um 0 na frente do DDD (ex: 081995436658)
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
      // Se por algum motivo o número for muito curto, e não tiver código de país
      console.warn(`[WAHA-API WARNING] Número muito curto: ${cleanNumber}`);
    }

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
   * Simula o envio de template gerando uma mensagem de texto estruturada.
   */
  async sendTemplate(to, templateName, variables) {
    let text = '';

    // Mapeamento dos templates oficiais para mensagens textuais equivalentes
    if (templateName === 'template_checkin_shopping') {
      // Garantir que as variÃ¡veis contÃ©m o childName
      // No checkin.controller, Ã© provÃ¡vel que passamos childName em outro lugar,
      // mas vamos assumir [childName, shopping, tempo, pin] se tiver 4 args, ou lidar com fallback
      const childName = variables.length >= 4 ? variables[0] : 'a criança';
      const shopping = variables.length >= 4 ? variables[1] : variables[0];
      const tempo = variables.length >= 4 ? variables[2] : variables[1];
      const pin = variables.length >= 4 ? variables[3] : variables[2];
      
      text = `Olá! ${childName} acaba de fazer o check-in no brinquedo do Shopping ${shopping}. O tempo contratado é de ${tempo} minutos. Para realizar o check-out com segurança, informe o código PIN: ${pin} ao funcionário.`;
    } else if (templateName === 'template_five_min_alert') {
      const childName = variables[0] || 'a criança';
      text = `Olá! Restam apenas 5 minutos de tempo de brinquedo para ${childName}. Por favor, aproxime-se do balcão para realizar o check-out.`;
    } else {
      text = `[Kids9 Alerta] Variáveis: ${variables.join(' | ')}`;
    }

    return this.sendText(to, text);
  }
}

module.exports = WahaProvider;
