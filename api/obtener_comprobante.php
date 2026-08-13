<?php
/**
 * API para Obtener Comprobante de Pago
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'database.php';

session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$id = $_GET['id'] ?? 0;

if (!$id) {
    echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
    exit;
}

try {
    // Buscar por ID del pago (es la columna 'id' en pagos_solicitud)
    $query = "SELECT comprobante_foto, comprobante_tipo, solicitud_id, numero_transferencia 
              FROM pagos_solicitud 
              WHERE id = :id";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':id' => $id]);
    $pago = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($pago && !empty($pago['comprobante_foto'])) {
        $base64 = base64_encode($pago['comprobante_foto']);
        $tipo = $pago['comprobante_tipo'] ?: 'image/jpeg';
        
        echo json_encode([
            'success' => true,
            'comprobante' => $base64,
            'tipo' => $tipo,
            'pago_id' => $id,
            'solicitud_id' => $pago['solicitud_id'],
            'transferencia' => $pago['numero_transferencia']
        ]);
    } else {
        echo json_encode([
            'success' => false, 
            'message' => 'No se encontró comprobante para este pago',
            'pago_id_buscado' => $id
        ]);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>