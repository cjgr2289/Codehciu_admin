-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 25-03-2026 a las 14:52:28
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `sistema_noticias`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ajustes_presupuesto`
--

CREATE TABLE `ajustes_presupuesto` (
  `id` int(11) NOT NULL,
  `proyecto_id` int(11) NOT NULL,
  `partida_id` int(11) DEFAULT NULL,
  `monto_anterior` decimal(15,2) NOT NULL,
  `monto_nuevo` decimal(15,2) NOT NULL,
  `tipo` enum('Aumento','Disminución','Reasignación') NOT NULL,
  `motivo` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `bancos`
--

CREATE TABLE `bancos` (
  `id` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `pais` varchar(100) DEFAULT 'Venezuela',
  `numero_cuenta` varchar(50) NOT NULL,
  `tipo_cuenta` varchar(50) DEFAULT 'Corriente',
  `representante` varchar(200) DEFAULT NULL,
  `email_representante` varchar(150) DEFAULT NULL,
  `telefono_representante` varchar(50) DEFAULT NULL,
  `saldo_inicial` decimal(15,2) DEFAULT 0.00,
  `saldo_actual` decimal(15,2) DEFAULT 0.00,
  `moneda` enum('USD','BS','EUR') DEFAULT 'USD',
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detalles_solicitud`
--

