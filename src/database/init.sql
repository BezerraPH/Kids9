-- ============================================================================
-- SCRIPT DE INICIALIZAÇÃO DO BANCO DE DADOS - KIDS9 SYSTEM
-- ============================================================================
-- Este script define a estrutura básica de tabelas, funções e gatilhos (triggers)
-- no banco de dados PostgreSQL. É executado de forma automática no bootstrap da 
-- aplicação caso a tabela 'checkins' ainda não tenha sido criada.

-- ----------------------------------------------------------------------------
-- 1. Criação da tabela principal de check-ins
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkins (
  -- Chave primária autoincrementada
  id SERIAL PRIMARY KEY,
  
  -- Nome da criança (obrigatório, limitado a 100 caracteres)
  child_name VARCHAR(100) NOT NULL,
  
  -- Telefone de contato do responsável (normalizado, ex: 5511999999999)
  parent_phone VARCHAR(20) NOT NULL,
  
  -- Método de pagamento utilizado (Pix, Cartão, Dinheiro, etc.)
  payment_method VARCHAR(50) NOT NULL,
  
  -- Valor cobrado pelo tempo de brinquedo contratado (ex: R$ 30,00)
  payment_value NUMERIC(10, 2) NOT NULL,
  
  -- Tempo contratado em minutos (ex: 30, 60, 90)
  playtime_minutes INTEGER NOT NULL,
  
  -- Data/hora em que a entrada foi registrada (padrão: data/hora atual)
  checkin_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Data/hora de término prevista (calculada no backend como checkin_time + playtime_minutes)
  expected_checkout_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Data/hora exata em que a saída foi confirmada (preenchida apenas no checkout)
  actual_checkout_time TIMESTAMP WITH TIME ZONE,
  
  -- Código PIN gerado aleatoriamente para fins de validação no checkout
  pin VARCHAR(6) NOT NULL,
  
  -- Status atual do registro. Pode ser 'active' ou 'completed'.
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  
  -- Flag que controla o disparo do alerta de 5 minutos restante pelo Cron Job
  alert_sent BOOLEAN DEFAULT FALSE,
  
  -- Contador de tentativas de disparo do WhatsApp (usado para evitar loops infinitos)
  alert_attempts INTEGER DEFAULT 0,
  
  -- Registro automático de criação da linha
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Registro automático de atualização da linha (controlado por trigger)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. Correções de esquema para bancos legados
-- ----------------------------------------------------------------------------
-- Caso a tabela já existisse antes da implementação do contador de tentativas,
-- adicionamos a coluna de controle 'alert_attempts' de forma segura.
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS alert_attempts INTEGER DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 3. Função de atualização automática do campo 'updated_at'
-- ----------------------------------------------------------------------------
-- Função executada internamente pelo PostgreSQL antes de qualquer instrução
-- UPDATE na tabela 'checkins'. Atualiza o valor de 'updated_at' para o momento atual.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- ----------------------------------------------------------------------------
-- 4. Trigger associado à tabela 'checkins'
-- ----------------------------------------------------------------------------
-- Garante que a função 'update_updated_at_column' seja disparada para cada linha
-- modificada (FOR EACH ROW) em operações de UPDATE.
DROP TRIGGER IF EXISTS update_checkins_updated_at ON checkins;
CREATE TRIGGER update_checkins_updated_at
    BEFORE UPDATE ON checkins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

