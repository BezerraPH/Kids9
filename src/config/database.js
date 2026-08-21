const { Pool } = require('pg');
const config = require('./environment');

// Criar o pool de conexões do PostgreSQL
const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  max: 20, // Máximo de conexões concorrentes no pool
  idleTimeoutMillis: 30000, // Tempo máximo de ociosidade antes do descarte da conexão
  connectionTimeoutMillis: 5000, // Timeout ao tentar conectar
});

pool.on('connect', () => {
  console.log('[DATABASE] Nova conexão estabelecida com o banco de dados.');
});

pool.on('error', (err) => {
  console.error('[DATABASE ERROR] Erro crítico no pool de conexões do PostgreSQL:', err);
});

/**
 * Helper para executar queries no banco de dados com log de performance em desenvolvimento.
 * @param {string} text Query SQL
 * @param {any[]} params Parâmetros da query
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.nodeEnv === 'development') {
      console.log('[QUERY EXEC]', { text, duration: `${duration}ms`, rowsCount: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('[QUERY ERROR] Falha de execução da query:', { text, error: error.message });
    throw error;
  }
};

module.exports = {
  pool,
  query
};
