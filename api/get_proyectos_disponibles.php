<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once __DIR__ . '/database.php';

session_start();

// Verificar autenticación (si tu flujo usa Authorization header)
$headers = getallheaders();
$token = str_replace('Bearer ', '', $headers['Authorization'] ?? '');

if (empty($token)) {
    // No bloqueamos aquí por compatibilidad; permitir que el endpoint sea consultado desde frontend con sesión
    // echo json_encode(['success' => false, 'message' => 'No autorizado']);
    // exit;
}

// Aceptar usuario_id por GET, POST o JSON body
$usuario_id = 0;
if (!empty($_GET['usuario_id'])) {
    $usuario_id = intval($_GET['usuario_id']);
} elseif (!empty($_POST['usuario_id'])) {
    $usuario_id = intval($_POST['usuario_id']);
} else {
    // intentar leer JSON
    $raw = file_get_contents('php://input');
    if ($raw) {
        $input = json_decode($raw, true);
        if (json_last_error() === JSON_ERROR_NONE && !empty($input['usuario_id'])) {
            $usuario_id = intval($input['usuario_id']);
        }
    }
}

if ($usuario_id <= 0) {
    echo json_encode(['success' => false, 'message' => 'ID de usuario requerido']);
    exit;
}

// Compatibilidad con `api/database.php`
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

// Obtener proyectos no asignados al usuario
$query = "SELECT p.* FROM proyectos p 
          WHERE p.estado = 'Activo' 
          AND p.id NOT IN (
              SELECT up.proyecto_id 
              FROM usuario_proyecto up 
              WHERE up.usuario_id = :usuario_id AND up.activo = 1
          )
          ORDER BY p.nombre";

try {
    $stmt = $db->prepare($query);
    $stmt->bindParam(':usuario_id', $usuario_id, PDO::PARAM_INT);
    $stmt->execute();

    $proyectos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'proyectos' => $proyectos
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al consultar proyectos',
        'error' => $e->getMessage()
    ]);
}
?>