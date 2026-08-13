<?php
/**
 * API para Obtener Detalles de Solicitud de Pago
 * CODEHCIU - Sistema de Finanzas
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
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

$id = $_GET['id'] ?? 0;
$simple = $_GET['simple'] ?? false;

if (!$id) {
    echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
    exit;
}

try {
    $query = "
        SELECT sp.*, 
               u.nombre as solicitante_nombre, u.email as solicitante_email,
               p.nombre as proyecto_nombre, p.id as proyecto_id,
               b.nombre as banco_nombre,
               ub.nombre as usuario_beneficiario_nombre
        FROM solicitudes_pagos sp
        LEFT JOIN usuarios u ON sp.solicitante_id = u.id
        LEFT JOIN proyectos p ON sp.proyecto_id = p.id
        LEFT JOIN bancos b ON sp.banco_origen_id = b.id
        LEFT JOIN usuarios ub ON sp.usuario_beneficiario_id = ub.id
        WHERE sp.id = :id
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([':id' => $id]);
    $solicitud = $stmt->fetch();
    
    if (!$solicitud) {
        echo json_encode(['success' => false, 'message' => 'Solicitud no encontrada']);
        exit;
    }
    
    if ($simple) {
        echo json_encode(['success' => true, 'solicitud' => $solicitud]);
        exit;
    }
    
    // Obtener detalles de pago
    $detalles = $pdo->prepare("SELECT * FROM pagos_detalles WHERE solicitud_id = :id ORDER BY id");
    $detalles->execute([':id' => $id]);
    $solicitud['detalles'] = $detalles->fetchAll();
    
    // Obtener historial
    $historial = $pdo->prepare("
        SELECT h.*, u.nombre as usuario_nombre
        FROM historial_pagos h
        LEFT JOIN usuarios u ON h.usuario_id = u.id
        WHERE h.solicitud_id = :id
        ORDER BY h.created_at DESC
    ");
    $historial->execute([':id' => $id]);
    $solicitud['historial'] = $historial->fetchAll();
    
    echo json_encode(['success' => true, 'solicitud' => $solicitud]);
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>