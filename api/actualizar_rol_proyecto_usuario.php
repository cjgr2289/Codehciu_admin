<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once __DIR__ . '/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$usuario_id = $input['usuario_id'] ?? 0;
$proyecto_id = $input['proyecto_id'] ?? 0;
$rol_proyecto = $input['rol_proyecto'] ?? null;

if (!$usuario_id || !$proyecto_id || !$rol_proyecto) {
    echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
    exit;
}

if (isset($pdo) && $pdo instanceof PDO) {
    $db = $pdo;
} else {
    if (class_exists('Database')) {
        $database = new Database();
        $db = $database->getConnection();
    } else {
        echo json_encode(['success' => false, 'message' => 'No hay conexión a la base de datos']);
        exit;
    }
}

try {
    $query = "UPDATE usuario_proyecto SET rol_proyecto = :rol WHERE usuario_id = :usuario_id AND proyecto_id = :proyecto_id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':rol', $rol_proyecto);
    $stmt->bindParam(':usuario_id', $usuario_id);
    $stmt->bindParam(':proyecto_id', $proyecto_id);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Rol actualizado correctamente']);
    } else {
        echo json_encode(['success' => false, 'message' => 'No se encontró la asignación o no hubo cambios']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>