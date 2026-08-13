<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once __DIR__ . '/database.php';

$usuario_id = $_GET['usuario_id'] ?? 0;

if (!$usuario_id) {
    echo json_encode(['success' => false, 'message' => 'ID de usuario requerido']);
    exit;
}

// `api/database.php` inicializa una conexión PDO en `$pdo`
if (isset($pdo) && $pdo instanceof PDO) {
    $db = $pdo;
} else {
    // Si no existe $pdo, intentar buscar una clase Database (compatibilidad)
    if (class_exists('Database')) {
        $database = new Database();
        $db = $database->getConnection();
    } else {
        echo json_encode(['success' => false, 'message' => 'No hay conexión a la base de datos']);
        exit;
    }
}

$query = "SELECT p.*, up.rol_proyecto, up.fecha_asignacion 
          FROM usuario_proyecto up
          INNER JOIN proyectos p ON up.proyecto_id = p.id
          WHERE up.usuario_id = :usuario_id AND up.activo = 1
          ORDER BY up.fecha_asignacion DESC";

$stmt = $db->prepare($query);
$stmt->bindParam(':usuario_id', $usuario_id);
$stmt->execute();

$proyectos = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'success' => true,
    'proyectos' => $proyectos
]);
?>