<?php
/**
 * API para Aprobar/Rechazar Solicitud de Pago
 * CODEHCIU - Sistema de Finanzas
 * VERSIÓN SIMPLIFICADA
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
if (in_array($rol, ['admin', 'administrador', 'directivo'])) $rolNormalizado = 'admin';
if (in_array($rol, ['contab', 'contador'])) $rolNormalizado = 'contab';

if (!in_array($rolNormalizado, ['admin', 'contab'])) {
    echo json_encode(['success' => false, 'message' => 'No tiene permisos para aprobar solicitudes de pago']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$solicitud_id = $input['solicitud_id'] ?? 0;
$decision = $input['decision'] ?? '';
$comentario = $input['comentario'] ?? '';

if (!$solicitud_id || !$decision) {
    echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
    exit;
}

if (!in_array($decision, ['Aprobada', 'Rechazada'])) {
    echo json_encode(['success' => false, 'message' => 'Decisión no válida']);
    exit;
}

try {
    $pdo->beginTransaction();
    
    // Obtener estado actual
    $check = $pdo->prepare("SELECT estado, solicitante_id, codigo_solicitud, concepto FROM solicitudes_pagos WHERE id = ?");
    $check->execute([$solicitud_id]);
    $solicitud = $check->fetch();
    
    if (!$solicitud) {
        throw new Exception('Solicitud no encontrada');
    }
    
    if ($solicitud['estado'] !== 'Pendiente' && $solicitud['estado'] !== 'En_Revision') {
        throw new Exception('La solicitud ya fue procesada');
    }
    
    $estado_anterior = $solicitud['estado'];
    
    // ✅ VERSIÓN SIMPLIFICADA - Actualizar en dos pasos
    // Paso 1: Actualizar estado
    $update = $pdo->prepare("UPDATE solicitudes_pagos SET estado = ? WHERE id = ?");
    $update->execute([$decision, $solicitud_id]);
    
    // Paso 2: Actualizar fecha de aprobación si es necesario
    if ($decision === 'Aprobada') {
        $updateFecha = $pdo->prepare("UPDATE solicitudes_pagos SET fecha_aprobacion = CURDATE() WHERE id = ?");
        $updateFecha->execute([$solicitud_id]);
    }
    
    // ✅ Historial con marcadores ?
    $historial = $pdo->prepare("
        INSERT INTO historial_pagos (solicitud_id, usuario_id, estado_anterior, estado_nuevo, comentario)
        VALUES (?, ?, ?, ?, ?)
    ");
    $historial->execute([
        $solicitud_id,
        $usuario_id,
        $estado_anterior,
        $decision,
        $comentario ?: ($decision === 'Aprobada' ? 'Aprobada' : 'Rechazada')
    ]);
    
    $pdo->commit();
    
    // Enviar notificación al solicitante
    $solicitante = $pdo->prepare("SELECT email, nombre FROM usuarios WHERE id = ?");
    $solicitante->execute([$solicitud['solicitante_id']]);
    $user = $solicitante->fetch();
    
    $estado_texto = $decision === 'Aprobada' ? 'APROBADA' : 'RECHAZADA';
    $asunto = "Solicitud de Pago {$estado_texto} - {$solicitud['codigo_solicitud']}";
    
    $cuerpo = "
        <div style='font-family: Arial, sans-serif; max-width: 600px;'>
            <div style='background-color: " . ($decision === 'Aprobada' ? '#27ae60' : '#e74c3c') . "; padding: 20px; text-align: center;'>
                <h2 style='color: #fff;'>Solicitud de Pago {$estado_texto}</h2>
            </div>
            <div style='padding: 20px; border: 1px solid #dee2e6; border-top: none;'>
                <p><strong>Código:</strong> {$solicitud['codigo_solicitud']}</p>
                <p><strong>Concepto:</strong> {$solicitud['concepto']}</p>
                <p><strong>Estado:</strong> {$decision}</p>
                " . ($comentario ? "<p><strong>Comentario:</strong> {$comentario}</p>" : "") . "
            </div>
        </div>
    ";
    
    if ($user) {
        enviarCorreo($user['email'], $user['nombre'], $asunto, $cuerpo);
    }
    
    echo json_encode([
        'success' => true,
        'message' => "Solicitud de pago {$decision} exitosamente"
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error en aprobar_solicitud_pago.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>