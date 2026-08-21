require('dotenv').config();

const requiredEnv = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'WHATSAPP_PROVIDER'
];

// Validar presença de variáveis obrigatórias
for (const env of requiredEnv) {
  if (!process.env[env]) {
    console.error(`[CONFIG ERROR] A variável de ambiente ${env} está ausente.`);
    process.exit(1);
  }
}

const provider = process.env.WHATSAPP_PROVIDER.toLowerCase();

// Validar valor do provedor do WhatsApp
if (provider !== 'free' && provider !== 'official') {
  console.error(`[CONFIG ERROR] WHATSAPP_PROVIDER deve ser 'free' ou 'official'. Recebido: ${process.env.WHATSAPP_PROVIDER}`);
  process.exit(1);
}

// Validar dependências da API oficial
if (provider === 'official') {
  if (!process.env.META_WA_TOKEN || !process.env.META_WA_PHONE_NUMBER_ID) {
    console.error(`[CONFIG ERROR] As variáveis META_WA_TOKEN e META_WA_PHONE_NUMBER_ID são obrigatórias quando WHATSAPP_PROVIDER é 'official'.`);
    process.exit(1);
  }
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  adminPin: process.env.ADMIN_PIN || '4321',
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME
  },
  whatsapp: {
    provider: provider,
    waha: {
      apiUrl: process.env.WAHA_API_URL || 'http://waha:3000',
      apiKey: process.env.WAHA_API_KEY || '',
      sessionName: process.env.WAHA_SESSION_NAME || 'default'
    },
    meta: {
      token: process.env.META_WA_TOKEN,
      phoneNumberId: process.env.META_WA_PHONE_NUMBER_ID,
      apiVersion: process.env.META_WA_API_VERSION || 'v18.0'
    }
  }
};
