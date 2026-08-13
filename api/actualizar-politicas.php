<?php
header('Content-Type: application/json');
require_once 'database.php';

// Permitir CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Debug: Log the received data
    error_log("Received data: " . print_r($input, true));
    
    // Validar que el userId existe y es numérico
    if (!isset($input['userId']) || !is_numeric($input['userId']) || $input['userId'] <= 0) {
        error_log("Invalid userId received: " . ($input['userId'] ?? 'NULL'));
        echo json_encode([
            'success' => false, 
            'error' => 'ID de usuario no válido',
            'received' => $input['userId'] ?? 'NULL'
        ]);
        exit;
    }
    
    $userId = (int)$input['userId'];
    $aceptado = isset($input['aceptado']) ? (bool)$input['aceptado'] : false;

    try {
        // Verificar que el usuario existe antes de actualizar
        $checkStmt = $pdo->prepare("SELECT id FROM usuarios WHERE id = ?");
        $checkStmt->execute([$userId]);
        
        if ($checkStmt->rowCount() === 0) {
            echo json_encode([
                'success' => false, 
                'error' => 'Usuario no encontrado',
                'userId' => $userId
            ]);
            exit;
        }
        
        // Actualizar las políticas
        $stmt = $pdo->prepare("UPDATE usuarios SET politicas_aceptadas = ? WHERE id = ?");
        $result = $stmt->execute([$aceptado ? 1 : 0, $userId]);
        
        if ($result) {
            echo json_encode([
                'success' => true, 
                'message' => 'Políticas actualizadas correctamente',
                'userId' => $userId,
                'aceptado' => $aceptado
            ]);
        } else {
            echo json_encode([
                'success' => false, 
                'error' => 'Error al actualizar políticas en la base de datos'
            ]);
        }
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        echo json_encode([
            'success' => false, 
            'error' => 'Error de base de datos: ' . $e->getMessage()
        ]);
    }
} else {
    echo json_encode([
        'success' => false, 
        'error' => 'Método no permitido'
    ]);
}
?>