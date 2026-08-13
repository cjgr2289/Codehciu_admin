-- Crear tabla de ajustes de presupuesto
CREATE TABLE IF NOT EXISTS `ajustes_presupuesto` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `proyecto_id` int(11) NOT NULL,
  `partida_id` int(11) NOT NULL,
  `monto_anterior` decimal(15,2) NOT NULL,
  `monto_nuevo` decimal(15,2) NOT NULL,
  `tipo` enum('Aumento','Disminución','Reasignación') NOT NULL,
  `motivo` text,
  `created_by` int(11),
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`partida_id`) REFERENCES `partidas` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  INDEX (`proyecto_id`),
  INDEX (`partida_id`),
  INDEX (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
