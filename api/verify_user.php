<?php
// api/verify_user.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Incluir la configuración de la base de datos
require_once("../config/database.php");

// Obtener el contenido JSON del cuerpo de la solicitud
$json = file_get_contents('php://input');
$data = json_decode($json, true);

// Verificar si se pudo decodificar el JSON correctamente
if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode(['success' => false, 'error' => 'JSON inválido en la solicitud']);
    exit;
}

$cedula = $data['cedula'] ?? '';

if (empty($cedula)) {
    echo json_encode(['success' => false, 'error' => 'No se proporcionó cédula']);
    exit;
}

try {
    // Usar la conexión PDO existente de tu configuración
    global $pdo;
    
    // Verificar si la conexión a la base de datos está disponible
    if (!$pdo) {
        throw new PDOException('No hay conexión a la base de datos');
    }
    
    $query = "SELECT nombre, cedula, cargo, activo FROM usuarios WHERE cedula = :cedula";
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':cedula', $cedula);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'user' => $user]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Usuario no encontrado']);
    }
} catch (PDOException $e) {
    error_log('Error en verify_user.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log('Error general en verify_user.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
?>