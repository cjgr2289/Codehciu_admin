<?php
/**
 * API para Registrar Pago de Solicitud de Pago
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
if (in_array($rol, ['admin', 'administrador', 'contab', 'contador'])) $rolNormalizado = 'admin';

if (!in_array($rolNormalizado, ['admin', 'contab'])) {
    echo json_encode(['success' => false, 'message' => 'No tiene permisos']);
    exit;
}

// Obtener datos (pueden venir como JSON o FormData)
$input = json_decode(file_get_contents('php://input'), true);

// Si es FormData, obtener datos de $_POST
if (empty($input)) {
    $solicitud_id = $_POST['solicitud_id'] ?? 0;
    $banco_origen_id = $_POST['banco_origen_id'] ?? 0;
    $numero_transferencia = $_POST['numero_transferencia'] ?? '';
    $fecha_pago = $_POST['fecha_pago'] ?? date('Y-m-d');
    $monto_pagado = $_POST['monto_pagado'] ?? 0;
} else {
    $solicitud_id = $input['solicitud_id'] ?? 0;
    $banco_origen_id = $input['banco_origen_id'] ?? 0;
    $numero_transferencia = $input['numero_transferencia'] ?? '';
    $fecha_pago = $input['fecha_pago'] ?? date('Y-m-d');
    $monto_pagado = $input['monto_pagado'] ?? 0;
}

if (!$solicitud_id) {
    echo json_encode(['success' => false, 'message' => 'ID de solicitud de pago no proporcionado']);
    exit;
}

try {
    $pdo->beginTransaction();
    
    // Verificar solicitud de pago
    $check = $pdo->prepare("SELECT estado, monto_solicitado, proyecto_id, partida_id, beneficiario FROM solicitudes_pagos WHERE id = ?");
    $check->execute([$solicitud_id]);
    $solicitud = $check->fetch();
    
    if (!$solicitud) {
        throw new Exception('Solicitud de pago no encontrada');
    }
    
    if ($solicitud['estado'] !== 'Aprobada') {
        throw new Exception('La solicitud de pago debe estar aprobada para registrar el pago');
    }
    
    if (!$banco_origen_id || !$numero_transferencia) {
        throw new Exception('Banco y número de transferencia son requeridos');
    }
    
    // Si no se especifica monto, usar el solicitado
    if ($monto_pagado <= 0) {
        $monto_pagado = $solicitud['monto_solicitado'];
    }
    
    // Actualizar solicitud de pago
    $update = $pdo->prepare("
        UPDATE solicitudes_pagos 
        SET estado = 'Pagada',
            pago_registrado = TRUE,
            numero_transferencia = :numero,
            banco_origen_id = :banco_id,
            fecha_pago = :fecha_pago
        WHERE id = :id
    ");
    $update->execute([
        ':numero' => $numero_transferencia,
        ':banco_id' => $banco_origen_id,
        ':fecha_pago' => $fecha_pago,
        ':id' => $solicitud_id
    ]);
    
    // Subir comprobante si existe
    if (isset($_FILES['comprobante']) && $_FILES['comprobante']['error'] === UPLOAD_ERR_OK) {
        $upload_dir = '../uploads/comprobantes_pagos/';
        if (!is_dir($upload_dir)) mkdir($upload_dir, 0777, true);
        
        $extension = pathinfo($_FILES['comprobante']['name'], PATHINFO_EXTENSION);
        $nombre_archivo = 'PAGO-' . $solicitud_id . '-' . time() . '.' . $extension;
        $ruta_completa = $upload_dir . $nombre_archivo;
        
        if (move_uploaded_file($_FILES['comprobante']['tmp_name'], $ruta_completa)) {
            $update_comprobante = $pdo->prepare("
                UPDATE solicitudes_pagos 
                SET comprobante_pago = :ruta 
                WHERE id = :id
            ");
            $update_comprobante->execute([
                ':ruta' => 'uploads/comprobantes_pagos/' . $nombre_archivo,
                ':id' => $solicitud_id
            ]);
        }
    }
    
    // Historial
    $historial = $pdo->prepare("
        INSERT INTO historial_pagos (solicitud_id, usuario_id, estado_anterior, estado_nuevo, comentario)
        VALUES (?, ?, 'Aprobada', 'Pagada', ?)
    ");
    $historial->execute([
        $solicitud_id,
        $usuario_id,
        "Pago registrado - Transferencia #{$numero_transferencia}"
    ]);
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Pago registrado exitosamente',
        'solicitud_id' => $solicitud_id
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>