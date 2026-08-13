<?php
/**
 * API para Cerrar Solicitud de Compra y su Orden de Compra asociada
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
require_once 'email_config.php';

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
    echo json_encode(['success' => false, 'message' => 'No tiene permisos para cerrar solicitudes']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$solicitud_id = $input['solicitud_id'] ?? 0;
$observaciones = $input['observaciones'] ?? '';
$concepto_personalizado = $input['concepto'] ?? '';

if (!$solicitud_id) {
    echo json_encode(['success' => false, 'message' => 'ID de solicitud no proporcionado']);
    exit;
}

try {
    // Obtener datos de la solicitud y su OC
    $check_query = "
        SELECT sc.*, oc.id as oc_id, oc.codigo_oc, oc.monto_aprobado, oc.proveedor_id,
               oc.estado as estado_oc, pago.monto_pagado, pago.banco_origen_id,
               pago.beneficiario, pago.numero_transferencia
        FROM solicitudes_compras sc
        LEFT JOIN ordenes_compra oc ON sc.orden_compra_id = oc.id
        LEFT JOIN pagos_solicitud pago ON sc.id = pago.solicitud_id
        WHERE sc.id = :id AND sc.estado = 'Pagada'
    ";
    $check_stmt = $pdo->prepare($check_query);
    $check_stmt->execute([':id' => $solicitud_id]);
    $solicitud = $check_stmt->fetch();
    
    if (!$solicitud) {
        throw new Exception('La solicitud no está pagada o no existe');
    }
    
    $pdo->beginTransaction();
    
    // Usar concepto personalizado
    $concepto = !empty($concepto_personalizado) 
        ? $concepto_personalizado 
        : "Egreso por OC: {$solicitud['codigo_oc']} - {$solicitud['descripcion']}";
    
    $numero_documento = $solicitud['numero_transferencia'] ?? 'OC-' . $solicitud['codigo_oc'];
    $descripcion_egreso = "Egreso vinculado a OC {$solicitud['codigo_oc']} - {$observaciones}";
    
    // Crear egreso
    $egreso_query = "
        INSERT INTO transacciones (
            proyecto_id, partida_id, banco_id, tipo, monto, moneda, concepto,
            fecha_transaccion, numero_documento, beneficiario, descripcion,
            metodo_pago, status, created_by, solicitud_id
        ) VALUES (
            :proyecto_id, :partida_id, :banco_id, 'Egreso', :monto, 'USD', :concepto,
            CURDATE(), :numero_documento, :beneficiario, :descripcion,
            'Transferencia', 'Completado', :created_by, :solicitud_id
        )
    ";
    
    $egreso_stmt = $pdo->prepare($egreso_query);
    $egreso_stmt->execute([
        ':proyecto_id' => $solicitud['proyecto_id'],
        ':partida_id' => $solicitud['partida_id'],
        ':banco_id' => $solicitud['banco_origen_id'],
        ':monto' => $solicitud['monto_pagado'],
        ':concepto' => $concepto,
        ':numero_documento' => $numero_documento,
        ':beneficiario' => $solicitud['beneficiario'],
        ':descripcion' => $descripcion_egreso,
        ':created_by' => $usuario_id,
        ':solicitud_id' => $solicitud_id
    ]);
    
    $transaccion_id = $pdo->lastInsertId();
    
    // Cerrar solicitud
    $update_solicitud = $pdo->prepare("UPDATE solicitudes_compras SET estado = 'Cerrada' WHERE id = :id");
    $update_solicitud->execute([':id' => $solicitud_id]);
    
    // Cerrar orden de compra
    if ($solicitud['oc_id']) {
        $update_oc = $pdo->prepare("UPDATE ordenes_compra SET estado = 'Cerrada' WHERE id = :id");
        $update_oc->execute([':id' => $solicitud['oc_id']]);
    }
    
    // Actualizar pago
    $update_pago = $pdo->prepare("UPDATE pagos_solicitud SET transaccion_id = :trans_id WHERE solicitud_id = :sol_id");
    $update_pago->execute([
        ':trans_id' => $transaccion_id,
        ':sol_id' => $solicitud_id
    ]);
    
    // Historial
    $historial = $pdo->prepare("
        INSERT INTO historial_solicitud (solicitud_id, usuario_id, estado_anterior, estado_nuevo, comentario)
        VALUES (:id, :usuario, 'Pagada', 'Cerrada', :comentario)
    ");
    $comentario_cierre = "Solicitud cerrada. OC: {$solicitud['codigo_oc']}. Egreso #$transaccion_id. " . $observaciones;
    $historial->execute([
        ':id' => $solicitud_id,
        ':usuario' => $usuario_id,
        ':comentario' => $comentario_cierre
    ]);
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Solicitud y Orden de Compra cerradas exitosamente',
        'transaccion_id' => $transaccion_id,
        'orden_compra' => $solicitud['codigo_oc']
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>