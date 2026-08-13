<?php
// Habilitar logging de errores
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

header('Content-Type: application/json');
require_once 'database.php';

// Permitir CORS (solo para desarrollo)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

try {
    // Verificar método HTTP
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido');
    }
    
    // Obtener y validar datos JSON
    $jsonInput = file_get_contents('php://input');
    if (empty($jsonInput)) {
        throw new Exception('No se recibieron datos');
    }
    
    $data = json_decode($jsonInput, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('JSON inválido: ' . json_last_error_msg());
    }
    
    // Validar campos requeridos
    if (empty($data['email']) || empty($data['password'])) {
        throw new Exception('Email y contraseña son requeridos');
    }

    // Buscar usuario en la base de datos
    $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE email = ?");
    $stmt->execute([$data['email']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user && password_verify($data['password'], $user['password'])) {
        // Iniciar sesión y devolver datos de usuario
        session_start();
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_name'] = $user['nombre'];
        $_SESSION['user_role'] = $user['rol'];
        $_SESSION['user_email'] = $user['email'];
        $_SESSION['politicas_aceptadas'] = $user['politicas_aceptadas'];

        echo json_encode([
            'success' => true, 
            'user' => [
                'id' => $user['id'],
                'name' => $user['nombre'],
                'role' => $user['rol'],
                'politicasAceptadas' => (bool)$user['politicas_aceptadas']
            ]
        ]);
    } else {
        echo json_encode([
            'success' => false, 
            'message' => 'Credenciales incorrectas'
        ]);
    }
    
} catch (PDOException $e) {
    error_log("Database error in auth.php: " . $e->getMessage());
    echo json_encode([
        'success' => false, 
        'message' => 'Error en la base de datos'
    ]);
} catch (Exception $e) {
    error_log("General error in auth.php: " . $e->getMessage());
    echo json_encode([
        'success' => false, 
        'message' => $e->getMessage()
    ]);
}
?>