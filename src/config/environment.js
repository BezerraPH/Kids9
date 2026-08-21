/**
 * @file environment.js
 * @description Módulo de configuração e validação das variáveis de ambiente do Kids9.
 * Valida a presença de chaves essenciais no início do startup da aplicação e exporta
 * um objeto fortemente estruturado contendo as definições de porta, banco de dados e
 * provedores do WhatsApp (Meta API e WAHA).
 */

require('dotenv').config();

/**
 * Lista de variáveis de ambiente consideradas obrigatórias para o funcionamento geral do sistema.
 * @type {string[]}
 */
const requiredEnv = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'WHATSAPP_PROVIDER'
];

// Validar presença de variáveis obrigatórias no startup.
// Caso alguma variável crítica esteja ausente, o processo encerra com erro imediato.
for (const env of requiredEnv) {
  if (!process.env[env]) {
    console.error(`[CONFIG ERROR] A variável de ambiente obrigatória '${env}' está ausente no arquivo .env.`);
    process.exit(1);
  }
}

/**
 * Provedor ativo configurado. Convertido para letras minúsculas para garantir consistência.
 * @type {string}
 */
const provider = process.env.WHATSAPP_PROVIDER.toLowerCase();

// Validar valor do provedor do WhatsApp.
// Atualmente, o sistema suporta apenas os valores 'free' (WAHA) ou 'official' (Meta Cloud API).
if (provider !== 'free' && provider !== 'official') {
  console.error(`[CONFIG ERROR] WHATSAPP_PROVIDER deve ser obrigatoriamente 'free' ou 'official'. Recebido: '${process.env.WHATSAPP_PROVIDER}'`);
  process.exit(1);
}

// Validar dependências específicas se o provedor 'official' (Meta API) estiver ativo.
// A API da Meta exige obrigatoriamente um Token de autenticação Bearer e o ID do número.
if (provider === 'official') {
  if (!process.env.META_WA_TOKEN || !process.env.META_WA_PHONE_NUMBER_ID) {
    console.error(`[CONFIG ERROR] As variáveis 'META_WA_TOKEN' e 'META_WA_PHONE_NUMBER_ID' são obrigatórias quando WHATSAPP_PROVIDER é definido como 'official'.`);
    process.exit(1);
  }
}

/**
 * Objeto de configuração exportado contendo todas as variáveis de ambiente normalizadas.
 * Contém configurações do servidor HTTP Express, banco de dados PostgreSQL e APIs do WhatsApp.
 */
module.exports = {
  // Porta em que o servidor Express escutará (padrão: 3000)
  port: parseInt(process.env.PORT, 10) || 3000,
  
  // Ambiente de execução (development, production)
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // PIN master para bypass administrativo nas liberações de check-out
  adminPin: process.env.ADMIN_PIN || '4321',
  
  // Configurações do Banco de Dados PostgreSQL
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME
  },
  
  // Configurações das estratégias de disparo via WhatsApp
  whatsapp: {
    provider: provider,
    
    // Configurações para o provedor WAHA (WhatsApp HTTP API - Gratuito)
    waha: {
      apiUrl: process.env.WAHA_API_URL || 'http://waha:3000',
      apiKey: process.env.WAHA_API_KEY || '',
      sessionName: process.env.WAHA_SESSION_NAME || 'default'
    },
    
    // Configurações para o provedor Meta Cloud API (Oficial)
    meta: {
      token: process.env.META_WA_TOKEN,
      phoneNumberId: process.env.META_WA_PHONE_NUMBER_ID,
      apiVersion: process.env.META_WA_API_VERSION || 'v18.0'
    }
  }
};

