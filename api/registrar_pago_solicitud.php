<?php
/**
 * API para Registrar Pago de Orden de Compra
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

$permiso = false;
if ($rol === 'admin' || $rol === 'administrador' || $rol === 'directivo') {
    $permiso = true;
}

if (!$permiso) {
    echo json_encode(['success' => false, 'message' => 'No tiene permisos para registrar pagos']);
    exit;
}

$solicitud_id = $_POST['solicitud_id'] ?? 0;
$orden_compra_id = $_POST['orden_compra_id'] ?? 0;
$banco_id = $_POST['banco_id'] ?? 0;
$numero_transferencia = $_POST['numero_transferencia'] ?? '';
$monto = $_POST['monto'] ?? 0;
$fecha_pago = $_POST['fecha_pago'] ?? date('Y-m-d');
$beneficiario = $_POST['beneficiario'] ?? '';
$documento = $_POST['documento'] ?? '';
$cuenta_destino = $_POST['cuenta_destino'] ?? '';
$observaciones = $_POST['observaciones'] ?? '';

if (!$solicitud_id || !$orden_compra_id || !$banco_id || !$numero_transferencia || !$monto || !$beneficiario) {
    echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
    exit;
}

try {
    // Obtener datos de la solicitud y orden de compra
    $solicitud_query = "
        SELECT sc.*, oc.codigo_oc, oc.monto_aprobado, oc.proveedor_id,
               u.nombre as solicitante_nombre, u.email as solicitante_email,
               p.nombre as proyecto_nombre, pr.nombre as proveedor_nombre,
               pr.ci_rif as proveedor_rif, pr.cuenta_bancaria
        FROM solicitudes_compras sc
        LEFT JOIN ordenes_compra oc ON sc.orden_compra_id = oc.id
        LEFT JOIN usuarios u ON sc.solicitante_id = u.id
        LEFT JOIN proyectos p ON sc.proyecto_id = p.id
        LEFT JOIN proveedores pr ON oc.proveedor_id = pr.id
        WHERE sc.id = :id
    ";
    $stmt = $pdo->prepare($solicitud_query);
    $stmt->execute([':id' => $solicitud_id]);
    $solicitud = $stmt->fetch();
    
    if (!$solicitud) {
        throw new Exception('Solicitud no encontrada');
    }
    
    if ($solicitud['estado'] !== 'Aprobada') {
        throw new Exception('La solicitud no está aprobada');
    }
    
    if ($solicitud['orden_compra_id'] != $orden_compra_id) {
        throw new Exception('La orden de compra no corresponde a esta solicitud');
    }
    
    // Verificar que el banco existe
    $banco_query = "SELECT nombre FROM bancos WHERE id = :id AND activo = 1";
    $banco_stmt = $pdo->prepare($banco_query);
    $banco_stmt->execute([':id' => $banco_id]);
    $banco = $banco_stmt->fetch();
    
    if (!$banco) {
        throw new Exception('Banco no encontrado');
    }
    
    // Procesar imagen
    $comprobante_foto = null;
    $comprobante_tipo = null;
    
    if (isset($_FILES['comprobante']) && $_FILES['comprobante']['error'] === UPLOAD_ERR_OK) {
        $file_tmp = $_FILES['comprobante']['tmp_name'];
        $file_content = file_get_contents($file_tmp);
        $comprobante_foto = $file_content;
        $comprobante_tipo = $_FILES['comprobante']['type'];
    }
    
    $pagador = getUsuarioById($pdo, $usuario_id);
    $pdo->beginTransaction();
    
    // Insertar pago
    $query = "
        INSERT INTO pagos_solicitud (
            solicitud_id, realizado_por, fecha_pago, monto_pagado, moneda,
            banco_origen_id, numero_transferencia, cuenta_destino, beneficiario,
            documento_beneficiario, comprobante_foto, comprobante_tipo, observaciones_pago
        ) VALUES (
            :solicitud_id, :realizado_por, :fecha_pago, :monto_pagado, 'USD',
            :banco_id, :numero_transferencia, :cuenta_destino, :beneficiario,
            :documento, :comprobante_foto, :comprobante_tipo, :observaciones
        )
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([
        ':solicitud_id' => $solicitud_id,
        ':realizado_por' => $usuario_id,
        ':fecha_pago' => $fecha_pago,
        ':monto_pagado' => $monto,
        ':banco_id' => $banco_id,
        ':numero_transferencia' => $numero_transferencia,
        ':cuenta_destino' => $cuenta_destino,
        ':beneficiario' => $beneficiario,
        ':documento' => $documento,
        ':comprobante_foto' => $comprobante_foto,
        ':comprobante_tipo' => $comprobante_tipo,
        ':observaciones' => $observaciones
    ]);
    
    $pago_id = $pdo->lastInsertId();
    
    // Actualizar estado de la solicitud a 'Pagada'
    $update_solicitud = $pdo->prepare("UPDATE solicitudes_compras SET estado = 'Pagada' WHERE id = :id");
    $update_solicitud->execute([':id' => $solicitud_id]);
    
    // Actualizar estado de la orden de compra
    $update_oc = $pdo->prepare("UPDATE ordenes_compra SET estado = 'Pagada' WHERE id = :id");
    $update_oc->execute([':id' => $orden_compra_id]);
    
    // Historial
    $historial = $pdo->prepare("
        INSERT INTO historial_solicitud (solicitud_id, usuario_id, estado_anterior, estado_nuevo, comentario)
        VALUES (:id, :usuario, 'Aprobada', 'Pagada', :comentario)
    ");
    $comentario_pago = "Pago registrado - OC: {$solicitud['codigo_oc']} - Transferencia: $numero_transferencia";
    $historial->execute([
        ':id' => $solicitud_id,
        ':usuario' => $usuario_id,
        ':comentario' => $comentario_pago
    ]);
    
    $pdo->commit();
    
    // Notificaciones
    $asunto_solicitante = "PAGO REGISTRADO - OC: {$solicitud['codigo_oc']}";
    $cuerpo_solicitante = "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
            <div style='background-color: #2ecc71; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;'>
                <h2 style='color: #fff; margin: 0;'>¡Pago Registrado!</h2>
            </div>
            <div style='background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px;'>
                <p><strong>Orden de Compra:</strong> {$solicitud['codigo_oc']}</p>
                <p><strong>Monto Pagado:</strong> $" . number_format($monto, 2, ',', '.') . "</p>
                <p><strong>Transferencia:</strong> {$numero_transferencia}</p>
                <p><strong>Beneficiario:</strong> {$beneficiario}</p>
                <hr>
                <p>El pago ha sido registrado exitosamente.</p>
            </div>
        </div>
    ";
    enviarCorreo($solicitud['solicitante_email'], $solicitud['solicitante_nombre'], $asunto_solicitante, $cuerpo_solicitante);
    
    // Notificar a contabilidad
    $contabEmails = getEmailsPorRol($pdo, 'contab');
    $asunto_contab = "PAGO REGISTRADO - {$solicitud['codigo_oc']} - PENDIENTE DE CIERRE";
    
    foreach ($contabEmails as $contab) {
        enviarCorreo($contab['email'], $contab['nombre'], $asunto_contab, $cuerpo_solicitante);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Pago registrado exitosamente',
        'pago_id' => $pago_id,
        'orden_compra' => $solicitud['codigo_oc']
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>