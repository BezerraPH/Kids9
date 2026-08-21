const config = require('../../config/environment');
const WahaProvider = require('./waha.provider');
const MetaProvider = require('./meta.provider');

let activeProviderInstance = null;

/**
 * Factory para gerenciar e retornar a instância do provedor do WhatsApp ativa (Padrão Strategy).
 * Implementa o padrão Singleton para evitar que múltiplos navegadores/clientes sejam criados.
 */
class WhatsAppFactory {
  /**
   * Retorna a instância ativa do provedor configurado.
   * @returns {import('./whatsapp.provider')} Instância do provedor ativa
   */
  static getProvider() {
    if (activeProviderInstance) {
      return activeProviderInstance;
    }

    const providerType = config.whatsapp.provider;
    console.log(`[WHATSAPP-FACTORY] Carregando provedor de mensagens configurado: ${providerType.toUpperCase()}`);

    if (providerType === 'free') {
      activeProviderInstance = new WahaProvider();
    } else if (providerType === 'official') {
      activeProviderInstance = new MetaProvider();
    } else {
      throw new Error(`[WHATSAPP-FACTORY ERROR] Provedor de mensagens '${providerType}' desconhecido.`);
    }

    return activeProviderInstance;
  }
}

module.exports = WhatsAppFactory;
