<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'database.php';

$response = ['success' => false, 'tiene_acceso' => false, 'message' => ''];

try {
    // Obtener datos del body
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input)) {
        $response['message'] = 'Datos no recibidos';
        echo json_encode($response);
        exit();
    }
    
    $usuario_id = $input['usuario_id'] ?? 0;
    $proyecto_id = $input['proyecto_id'] ?? 0;
    
    if ($usuario_id <= 0 || $proyecto_id <= 0) {
        $response['message'] = 'IDs inválidos';
        echo json_encode($response);
        exit();
    }
    
    $query = "SELECT COUNT(*) as count FROM usuario_proyecto 
              WHERE usuario_id = :usuario_id 
              AND proyecto_id = :proyecto_id 
              AND activo = 1";
    
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':usuario_id', $usuario_id, PDO::PARAM_INT);
    $stmt->bindParam(':proyecto_id', $proyecto_id, PDO::PARAM_INT);
    $stmt->execute();
    
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $tieneAcceso = ($result['count'] > 0);
    
    $response['success'] = true;
    $response['tiene_acceso'] = $tieneAcceso;
    $response['message'] = $tieneAcceso ? 'Acceso permitido' : 'Acceso denegado';
    
} catch (Exception $e) {
    $response['message'] = 'Error del servidor: ' . $e->getMessage();
    http_response_code(500);
}

echo json_encode($response);
?>