<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

try {
    require_once __DIR__ . '/database.php';
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error al conectar a la base de datos', 'error' => $e->getMessage()]);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$usuario_id = $data['usuario_id'] ?? 0;
$proyecto_id = $data['proyecto_id'] ?? 0;
$rol_proyecto = $data['rol_proyecto'] ?? 'miembro';

if (!$usuario_id || !$proyecto_id) {
    echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
    exit;
}

// Compatibilidad: `api/database.php` expone $pdo (PDO). Si no existe, intentar clase Database.
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
    // Verificar si ya existe la asignación (inactiva o activa)
    $checkQuery = "SELECT id, activo FROM usuario_proyecto 
               WHERE usuario_id = :usuario_id AND proyecto_id = :proyecto_id LIMIT 1";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->bindParam(':usuario_id', $usuario_id, PDO::PARAM_INT);
    $checkStmt->bindParam(':proyecto_id', $proyecto_id, PDO::PARAM_INT);
    $checkStmt->execute();

    $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        if (!empty($existing['activo']) && intval($existing['activo']) === 1) {
            echo json_encode(['success' => false, 'message' => 'El usuario ya tiene asignado este proyecto']);
            exit;
        } else {
            // Reactivar asignación inactiva y actualizar rol y fecha
            $updateQuery = "UPDATE usuario_proyecto SET activo = 1, rol_proyecto = :rol_proyecto, fecha_asignacion = NOW() WHERE id = :id";
            $updateStmt = $db->prepare($updateQuery);
            $updateStmt->bindParam(':rol_proyecto', $rol_proyecto);
            $updateStmt->bindParam(':id', $existing['id'], PDO::PARAM_INT);
            if ($updateStmt->execute()) {
                echo json_encode(['success' => true, 'message' => 'Asignación reactivada correctamente']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Error al reactivar la asignación']);
            }
            exit;
        }
    }

    // Insertar nueva asignación
    $query = "INSERT INTO usuario_proyecto (usuario_id, proyecto_id, rol_proyecto) 
          VALUES (:usuario_id, :proyecto_id, :rol_proyecto)";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':usuario_id', $usuario_id, PDO::PARAM_INT);
    $stmt->bindParam(':proyecto_id', $proyecto_id, PDO::PARAM_INT);
    $stmt->bindParam(':rol_proyecto', $rol_proyecto);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Proyecto asignado correctamente']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error al asignar el proyecto']);
    }
} catch (Throwable $e) {
    error_log('asignar_proyecto_usuario error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error interno al asignar proyecto', 'error' => $e->getMessage()]);
    exit;
}
?>