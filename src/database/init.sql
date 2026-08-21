-- Criar a tabela de check-ins caso não exista
CREATE TABLE IF NOT EXISTS checkins (
  id SERIAL PRIMARY KEY,
  child_name VARCHAR(100) NOT NULL,
  parent_phone VARCHAR(20) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_value NUMERIC(10, 2) NOT NULL,
  playtime_minutes INTEGER NOT NULL,
  checkin_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expected_checkout_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_checkout_time TIMESTAMP WITH TIME ZONE,
  pin VARCHAR(6) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  alert_sent BOOLEAN DEFAULT FALSE,
  alert_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Para atualizações em bancos existentes sem precisar dropar a tabela
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS alert_attempts INTEGER DEFAULT 0;

-- Criar a função para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar o trigger de atualização caso não exista
DROP TRIGGER IF EXISTS update_checkins_updated_at ON checkins;
CREATE TRIGGER update_checkins_updated_at
    BEFORE UPDATE ON checkins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