CREATE TABLE `detalles_solicitud` (
  `id` int(11) NOT NULL,
  `solicitud_id` int(11) NOT NULL,
  `descripcion_item` varchar(255) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 1,
  `unidad_medida` varchar(20) DEFAULT NULL,
  `precio_unitario_estimado` decimal(15,2) DEFAULT NULL,
  `subtotal_estimado` decimal(15,2) DEFAULT NULL,
  `observaciones` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `donantes`
--

CREATE TABLE `donantes` (
  `id` int(11) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `tipo` enum('Organización','Persona','Gobierno') NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `pais` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `historial_solicitud`
--

CREATE TABLE `historial_solicitud` (
  `id` int(11) NOT NULL,
  `solicitud_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `estado_anterior` enum('Pendiente','En_Revision','Aprobada','Rechazada','Pagada','Cerrada') DEFAULT NULL,
  `estado_nuevo` enum('Pendiente','En_Revision','Aprobada','Rechazada','Pagada','Cerrada') NOT NULL,
  `comentario` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `log_proyectos`
--

CREATE TABLE `log_proyectos` (
  `id` int(11) NOT NULL,
  `proyecto_id` int(11) NOT NULL,
  `status_anterior` enum('Abierto','Cerrado') DEFAULT NULL,
  `status_nuevo` enum('Abierto','Cerrado') NOT NULL,
  `motivo` text DEFAULT NULL,
  `fecha_cambio` datetime DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `noticias`
--

CREATE TABLE `noticias` (
  `id` int(11) NOT NULL,
  `titulo` varchar(255) NOT NULL,
  `imagen_url` longblob DEFAULT NULL,
  `fecha` date NOT NULL,
  `resumen` text NOT NULL,
  `contenido` text NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pagos_solicitud`
--

CREATE TABLE `pagos_solicitud` (
  `id` int(11) NOT NULL,
  `solicitud_id` int(11) NOT NULL,
  `transaccion_id` int(11) DEFAULT NULL,
  `realizado_por` int(11) NOT NULL,
  `fecha_pago` date NOT NULL,
  `monto_pagado` decimal(15,2) NOT NULL,
  `moneda` enum('USD','BS','EUR') DEFAULT 'USD',
  `tasa_cambio` decimal(10,4) DEFAULT 1.0000,
  `banco_origen_id` int(11) DEFAULT NULL,
  `numero_transferencia` varchar(100) DEFAULT NULL,
  `cuenta_destino` varchar(50) DEFAULT NULL,
  `beneficiario` varchar(200) NOT NULL,
  `documento_beneficiario` varchar(20) DEFAULT NULL,
  `comprobante_foto` longblob DEFAULT NULL,
  `comprobante_tipo` varchar(10) DEFAULT NULL,
  `observaciones_pago` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `partidas`
--

CREATE TABLE `partidas` (
  `id` int(11) NOT NULL,
  `proyecto_id` int(11) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `presupuesto_asignado` decimal(15,2) DEFAULT 0.00,
  `presupuesto_actual` decimal(15,2) DEFAULT 0.00,
  `tipo` enum('Principal','Secundaria') DEFAULT 'Principal',
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `partida_padre_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `proyectos`
--

CREATE TABLE `proyectos` (
  `id` int(11) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `cliente` varchar(200) DEFAULT NULL,
  `presupuesto` decimal(15,2) DEFAULT 0.00,
  `fecha_inicio` date DEFAULT NULL,
  `fecha_fin` date DEFAULT NULL,
  `estado` enum('Activo','Pausado','Completado','Cancelado') DEFAULT 'Activo',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `proyecto_donante`
--

CREATE TABLE `proyecto_donante` (
  `id` int(11) NOT NULL,
  `proyecto_id` int(11) NOT NULL,
  `donante_id` int(11) NOT NULL,
  `monto_asignado` decimal(15,2) NOT NULL,
  `moneda` enum('USD','BS','EUR') DEFAULT 'USD',
  `fecha_asignacion` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `solicitudes_compras`
--

CREATE TABLE `solicitudes_compras` (
  `id` int(11) NOT NULL,
  `codigo_solicitud` varchar(20) NOT NULL,
  `proyecto_id` int(11) NOT NULL,
  `partida_id` int(11) DEFAULT NULL,
  `solicitante_id` int(11) NOT NULL,
  `fecha_solicitud` date NOT NULL,
  `fecha_requerida` date DEFAULT NULL,
  `prioridad` enum('Baja','Media','Alta','Urgente') DEFAULT 'Media',
  `descripcion` text NOT NULL,
  `justificacion` text DEFAULT NULL,
  `monto_estimado` decimal(15,2) NOT NULL,
  `moneda` enum('USD','BS','EUR') DEFAULT 'USD',
  `estado` enum('Pendiente','En_Revision','Aprobada','Rechazada','Pagada','Cerrada') DEFAULT 'Pendiente',
  `comentarios_rechazo` text DEFAULT NULL,
  `aprobado_por` int(11) DEFAULT NULL,
  `fecha_aprobacion` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `transacciones`
--

CREATE TABLE `transacciones` (
  `id` int(11) NOT NULL,
  `proyecto_id` int(11) DEFAULT NULL,
  `partida_id` int(11) DEFAULT NULL,
  `banco_id` int(11) NOT NULL,
  `solicitud_id` int(11) DEFAULT NULL,
  `tipo` enum('Ingreso','Egreso') NOT NULL,
  `monto` decimal(15,2) NOT NULL,
  `moneda` enum('USD','BS','EUR') DEFAULT 'USD',
  `tasa_cambio` decimal(10,4) DEFAULT 1.0000,
  `concepto` varchar(300) NOT NULL,
  `fecha_transaccion` date NOT NULL,
  `numero_documento` varchar(50) DEFAULT NULL,
  `beneficiario` varchar(200) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `metodo_pago` enum('Transferencia','Efectivo','Cheque','Tarjeta') DEFAULT 'Transferencia',
  `status` enum('Pendiente','Completado','Cancelado') DEFAULT 'Completado',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `transacciones_banco`
--

CREATE TABLE `transacciones_banco` (
  `id` int(11) NOT NULL,
  `tipo` enum('ingreso','egreso') NOT NULL,
  `cuenta_bancaria_id` int(11) NOT NULL,
  `monto` decimal(15,2) NOT NULL,
  `moneda` varchar(3) NOT NULL,
  `tasa_cambio` decimal(10,2) DEFAULT NULL,
  `monto_dolares` decimal(15,2) DEFAULT NULL,
  `concepto` varchar(100) NOT NULL,
  `referencia` varchar(100) NOT NULL,
  `titular` varchar(200) NOT NULL,
  `documento_identidad` varchar(50) DEFAULT NULL,
  `fecha_transaccion` date NOT NULL,
  `fecha_registro` timestamp NOT NULL DEFAULT current_timestamp(),
  `descripcion` text DEFAULT NULL,
  `usuario_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `cedula` varchar(10) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol` enum('admin','editor','contab','regular','coord','directivo','socio') DEFAULT 'editor',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `telefono` varchar(11) DEFAULT NULL,
  `foto` longblob DEFAULT NULL,
  `foto_tipo` varchar(10) DEFAULT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `cargo` varchar(100) DEFAULT NULL,
  `departamento` varchar(100) DEFAULT NULL,
  `TipoSangre` varchar(3) DEFAULT NULL,
  `Alergias` varchar(50) DEFAULT NULL,
  `Medicinas` varchar(50) DEFAULT NULL,
  `politicas_aceptadas` tinyint(1) NOT NULL DEFAULT 0,
  `Activo` tinyint(4) NOT NULL DEFAULT 1,
  `debe_cambiar_password` tinyint(4) NOT NULL DEFAULT 1,
  `fecha_actualizacion` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario_proyecto`
--

CREATE TABLE `usuario_proyecto` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `proyecto_id` int(11) NOT NULL,
  `rol_proyecto` enum('manager','miembro','observador') DEFAULT 'miembro',
  `fecha_asignacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `activo` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `ajustes_presupuesto`
--
ALTER TABLE `ajustes_presupuesto`
  ADD PRIMARY KEY (`id`),
  ADD KEY `proyecto_id` (`proyecto_id`),
  ADD KEY `partida_id` (`partida_id`);

--
-- Indices de la tabla `bancos`
--
ALTER TABLE `bancos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_cuenta` (`numero_cuenta`),
  ADD KEY `idx_activo` (`activo`);

--
-- Indices de la tabla `detalles_solicitud`
--
ALTER TABLE `detalles_solicitud`
  ADD PRIMARY KEY (`id`),
  ADD KEY `solicitud_id` (`solicitud_id`);

--
-- Indices de la tabla `donantes`
--
ALTER TABLE `donantes`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `historial_solicitud`
--
ALTER TABLE `historial_solicitud`
  ADD PRIMARY KEY (`id`),
  ADD KEY `solicitud_id` (`solicitud_id`),
  ADD KEY `usuario_id` (`usuario_id`),
  ADD KEY `idx_historial_fecha` (`created_at`);

--
-- Indices de la tabla `log_proyectos`
--
ALTER TABLE `log_proyectos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `proyecto_id` (`proyecto_id`);

--
-- Indices de la tabla `noticias`
--
ALTER TABLE `noticias`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `pagos_solicitud`
--
ALTER TABLE `pagos_solicitud`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_transferencia` (`numero_transferencia`),
  ADD KEY `solicitud_id` (`solicitud_id`),
  ADD KEY `transaccion_id` (`transaccion_id`),
  ADD KEY `realizado_por` (`realizado_por`),
  ADD KEY `banco_origen_id` (`banco_origen_id`),
  ADD KEY `idx_pagos_fecha` (`fecha_pago`);

--
-- Indices de la tabla `partidas`
--
ALTER TABLE `partidas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `proyecto_id` (`proyecto_id`),
  ADD KEY `fk_partida_padre` (`partida_padre_id`);

--
-- Indices de la tabla `proyectos`
--
ALTER TABLE `proyectos`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `proyecto_donante`
--
ALTER TABLE `proyecto_donante`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_proyecto_donante` (`proyecto_id`,`donante_id`),
  ADD KEY `donante_id` (`donante_id`);

--
-- Indices de la tabla `solicitudes_compras`
--
ALTER TABLE `solicitudes_compras`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `codigo_solicitud` (`codigo_solicitud`),
  ADD KEY `proyecto_id` (`proyecto_id`),
  ADD KEY `partida_id` (`partida_id`),
  ADD KEY `solicitante_id` (`solicitante_id`),
  ADD KEY `aprobado_por` (`aprobado_por`),
  ADD KEY `idx_estado` (`estado`),
  ADD KEY `idx_fecha_solicitud` (`fecha_solicitud`),
  ADD KEY `idx_solicitudes_fechas` (`fecha_solicitud`,`fecha_requerida`),
  ADD KEY `idx_solicitudes_prioridad` (`prioridad`,`estado`);

--
-- Indices de la tabla `transacciones`
--
ALTER TABLE `transacciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `proyecto_id` (`proyecto_id`),
  ADD KEY `partida_id` (`partida_id`),
  ADD KEY `banco_id` (`banco_id`),
  ADD KEY `idx_tipo` (`tipo`),
  ADD KEY `idx_fecha` (`fecha_transaccion`),
  ADD KEY `idx_proyecto_tipo` (`proyecto_id`,`tipo`),
  ADD KEY `solicitud_id` (`solicitud_id`);

--
-- Indices de la tabla `transacciones_banco`
--
ALTER TABLE `transacciones_banco`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `referencia` (`referencia`),
  ADD KEY `cuenta_bancaria_id` (`cuenta_bancaria_id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indices de la tabla `usuario_proyecto`
--
ALTER TABLE `usuario_proyecto`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `usuario_proyecto_unico` (`usuario_id`,`proyecto_id`),
  ADD KEY `fk_usuario` (`usuario_id`),
  ADD KEY `fk_proyecto` (`proyecto_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `ajustes_presupuesto`
--
ALTER TABLE `ajustes_presupuesto`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `bancos`
--
ALTER TABLE `bancos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `detalles_solicitud`
--
ALTER TABLE `detalles_solicitud`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `donantes`
--
ALTER TABLE `donantes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `historial_solicitud`
--
ALTER TABLE `historial_solicitud`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `log_proyectos`
--
ALTER TABLE `log_proyectos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `noticias`
--
ALTER TABLE `noticias`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pagos_solicitud`
--
ALTER TABLE `pagos_solicitud`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `partidas`
--
ALTER TABLE `partidas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `proyectos`
--
ALTER TABLE `proyectos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `proyecto_donante`
--
ALTER TABLE `proyecto_donante`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `solicitudes_compras`
--
ALTER TABLE `solicitudes_compras`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `transacciones`
--
ALTER TABLE `transacciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `transacciones_banco`
--
ALTER TABLE `transacciones_banco`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuario_proyecto`
--
ALTER TABLE `usuario_proyecto`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `ajustes_presupuesto`
--
ALTER TABLE `ajustes_presupuesto`
  ADD CONSTRAINT `ajustes_presupuesto_ibfk_1` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ajustes_presupuesto_ibfk_2` FOREIGN KEY (`partida_id`) REFERENCES `partidas` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `detalles_solicitud`
--
ALTER TABLE `detalles_solicitud`
  ADD CONSTRAINT `detalles_solicitud_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_compras` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `historial_solicitud`
--
ALTER TABLE `historial_solicitud`
  ADD CONSTRAINT `historial_solicitud_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_compras` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `historial_solicitud_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `log_proyectos`
--
ALTER TABLE `log_proyectos`
  ADD CONSTRAINT `log_proyectos_ibfk_1` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `noticias`
--
ALTER TABLE `noticias`
  ADD CONSTRAINT `noticias_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `pagos_solicitud`
--
ALTER TABLE `pagos_solicitud`
  ADD CONSTRAINT `pagos_solicitud_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_compras` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pagos_solicitud_ibfk_2` FOREIGN KEY (`transaccion_id`) REFERENCES `transacciones` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `pagos_solicitud_ibfk_3` FOREIGN KEY (`realizado_por`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `pagos_solicitud_ibfk_4` FOREIGN KEY (`banco_origen_id`) REFERENCES `bancos` (`id`);

--
-- Filtros para la tabla `partidas`
--
ALTER TABLE `partidas`
  ADD CONSTRAINT `fk_partida_padre` FOREIGN KEY (`partida_padre_id`) REFERENCES `partidas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `partidas_ibfk_1` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `proyecto_donante`
--
ALTER TABLE `proyecto_donante`
  ADD CONSTRAINT `proyecto_donante_ibfk_1` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `proyecto_donante_ibfk_2` FOREIGN KEY (`donante_id`) REFERENCES `donantes` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `solicitudes_compras`
--
ALTER TABLE `solicitudes_compras`
  ADD CONSTRAINT `solicitudes_compras_ibfk_1` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `solicitudes_compras_ibfk_2` FOREIGN KEY (`partida_id`) REFERENCES `partidas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `solicitudes_compras_ibfk_3` FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `solicitudes_compras_ibfk_4` FOREIGN KEY (`aprobado_por`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `transacciones`
--
ALTER TABLE `transacciones`
  ADD CONSTRAINT `transacciones_ibfk_1` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `transacciones_ibfk_2` FOREIGN KEY (`partida_id`) REFERENCES `partidas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `transacciones_ibfk_3` FOREIGN KEY (`banco_id`) REFERENCES `bancos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `transacciones_ibfk_4` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_compras` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `transacciones_banco`
--
ALTER TABLE `transacciones_banco`
  ADD CONSTRAINT `transacciones_banco_ibfk_1` FOREIGN KEY (`cuenta_bancaria_id`) REFERENCES `bancos` (`id`),
  ADD CONSTRAINT `transacciones_banco_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `usuario_proyecto`
--
ALTER TABLE `usuario_proyecto`
  ADD CONSTRAINT `fk_usuario_proyecto_proyectos` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_usuario_proyecto_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
