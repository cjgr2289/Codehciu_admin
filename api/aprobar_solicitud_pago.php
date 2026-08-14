<?php
/**
 * API para Aprobar/Rechazar Solicitud de Pago
 * CODEHCIU - Sistema de Finanzas
 * Genera Orden de Pago (OP) al aprobar
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
    $check = $pdo->prepare("
        SELECT sp.*, p.nombre as proyecto_nombre 
        FROM solicitudes_pagos sp
        LEFT JOIN proyectos p ON sp.proyecto_id = p.id
        WHERE sp.id = ?
    ");
    $check->execute([$solicitud_id]);
    $solicitud = $check->fetch();
    
    if (!$solicitud) {
        throw new Exception('Solicitud no encontrada');
    }
    
    if ($solicitud['estado'] !== 'Pendiente' && $solicitud['estado'] !== 'En_Revision') {
        throw new Exception('La solicitud ya fue procesada');
    }
    
    $estado_anterior = $solicitud['estado'];
    
    // ✅ Generar código de Orden de Pago (OP) si es aprobada
    $codigo_op = null;
    $numero_op = null;
    
    if ($decision === 'Aprobada') {
        $anio = date('Y');
        $proyecto_id = $solicitud['proyecto_id'];
        $prefijo = 'OP-CGE-PAY-' . $proyecto_id . '-' . $anio . '-';
        
        $query = "SELECT COUNT(*) as total FROM solicitudes_pagos WHERE codigo_op LIKE ?";
        $stmt = $pdo->prepare($query);
        $stmt->execute([$prefijo . '%']);
        $row = $stmt->fetch();
        $numero = ($row['total'] ?? 0) + 1;
        $correlativo = str_pad($numero, 6, '0', STR_PAD_LEFT);
        $codigo_op = $prefijo . $correlativo;
        $numero_op = $correlativo;
    }
    
    // ✅ CORREGIDO: UPDATE simple sin IF anidado
    if ($decision === 'Aprobada') {
        $update = $pdo->prepare("
            UPDATE solicitudes_pagos 
            SET estado = ?,
                fecha_aprobacion = CURDATE(),
                codigo_op = ?,
                numero_op = ?
            WHERE id = ?
        ");
        $update->execute([
            $decision,
            $codigo_op,
            $numero_op,
            $solicitud_id
        ]);
    } else {
        // Rechazada - solo cambia estado y limpia campos de OP
        $update = $pdo->prepare("
            UPDATE solicitudes_pagos 
            SET estado = ?,
                fecha_aprobacion = NULL,
                codigo_op = NULL,
                numero_op = NULL
            WHERE id = ?
        ");
        $update->execute([
            $decision,
            $solicitud_id
        ]);
    }
    
    // Historial
    $historial = $pdo->prepare("
        INSERT INTO historial_pagos (solicitud_id, usuario_id, estado_anterior, estado_nuevo, comentario)
        VALUES (?, ?, ?, ?, ?)
    ");
    $historial->execute([
        $solicitud_id,
        $usuario_id,
        $estado_anterior,
        $decision,
        $comentario ?: ($decision === 'Aprobada' ? 'Aprobada - OP: ' . $codigo_op : 'Rechazada')
    ]);
    
    $pdo->commit();
    
    // Enviar notificación
    $solicitante = $pdo->prepare("SELECT email, nombre FROM usuarios WHERE id = ?");
    $solicitante->execute([$solicitud['solicitante_id']]);
    $user = $solicitante->fetch();
    
    $estado_texto = $decision === 'Aprobada' ? 'APROBADA' : 'RECHAZADA';
    $asunto = "Solicitud de Pago {$estado_texto} - {$solicitud['codigo_solicitud']}";
    
    $info_adicional = '';
    if ($decision === 'Aprobada' && $codigo_op) {
        $info_adicional = "<p><strong>Orden de Pago:</strong> {$codigo_op}</p>";
    }
    
    $cuerpo = "
        <div style='font-family: Arial, sans-serif; max-width: 600px;'>
            <div style='background-color: " . ($decision === 'Aprobada' ? '#27ae60' : '#e74c3c') . "; padding: 20px; text-align: center;'>
                <h2 style='color: #fff;'>Solicitud de Pago {$estado_texto}</h2>
            </div>
            <div style='padding: 20px; border: 1px solid #dee2e6; border-top: none;'>
                <p><strong>Código:</strong> {$solicitud['codigo_solicitud']}</p>
                <p><strong>Concepto:</strong> {$solicitud['concepto']}</p>
                <p><strong>Beneficiario:</strong> {$solicitud['beneficiario']}</p>
                <p><strong>Monto:</strong> $ " . number_format($solicitud['monto_solicitado'], 2, ',', '.') . "</p>
                {$info_adicional}
                " . ($comentario ? "<p><strong>Comentario:</strong> {$comentario}</p>" : "") . "
            </div>
        </div>
    ";
    
    if ($user) {
        enviarCorreo($user['email'], $user['nombre'], $asunto, $cuerpo);
    }
    
    echo json_encode([
        'success' => true,
        'message' => "Solicitud de pago {$decision} exitosamente",
        'codigo_op' => $codigo_op,
        'numero_op' => $numero_op
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error en aprobar_solicitud_pago.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>