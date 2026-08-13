<?php
// Establecer headers primero
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

// Configurar manejo de errores
error_reporting(E_ALL);
ini_set('display_errors', 0); // Desactivar display en producción, pero loguear

function sendError($message) {
    error_log("Auth Error: " . $message);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

// Verificar método
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Método no permitido');
}

// Obtener datos JSON
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    sendError('JSON inválido: ' . json_last_error_msg());
}

// Validar campos requeridos
if (empty($data['email']) || empty($data['password'])) {
    sendError('Email y contraseña son requeridos');
}

try {
    // Incluir base de datos
    require_once 'database.php';
    
    if (!isset($pdo)) {
        sendError('Error de configuración del servidor');
    }
    
    // Consulta usuario
    $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE email = ?");
    $stmt->execute([$data['email']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        sendError('Credenciales incorrectas');
    }
    
    if (!password_verify($data['password'], $user['password'])) {
        sendError('Credenciales incorrectas');
    }
    
    // Verificar si está activo: el campo Activo debe ser exactamente 1
    if (!isset($user['Activo']) || (int)$user['Activo'] !== 1) {
        sendError('Tu cuenta está desactivada. Contacta al administrador.');
    }
    
    // Iniciar sesión
    session_start();
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_name'] = $user['nombre'];
    $_SESSION['user_role'] = $user['rol'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['politicas_aceptadas'] = $user['politicas_aceptadas'];
    $_SESSION['debe_cambiar_password'] = $user['debe_cambiar_password'];

    // Respuesta exitosa
    echo json_encode([
        'success' => true, 
        'user' => [
            'id' => (int)$user['id'],
            'name' => $user['nombre'],
            'email' => $user['email'],
            'role' => $user['rol'],
            'politicas_aceptadas' => (bool)$user['politicas_aceptadas'],
            'debe_cambiar_password' => (bool)$user['debe_cambiar_password']
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Auth Exception: " . $e->getMessage());
    sendError('Error interno del servidor');
}
?>