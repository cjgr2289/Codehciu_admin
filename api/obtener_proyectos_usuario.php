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

$response = ['success' => false, 'proyectos' => [], 'message' => ''];

try {
    // Obtener datos del body
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input)) {
        $response['message'] = 'Datos no recibidos';
        echo json_encode($response);
        exit();
    }
    
    $usuario_id = $input['usuario_id'] ?? 0;
    
    if ($usuario_id <= 0) {
        $response['message'] = 'ID de usuario inválido';
        echo json_encode($response);
        exit();
    }
    
    $query = "SELECT p.* FROM proyectos p
              INNER JOIN usuario_proyecto up ON p.id = up.proyecto_id
              WHERE up.usuario_id = :usuario_id 
              AND up.activo = 1 
              AND p.estado = 'Activo'
              ORDER BY p.nombre";
    
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':usuario_id', $usuario_id, PDO::PARAM_INT);
    $stmt->execute();
    
    $proyectos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $response['success'] = true;
    $response['proyectos'] = $proyectos;
    $response['message'] = 'Proyectos cargados correctamente';
    $response['count'] = count($proyectos);
    
} catch (Exception $e) {
    $response['message'] = 'Error del servidor: ' . $e->getMessage();
    http_response_code(500);
}

echo json_encode($response);
?>