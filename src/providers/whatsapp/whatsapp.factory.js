/**
 * @file whatsapp.factory.js
 * @description Fábrica (Factory Pattern) responsável por instanciar e gerenciar
 * o provedor ativo de WhatsApp com base nas variáveis de ambiente.
 * Aplica o padrão Singleton para garantir que exista apenas uma instância ativa do provedor,
 * evitando problemas de múltiplas conexões físicas concorrentes e vazamento de memória.
 */

const config = require('../../config/environment');
const WahaProvider = require('./waha.provider');
const MetaProvider = require('./meta.provider');

/**
 * Instância única cacheada do provedor de mensagens.
 * @type {import('./whatsapp.provider')|null}
 */
let activeProviderInstance = null;

class WhatsAppFactory {
  /**
   * Retorna a instância ativa e única do provedor do WhatsApp (Strategy e Singleton).
   * Se a instância já tiver sido criada anteriormente, retorna a referência em cache.
   * Caso contrário, cria a subclasse correspondente ('free' ou 'official') e a armazena no cache.
   * 
   * @static
   * @returns {import('./whatsapp.provider')} Instância ativa do provedor configurado
   * @throws {Error} Se o provedor configurado for desconhecido
   */
  static getProvider() {
    // Retornar a instância em cache se disponível (Singleton)
    if (activeProviderInstance) {
      return activeProviderInstance;
    }

    const providerType = config.whatsapp.provider;
    console.log(`[WHATSAPP-FACTORY] Carregando provedor de mensagens configurado: '${providerType.toUpperCase()}'`);

    // Decidir qual estratégia instanciar
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

