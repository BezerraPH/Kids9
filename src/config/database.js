/**
 * @file database.js
 * @description Módulo de configuração e instância de conexão com o banco de dados PostgreSQL.
 * Gerencia o pool de conexões utilizando a biblioteca 'pg' e exporta uma função helper 
 * para execução de queries centralizada, permitindo log de queries e tratamento uniforme de erros.
 */

const { Pool } = require('pg');
const config = require('./environment');

/**
 * Pool de conexões do PostgreSQL configurado com limites de recursos e timeouts.
 * @type {Pool}
 */
const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  
  // Limites e timeouts de conexões
  max: 20,                          // Número máximo de clientes concorrentes permitidos no pool
  idleTimeoutMillis: 30000,         // Tempo (em ms) de ociosidade antes do cliente ser desconectado e fechado
  connectionTimeoutMillis: 5000,    // Tempo limite (em ms) para esperar ao tentar obter uma nova conexão
});

// Evento disparado quando um novo cliente se conecta ao banco de dados
pool.on('connect', () => {
  console.log('[DATABASE] Nova conexão física estabelecida com o banco de dados.');
});

// Evento crítico disparado em caso de erro assíncrono em conexões ociosas no pool
pool.on('error', (err) => {
  console.error('[DATABASE ERROR] Erro crítico inesperado no pool de conexões do PostgreSQL:', err);
});

/**
 * Helper centralizado para executar queries SQL no banco de dados.
 * Em ambiente de desenvolvimento, realiza a medição e o log do tempo de execução de cada query.
 * 
 * @param {string} text A instrução SQL a ser executada (ex: 'SELECT * FROM checkins WHERE id = $1;')
 * @param {any[]} [params] Array opcional de valores para substituir os parâmetros posicionais ($1, $2, etc.)
 * @returns {Promise<import('pg').QueryResult>} O objeto de resultado retornado pelo pg.Pool.query
 * @throws {Error} Propaga erros ocorridos durante a execução para que a camada de serviços os trate
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log de performance de queries ativado apenas em ambiente de desenvolvimento (evita poluição em prod)
    if (config.nodeEnv === 'development') {
      console.log('[QUERY EXEC]', { 
        text: text.replace(/\s+/g, ' ').trim(), 
        duration: `${duration}ms`, 
        rowsCount: res.rowCount 
      });
    }
    return res;
  } catch (error) {
    console.error('[QUERY ERROR] Falha de execução da query SQL:', { 
      text: text.replace(/\s+/g, ' ').trim(), 
      error: error.message 
    });
    throw error;
  }
};

module.exports = {
  pool,
  query
};

