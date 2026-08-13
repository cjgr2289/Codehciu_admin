-- phpMyAdmin SQL Dump
-- version 4.7.4
-- https://www.phpmyadmin.net/
--
-- Servidor: localhost
-- Tiempo de generación: 13-08-2026 a las 04:15:12
-- Versión del servidor: 10.1.28-MariaDB
-- Versión de PHP: 7.1.11

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
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
  `motivo` text,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

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
  `saldo_inicial` decimal(15,2) DEFAULT '0.00',
  `saldo_actual` decimal(15,2) DEFAULT '0.00',
  `moneda` enum('USD','BS','EUR') DEFAULT 'USD',
  `activo` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  `ultimo_correlativo` int(11) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cotizaciones`
--

CREATE TABLE `cotizaciones` (
  `id` int(11) NOT NULL,
  `solicitud_id` int(11) NOT NULL,
  `proveedor_id` varchar(20) NOT NULL,
  `monto_cotizado` decimal(15,2) NOT NULL,
  `fecha_cotizacion` date NOT NULL,
  `es_ganador` tinyint(1) DEFAULT '0',
  `observaciones` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `datos_pago_usuarios`
--

CREATE TABLE `datos_pago_usuarios` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL COMMENT 'ID del usuario',
  `banco` varchar(100) NOT NULL COMMENT 'Nombre del banco',
  `tipo_cuenta` enum('Corriente','Ahorro','Ambas') DEFAULT 'Corriente' COMMENT 'Tipo de cuenta bancaria',
  `numero_cuenta` varchar(50) NOT NULL COMMENT 'Número de cuenta bancaria',
  `numero_cedula` varchar(20) NOT NULL COMMENT 'Número de cédula/RIF del usuario',
  `forma_pago` enum('Transferencia','Cheque','Pago Movil','Efectivo') DEFAULT 'Transferencia' COMMENT 'Forma de pago preferida',
  `monto_honorarios` decimal(15,2) DEFAULT NULL COMMENT 'Monto de honorarios del usuario',
  `es_tercero` tinyint(1) DEFAULT '0' COMMENT '1 = Es un tercero/consultor, 0 = No',
  `tipo_contrato` varchar(50) DEFAULT NULL COMMENT 'Tipo de contrato: Honorarios, Servicios, Consultoria',
  `observaciones` text COMMENT 'Observaciones adicionales',
  `activo` tinyint(1) DEFAULT '1' COMMENT '1 = Activo, 0 = Inactivo',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Datos de pago de usuarios para honorarios/terceros';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detalles_solicitud`
--

