<?php
/**
 * API para Cerrar Solicitud de Pago y crear egreso en transacciones
 * CODEHCIU - Sistema de Finanzas
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

error_reporting(0);
ini_set('display_errors', 0);

require_once 'database.php';

session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$usuario_id = $_SESSION['user_id'];
$rol = strtolower($_SESSION['user_role'] ?? '');

$rolNormalizado = $rol;
if (in_array($rol, ['admin', 'administrador'])) $rolNormalizado = 'admin';
if (in_array($rol, ['contab', 'contador'])) $rolNormalizado = 'contab';

if (!in_array($rolNormalizado, ['admin', 'contab'])) {
    echo json_encode(['success' => false, 'message' => 'No tiene permisos para cerrar solicitudes de pago']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$solicitud_id = $input['solicitud_id'] ?? 0;
$observaciones = $input['observaciones'] ?? '';
$concepto_personalizado = $input['concepto'] ?? '';

// ✅ NUEVOS CAMPOS: moneda y tasa de cambio
$moneda_pago = $input['moneda'] ?? 'USD';
$tasa_cambio = isset($input['tasa_cambio']) ? floatval($input['tasa_cambio']) : 1.0000;

// Validar moneda
if (!in_array($moneda_pago, ['USD', 'BS', 'EUR'])) {
    $moneda_pago = 'USD';
}

// Validar tasa de cambio (mínimo 0.0001)
if ($tasa_cambio <= 0) {
    $tasa_cambio = 1.0000;
}

if (!$solicitud_id) {
    echo json_encode(['success' => false, 'message' => 'ID de solicitud de pago no proporcionado']);
    exit;
}

try {
    // Obtener datos de la solicitud de pago
    $query = "
        SELECT sp.*, 
               p.codigo as partida_codigo,
               p.nombre as partida_nombre
        FROM solicitudes_pagos sp
        LEFT JOIN partidas p ON sp.partida_id = p.id
        WHERE sp.id = :id AND sp.estado = 'Pagada'
    ";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':id' => $solicitud_id]);
    $solicitud = $stmt->fetch();
    
    if (!$solicitud) {
        throw new Exception('La solicitud de pago no está pagada o no existe');
    }
    
    // Validar que tenga partida
    if (empty($solicitud['partida_id'])) {
        throw new Exception('La solicitud de pago no tiene una partida asignada');
    }
    
    $pdo->beginTransaction();
    
    $concepto = !empty($concepto_personalizado) 
        ? $concepto_personalizado 
        : "Pago: {$solicitud['concepto']} - {$solicitud['beneficiario']}";
    
    // ✅ CORREGIDO: Usar SOLO las columnas que existen en la tabla transacciones
    // moneda y tasa_cambio son las columnas correctas
    $egreso_query = "
        INSERT INTO transacciones (
            proyecto_id, 
            partida_id, 
            banco_id, 
            tipo, 
            monto, 
            moneda, 
            tasa_cambio,
            concepto,
            fecha_transaccion, 
            numero_documento, 
            beneficiario, 
            descripcion,
            metodo_pago, 
            status, 
            created_by
        ) VALUES (
            :proyecto_id, 
            :partida_id, 
            :banco_id, 
            'Egreso', 
            :monto, 
            :moneda,
            :tasa_cambio,
            :concepto,
            CURDATE(), 
            :numero_documento, 
            :beneficiario, 
            :descripcion,
            'Transferencia', 
            'Completado', 
            :created_by
        )
    ";
    
    $egreso_stmt = $pdo->prepare($egreso_query);
    $egreso_stmt->execute([
        ':proyecto_id' => $solicitud['proyecto_id'],
        ':partida_id' => $solicitud['partida_id'],
        ':banco_id' => $solicitud['banco_origen_id'] ?? 1, // Si no tiene banco, usar 1
        ':monto' => $solicitud['monto_solicitado'],
        ':moneda' => $moneda_pago,
        ':tasa_cambio' => $tasa_cambio,
        ':concepto' => $concepto,
        ':numero_documento' => $solicitud['numero_transferencia'] ?? 'PAGO-' . $solicitud_id,
        ':beneficiario' => $solicitud['beneficiario'],
        ':descripcion' => "Pago aprobado - {$solicitud['concepto']} - " . $observaciones,
        ':created_by' => $usuario_id
    ]);
    
    $transaccion_id = $pdo->lastInsertId();
    
    // Actualizar saldo de la partida
    $update_saldo = $pdo->prepare("
        UPDATE partidas 
        SET presupuesto_actual = presupuesto_actual - ? 
        WHERE id = ?
    ");
    $update_saldo->execute([$solicitud['monto_solicitado'], $solicitud['partida_id']]);
    
    // Cerrar solicitud de pago
    $update_solicitud = $pdo->prepare("
        UPDATE solicitudes_pagos 
        SET estado = 'Cerrada', 
            fecha_cierre = NOW(),
            transaccion_id = :trans_id
        WHERE id = :id
    ");
    $update_solicitud->execute([
        ':trans_id' => $transaccion_id,
        ':id' => $solicitud_id
    ]);
    
    // Historial
    $historial = $pdo->prepare("
        INSERT INTO historial_pagos (solicitud_id, usuario_id, estado_anterior, estado_nuevo, comentario)
        VALUES (?, ?, 'Pagada', 'Cerrada', ?)
    ");
    $comentario = "Solicitud de pago cerrada. Transacción #$transaccion_id. Moneda: $moneda_pago, Tasa: $tasa_cambio. " . $observaciones;
    $historial->execute([$solicitud_id, $usuario_id, $comentario]);
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Solicitud de pago cerrada exitosamente',
        'transaccion_id' => $transaccion_id,
        'moneda' => $moneda_pago,
        'tasa_cambio' => $tasa_cambio
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>