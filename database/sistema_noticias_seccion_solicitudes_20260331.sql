-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 31-03-2026 a las 16:38:33
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
CREATE DATABASE IF NOT EXISTS `sistema_noticias` DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci;
USE `sistema_noticias`;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `control_correlativos`
--

CREATE TABLE `control_correlativos` (
  `id` int(11) NOT NULL,
  `subproceso_origen` varchar(3) NOT NULL,
  `subproceso_destino` varchar(3) DEFAULT NULL,
  `tipo_documento` varchar(3) NOT NULL,
  `anio` int(4) NOT NULL,
  `ultimo_correlativo` int(11) NOT NULL DEFAULT 0,
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
-- Estructura de tabla para la tabla `solicitudes_compras`
--

CREATE TABLE `solicitudes_compras` (
  `id` int(11) NOT NULL,
  `codigo_solicitud` varchar(50) NOT NULL,
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

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `control_correlativos`
--
ALTER TABLE `control_correlativos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unico_control` (`subproceso_origen`,`subproceso_destino`,`tipo_documento`,`anio`);

--
-- Indices de la tabla `detalles_solicitud`
--
ALTER TABLE `detalles_solicitud`
  ADD PRIMARY KEY (`id`),
  ADD KEY `solicitud_id` (`solicitud_id`);

--
-- Indices de la tabla `historial_solicitud`
--
ALTER TABLE `historial_solicitud`
  ADD PRIMARY KEY (`id`),
  ADD KEY `solicitud_id` (`solicitud_id`),
  ADD KEY `usuario_id` (`usuario_id`),
  ADD KEY `idx_historial_fecha` (`created_at`);

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
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `control_correlativos`
--
ALTER TABLE `control_correlativos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `detalles_solicitud`
--
ALTER TABLE `detalles_solicitud`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `historial_solicitud`
--
ALTER TABLE `historial_solicitud`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pagos_solicitud`
--
ALTER TABLE `pagos_solicitud`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `solicitudes_compras`
--
ALTER TABLE `solicitudes_compras`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

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
-- Filtros para la tabla `pagos_solicitud`
--
ALTER TABLE `pagos_solicitud`
  ADD CONSTRAINT `pagos_solicitud_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_compras` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pagos_solicitud_ibfk_2` FOREIGN KEY (`transaccion_id`) REFERENCES `transacciones` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `pagos_solicitud_ibfk_3` FOREIGN KEY (`realizado_por`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `pagos_solicitud_ibfk_4` FOREIGN KEY (`banco_origen_id`) REFERENCES `bancos` (`id`);

--
-- Filtros para la tabla `solicitudes_compras`
--
ALTER TABLE `solicitudes_compras`
  ADD CONSTRAINT `solicitudes_compras_ibfk_1` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `solicitudes_compras_ibfk_2` FOREIGN KEY (`partida_id`) REFERENCES `partidas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `solicitudes_compras_ibfk_3` FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `solicitudes_compras_ibfk_4` FOREIGN KEY (`aprobado_por`) REFERENCES `usuarios` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