CREATE TABLE `detalles_solicitud` (
  `id` int(11) NOT NULL,
  `solicitud_id` int(11) NOT NULL,
  `descripcion_item` varchar(255) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT '1',
  `unidad_medida` varchar(20) DEFAULT NULL,
  `precio_unitario_estimado` decimal(15,2) DEFAULT NULL,
  `subtotal_estimado` decimal(15,2) DEFAULT NULL,
  `observaciones` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  `direccion` text,
  `pais` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `historial_pagos`
--

CREATE TABLE `historial_pagos` (
  `id` int(11) NOT NULL,
  `solicitud_id` int(11) NOT NULL COMMENT 'ID de la solicitud de pago',
  `usuario_id` int(11) NOT NULL COMMENT 'ID del usuario que realizó el cambio',
  `estado_anterior` varchar(30) DEFAULT NULL COMMENT 'Estado antes del cambio',
  `estado_nuevo` varchar(30) NOT NULL COMMENT 'Estado después del cambio',
  `comentario` text COMMENT 'Comentario sobre el cambio',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha del cambio'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Historial de solicitudes de pago';

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
  `comentario` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `log_proyectos`
--

CREATE TABLE `log_proyectos` (
  `id` int(11) NOT NULL,
  `proyecto_id` int(11) NOT NULL,
  `status_anterior` enum('Abierto','Cerrado') DEFAULT NULL,
  `status_nuevo` enum('Abierto','Cerrado') NOT NULL,
  `motivo` text,
  `fecha_cambio` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `noticias`
--

CREATE TABLE `noticias` (
  `id` int(11) NOT NULL,
  `titulo` varchar(255) NOT NULL,
  `imagen_url` longblob,
  `fecha` date NOT NULL,
  `resumen` text NOT NULL,
  `contenido` text NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ordenes_compra`
--

CREATE TABLE `ordenes_compra` (
  `id` int(11) NOT NULL,
  `codigo_oc` varchar(30) NOT NULL,
  `solicitud_id` int(11) NOT NULL,
  `proveedor_id` varchar(20) NOT NULL,
  `monto_aprobado` decimal(15,2) NOT NULL,
  `fecha_emision` date NOT NULL,
  `fecha_aprobacion` datetime DEFAULT NULL,
  `aprobado_por` int(11) DEFAULT NULL,
  `estado` enum('Pendiente','Aprobada','Pagada','Cerrada') DEFAULT 'Pendiente',
  `observaciones` text,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `orden_compra_items`
--

CREATE TABLE `orden_compra_items` (
  `id` int(11) NOT NULL,
  `orden_compra_id` int(11) NOT NULL,
  `descripcion_item` varchar(255) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT '1',
  `unidad_medida` varchar(20) DEFAULT NULL,
  `precio_unitario` decimal(15,2) NOT NULL,
  `subtotal` decimal(15,2) NOT NULL,
  `tiene_iva` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=Si tiene IVA, 0=No tiene IVA',
  `iva` decimal(15,2) DEFAULT '0.00' COMMENT 'Monto del IVA calculado',
  `total_con_iva` decimal(15,2) DEFAULT '0.00' COMMENT 'Total con IVA incluido',
  `observaciones` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pagos_detalles`
--

CREATE TABLE `pagos_detalles` (
  `id` int(11) NOT NULL,
  `solicitud_id` int(11) NOT NULL COMMENT 'ID de la solicitud de pago',
  `descripcion` varchar(255) NOT NULL COMMENT 'Descripción del gasto',
  `monto` decimal(15,2) NOT NULL COMMENT 'Monto del detalle',
  `periodo` varchar(50) DEFAULT NULL COMMENT 'Período: Ene 2026, Ene-Mar 2026, etc.',
  `referencia` varchar(100) DEFAULT NULL COMMENT 'Referencia adicional',
  `observaciones` text COMMENT 'Observaciones del detalle',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Detalles de solicitudes de pago';

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
  `tasa_cambio` decimal(10,4) DEFAULT '1.0000',
  `banco_origen_id` int(11) DEFAULT NULL,
  `numero_transferencia` varchar(100) DEFAULT NULL,
  `cuenta_destino` varchar(50) DEFAULT NULL,
  `beneficiario` varchar(200) NOT NULL,
  `documento_beneficiario` varchar(20) DEFAULT NULL,
  `comprobante_foto` longblob,
  `comprobante_tipo` varchar(10) DEFAULT NULL,
  `observaciones_pago` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `partidas`
--

CREATE TABLE `partidas` (
  `id` int(11) NOT NULL,
  `proyecto_id` int(11) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `descripcion` text,
  `presupuesto_asignado` decimal(15,2) DEFAULT '0.00',
  `presupuesto_actual` decimal(15,2) DEFAULT '0.00',
  `tipo` enum('Principal','Secundaria') DEFAULT 'Principal',
  `activo` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `partida_padre_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `proveedores`
--

CREATE TABLE `proveedores` (
  `id` varchar(20) NOT NULL COMMENT 'CI o RIF como identificador único',
  `nombre` varchar(200) NOT NULL,
  `ci_rif` varchar(20) NOT NULL,
  `cuenta_bancaria` varchar(50) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `direccion` text,
  `tipo_proveedor` enum('servicio','bienes','ambos') DEFAULT 'ambos',
  `activo` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `proyectos`
--

CREATE TABLE `proyectos` (
  `id` int(11) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `descripcion` text,
  `cliente` varchar(200) DEFAULT NULL,
  `presupuesto` decimal(15,2) DEFAULT '0.00',
  `fecha_inicio` date DEFAULT NULL,
  `fecha_fin` date DEFAULT NULL,
  `estado` enum('Activo','Pausado','Completado','Cancelado') DEFAULT 'Activo',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

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
  `justificacion` text,
  `monto_estimado` decimal(15,2) NOT NULL,
  `moneda` enum('USD','BS','EUR') DEFAULT 'USD',
  `estado` enum('Pendiente','En_Revision','Aprobada','Rechazada','Pagada','Cerrada') DEFAULT 'Pendiente',
  `tipo_solicitud` enum('servicio','compra') NOT NULL DEFAULT 'compra',
  `requiere_cotizaciones` tinyint(1) NOT NULL DEFAULT '0',
  `direccion_entrega` text,
  `fecha_entrega` date DEFAULT NULL,
  `forma_pago` varchar(100) DEFAULT NULL,
  `orden_compra_id` int(11) DEFAULT NULL,
  `comentarios_rechazo` text,
  `aprobado_por` int(11) DEFAULT NULL,
  `fecha_aprobacion` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `solicitudes_pagos`
--

CREATE TABLE `solicitudes_pagos` (
  `id` int(11) NOT NULL,
  `codigo_solicitud` varchar(50) NOT NULL COMMENT 'Código generado: PAG-CGE-PAY-PROY_ID-AÑO-SECUENCIA',
  `proyecto_id` int(11) NOT NULL COMMENT 'ID del proyecto al que pertenece',
  `partida_id` int(11) DEFAULT NULL COMMENT 'ID de la partida presupuestaria',
  `solicitante_id` int(11) NOT NULL COMMENT 'ID del usuario que crea la solicitud',
  `concepto` varchar(255) NOT NULL COMMENT 'Concepto del pago',
  `descripcion` text COMMENT 'Descripción detallada del pago',
  `monto_solicitado` decimal(15,2) NOT NULL COMMENT 'Monto total solicitado',
  `moneda` varchar(10) DEFAULT 'USD' COMMENT 'Moneda del pago',
  `fecha_solicitud` date NOT NULL COMMENT 'Fecha de creación de la solicitud',
  `fecha_requerida` date NOT NULL COMMENT 'Fecha en que se requiere el pago',
  `beneficiario` varchar(200) NOT NULL COMMENT 'Nombre del beneficiario',
  `documento_beneficiario` varchar(50) DEFAULT NULL COMMENT 'RIF/CI del beneficiario',
  `cuenta_beneficiario` varchar(50) DEFAULT NULL COMMENT 'Número de cuenta bancaria',
  `banco_beneficiario` varchar(100) DEFAULT NULL COMMENT 'Nombre del banco del beneficiario',
  `forma_pago` varchar(50) DEFAULT 'Transferencia' COMMENT 'Forma de pago: Transferencia, Cheque, Pago Movil, Efectivo',
  `prioridad` enum('Baja','Media','Alta','Urgente') DEFAULT 'Media' COMMENT 'Prioridad de la solicitud',
  `estado` enum('Pendiente','En_Revision','Aprobada','Rechazada','Pagada','Cerrada') DEFAULT 'Pendiente' COMMENT 'Estado actual de la solicitud',
  `fecha_aprobacion` date DEFAULT NULL COMMENT 'Fecha de aprobación/rechazo',
  `fecha_pago` date DEFAULT NULL COMMENT 'Fecha en que se registró el pago',
  `fecha_cierre` date DEFAULT NULL COMMENT 'Fecha en que se cerró la solicitud',
  `es_honorario` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = Pago de honorarios/terceros, 0 = Pago normal',
  `usuario_beneficiario_id` int(11) DEFAULT NULL COMMENT 'ID del usuario beneficiario (para honorarios)',
  `monto_honorarios` decimal(15,2) DEFAULT NULL COMMENT 'Monto de honorarios configurado para el usuario',
  `tipo_contrato` varchar(50) DEFAULT NULL COMMENT 'Tipo de contrato: Honorarios, Servicios, Consultoria, etc.',
  `pago_registrado` tinyint(1) DEFAULT '0' COMMENT '1 = Pago ya registrado',
  `comprobante_pago` varchar(255) DEFAULT NULL COMMENT 'Ruta del comprobante de pago',
  `numero_transferencia` varchar(100) DEFAULT NULL COMMENT 'Número de transferencia bancaria',
  `banco_origen_id` int(11) DEFAULT NULL COMMENT 'ID del banco desde donde se realizó la transferencia',
  `transaccion_id` int(11) DEFAULT NULL COMMENT 'ID de la transacción de egreso generada al cerrar',
  `justificacion` text COMMENT 'Justificación del pago',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Solicitudes de pagos generales y honorarios';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `solicitud_detalles`
--

CREATE TABLE `solicitud_detalles` (
  `id` int(11) NOT NULL,
  `solicitud_id` int(11) NOT NULL,
  `descripcion` varchar(300) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT '1',
  `precio_unitario` decimal(15,2) NOT NULL,
  `total` decimal(15,2) NOT NULL,
  `partida_id` int(11) DEFAULT NULL,
  `proveedor_sugerido` varchar(200) DEFAULT NULL,
  `observaciones` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `transacciones`
--

CREATE TABLE `transacciones` (
  `id` int(11) NOT NULL,
  `proyecto_id` int(11) DEFAULT NULL,
  `partida_id` int(11) DEFAULT NULL,
  `banco_id` int(11) NOT NULL,
  `tipo` enum('Ingreso','Egreso') NOT NULL,
  `monto` decimal(15,2) NOT NULL,
  `moneda` enum('USD','BS','EUR') DEFAULT 'USD',
  `tasa_cambio` decimal(10,4) DEFAULT '1.0000',
  `concepto` varchar(300) NOT NULL,
  `fecha_transaccion` date NOT NULL,
  `numero_documento` varchar(50) DEFAULT NULL,
  `beneficiario` varchar(200) DEFAULT NULL,
  `descripcion` text,
  `metodo_pago` enum('Transferencia','Efectivo','Cheque','Tarjeta') DEFAULT 'Transferencia',
  `status` enum('Pendiente','Completado','Cancelado') DEFAULT 'Completado',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  `fecha_registro` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `descripcion` text,
  `usuario_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

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
  `fecha_creacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `telefono` varchar(11) DEFAULT NULL,
  `foto` longblob,
  `foto_tipo` varchar(10) DEFAULT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `cargo` varchar(100) DEFAULT NULL,
  `departamento` varchar(100) DEFAULT NULL,
  `TipoSangre` varchar(3) DEFAULT NULL,
  `Alergias` varchar(50) DEFAULT NULL,
  `Medicinas` varchar(50) DEFAULT NULL,
  `politicas_aceptadas` tinyint(1) NOT NULL DEFAULT '0',
  `Activo` tinyint(4) NOT NULL DEFAULT '1',
  `debe_cambiar_password` tinyint(4) NOT NULL DEFAULT '1',
  `fecha_actualizacion` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario_proyecto`
--

CREATE TABLE `usuario_proyecto` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `proyecto_id` int(11) NOT NULL,
  `rol_proyecto` enum('manager','miembro','observador') DEFAULT 'miembro',
  `fecha_asignacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `activo` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
-- Indices de la tabla `control_correlativos`
--
ALTER TABLE `control_correlativos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unico_control` (`subproceso_origen`,`subproceso_destino`,`tipo_documento`,`anio`);

--
-- Indices de la tabla `cotizaciones`
--
ALTER TABLE `cotizaciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `solicitud_id` (`solicitud_id`),
  ADD KEY `proveedor_id` (`proveedor_id`);

--
-- Indices de la tabla `datos_pago_usuarios`
--
ALTER TABLE `datos_pago_usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_usuario_id` (`usuario_id`),
  ADD KEY `idx_banco` (`banco`),
  ADD KEY `idx_tipo_cuenta` (`tipo_cuenta`),
  ADD KEY `idx_es_tercero` (`es_tercero`);

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
-- Indices de la tabla `historial_pagos`
--
ALTER TABLE `historial_pagos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_solicitud` (`solicitud_id`),
  ADD KEY `idx_usuario` (`usuario_id`),
  ADD KEY `idx_estado_nuevo` (`estado_nuevo`),
  ADD KEY `idx_fecha` (`created_at`);

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
-- Indices de la tabla `ordenes_compra`
--
ALTER TABLE `ordenes_compra`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `codigo_oc` (`codigo_oc`),
  ADD KEY `solicitud_id` (`solicitud_id`),
  ADD KEY `proveedor_id` (`proveedor_id`),
  ADD KEY `aprobado_por` (`aprobado_por`);

--
-- Indices de la tabla `orden_compra_items`
--
ALTER TABLE `orden_compra_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `orden_compra_id` (`orden_compra_id`);

--
-- Indices de la tabla `pagos_detalles`
--
ALTER TABLE `pagos_detalles`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_solicitud` (`solicitud_id`),
  ADD KEY `idx_periodo` (`periodo`);

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
-- Indices de la tabla `proveedores`
--
ALTER TABLE `proveedores`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ci_rif` (`ci_rif`);

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
  ADD KEY `idx_solicitudes_prioridad` (`prioridad`,`estado`),
  ADD KEY `orden_compra_id` (`orden_compra_id`),
  ADD KEY `idx_tipo_solicitud` (`tipo_solicitud`),
  ADD KEY `idx_requiere_cotizaciones` (`requiere_cotizaciones`),
  ADD KEY `idx_fecha_entrega` (`fecha_entrega`);

--
-- Indices de la tabla `solicitudes_pagos`
--
ALTER TABLE `solicitudes_pagos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `codigo_solicitud` (`codigo_solicitud`),
  ADD KEY `partida_id` (`partida_id`),
  ADD KEY `solicitante_id` (`solicitante_id`),
  ADD KEY `banco_origen_id` (`banco_origen_id`),
  ADD KEY `idx_proyecto` (`proyecto_id`),
  ADD KEY `idx_estado` (`estado`),
  ADD KEY `idx_fecha_solicitud` (`fecha_solicitud`),
  ADD KEY `idx_beneficiario` (`beneficiario`(191)),
  ADD KEY `idx_usuario_beneficiario` (`usuario_beneficiario_id`),
  ADD KEY `idx_es_honorario` (`es_honorario`),
  ADD KEY `idx_transaccion` (`transaccion_id`),
  ADD KEY `idx_codigo` (`codigo_solicitud`);

--
-- Indices de la tabla `solicitud_detalles`
--
ALTER TABLE `solicitud_detalles`
  ADD PRIMARY KEY (`id`),
  ADD KEY `solicitud_id` (`solicitud_id`),
  ADD KEY `partida_id` (`partida_id`);

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
  ADD KEY `idx_proyecto_tipo` (`proyecto_id`,`tipo`);

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `bancos`
--
ALTER TABLE `bancos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `control_correlativos`
--
ALTER TABLE `control_correlativos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `cotizaciones`
--
ALTER TABLE `cotizaciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `datos_pago_usuarios`
--
ALTER TABLE `datos_pago_usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `detalles_solicitud`
--
ALTER TABLE `detalles_solicitud`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=46;

--
-- AUTO_INCREMENT de la tabla `donantes`
--
ALTER TABLE `donantes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `historial_pagos`
--
ALTER TABLE `historial_pagos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `historial_solicitud`
--
ALTER TABLE `historial_solicitud`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=45;

--
-- AUTO_INCREMENT de la tabla `log_proyectos`
--
ALTER TABLE `log_proyectos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `noticias`
--
ALTER TABLE `noticias`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT de la tabla `ordenes_compra`
--
ALTER TABLE `ordenes_compra`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT de la tabla `orden_compra_items`
--
ALTER TABLE `orden_compra_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT de la tabla `pagos_detalles`
--
ALTER TABLE `pagos_detalles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `pagos_solicitud`
--
ALTER TABLE `pagos_solicitud`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT de la tabla `partidas`
--
ALTER TABLE `partidas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=131;

--
-- AUTO_INCREMENT de la tabla `proyectos`
--
ALTER TABLE `proyectos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `proyecto_donante`
--
ALTER TABLE `proyecto_donante`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `solicitudes_compras`
--
ALTER TABLE `solicitudes_compras`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT de la tabla `solicitudes_pagos`
--
ALTER TABLE `solicitudes_pagos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `solicitud_detalles`
--
ALTER TABLE `solicitud_detalles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `transacciones`
--
ALTER TABLE `transacciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=384;

--
-- AUTO_INCREMENT de la tabla `transacciones_banco`
--
ALTER TABLE `transacciones_banco`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=107;

--
-- AUTO_INCREMENT de la tabla `usuario_proyecto`
--
ALTER TABLE `usuario_proyecto`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

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
-- Filtros para la tabla `cotizaciones`
--
ALTER TABLE `cotizaciones`
  ADD CONSTRAINT `cotizaciones_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_compras` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `cotizaciones_ibfk_2` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores` (`id`);

--
-- Filtros para la tabla `datos_pago_usuarios`
--
ALTER TABLE `datos_pago_usuarios`
  ADD CONSTRAINT `datos_pago_usuarios_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `detalles_solicitud`
--
ALTER TABLE `detalles_solicitud`
  ADD CONSTRAINT `detalles_solicitud_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_compras` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `historial_pagos`
--
ALTER TABLE `historial_pagos`
  ADD CONSTRAINT `historial_pagos_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_pagos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `historial_pagos_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

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
-- Filtros para la tabla `orden_compra_items`
--
ALTER TABLE `orden_compra_items`
  ADD CONSTRAINT `orden_compra_items_ibfk_1` FOREIGN KEY (`orden_compra_id`) REFERENCES `ordenes_compra` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `pagos_detalles`
--
ALTER TABLE `pagos_detalles`
  ADD CONSTRAINT `pagos_detalles_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_pagos` (`id`) ON DELETE CASCADE;

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
-- Filtros para la tabla `solicitudes_pagos`
--
ALTER TABLE `solicitudes_pagos`
  ADD CONSTRAINT `solicitudes_pagos_ibfk_1` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`),
  ADD CONSTRAINT `solicitudes_pagos_ibfk_2` FOREIGN KEY (`partida_id`) REFERENCES `partidas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `solicitudes_pagos_ibfk_3` FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `solicitudes_pagos_ibfk_4` FOREIGN KEY (`usuario_beneficiario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `solicitudes_pagos_ibfk_5` FOREIGN KEY (`banco_origen_id`) REFERENCES `bancos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `solicitudes_pagos_ibfk_6` FOREIGN KEY (`transaccion_id`) REFERENCES `transacciones` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `solicitud_detalles`
--
ALTER TABLE `solicitud_detalles`
  ADD CONSTRAINT `solicitud_detalles_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_compras` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `solicitud_detalles_ibfk_2` FOREIGN KEY (`partida_id`) REFERENCES `partidas` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `transacciones`
--
ALTER TABLE `transacciones`
  ADD CONSTRAINT `transacciones_ibfk_1` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `transacciones_ibfk_2` FOREIGN KEY (`partida_id`) REFERENCES `partidas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `transacciones_ibfk_3` FOREIGN KEY (`banco_id`) REFERENCES `bancos` (`id`) ON DELETE CASCADE;

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
