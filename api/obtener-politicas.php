<?php
header('Content-Type: application/json');
require_once 'database.php';

// Validar que se reciba el ID de usuario
if (!isset($_GET['userId']) || !is_numeric($_GET['userId'])) {
    echo json_encode(['success' => false, 'error' => 'ID de usuario no válido']);
    exit;
}

$userId = (int)$_GET['userId'];

try {
    // Consulta preparada para obtener el estado de aceptación
    $query = "SELECT politicas_aceptadas FROM usuarios WHERE id = ?";
    $stmt = $pdo->prepare($query);
    $stmt->execute([$userId]);
    
    // Verificar si se encontró el usuario
    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch();
        $aceptado = (bool)$row['politicas_aceptadas'];
        
        echo json_encode([
            'success' => true,
            'aceptado' => $aceptado,
            'userId' => $userId
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Usuario no encontrado',
            'userId' => $userId
        ]);
    }
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Error de base de datos',
        'message' => $e->getMessage()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Error general',
        'message' => $e->getMessage()
    ]);
}
?>