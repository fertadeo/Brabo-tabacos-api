-- Add personeria (tipo de persona para facturación) and cuil_cuit to clients
-- personeria: persona_fisica | persona_juridica | consumidor_final
-- cuil_cuit: opcional para consumidor_final; CUIL/CUIT 11 dígitos para el resto

ALTER TABLE `clients`
  ADD COLUMN `personeria` VARCHAR(20) NOT NULL DEFAULT 'consumidor_final'
    COMMENT 'persona_fisica | persona_juridica | consumidor_final'
    AFTER `country`,
  ADD COLUMN `cuil_cuit` VARCHAR(20) DEFAULT NULL
    COMMENT 'CUIL o CUIT (11 dígitos), opcional si personeria=consumidor_final'
    AFTER `personeria`;

-- Opcional: índice si se filtra por personeria
-- CREATE INDEX idx_clients_personeria ON clients (personeria);
