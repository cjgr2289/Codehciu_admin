-- Crear tabla de ajustes de presupuesto
CREATE TABLE IF NOT EXISTS `ajustes_presupuesto` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `proyecto_id` int(11) NOT NULL,
  `partida_id` int(11) NOT NULL,
  `monto_anterior` decimal(15,2) NOT NULL DEFAULT '0.00',
  `monto_nuevo` decimal(15,2) NOT NULL DEFAULT '0.00',
  `tipo` enum('Aumento','Disminución','Reasignación') NOT NULL DEFAULT 'Aumento',
  `motivo` text,
  `created_by` int(11),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`partida_id`) REFERENCES `partidas` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  INDEX `idx_proyecto_id` (`proyecto_id`),
  INDEX `idx_partida_id` (`partida_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
