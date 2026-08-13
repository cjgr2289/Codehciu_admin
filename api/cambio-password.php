<?php
// cambio-password.php - API específica para cambio de contraseña de usuarios

// Headers para JSON y CORS
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/database.php';

function sendJsonResponse($success, $message = '', $data = []) {
    $response = ['success' => $success];
    if ($success) {
        $response['message'] = $message;
        if (!empty($data)) $response['data'] = $data;
    } else {
        $response['error'] = $message;
    }
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit();
}

// Leer datos JSON del request
$input = json_decode(file_get_contents("php://input"), true);
if (!$input) {
    http_response_code(400);
    sendJsonResponse(false, "No se recibieron datos válidos");
}

$user_id        = $input['user_id'] ?? null;
$new_password   = $input['new_password'] ?? null;
$is_first_time  = $input['is_first_time'] ?? false;
$is_admin_action = $input['is_admin_action'] ?? false;

if (!$user_id || !$new_password) {
    http_response_code(400);
    sendJsonResponse(false, "Faltan datos requeridos");
}

// Validar longitud mínima de contraseña
if (strlen($new_password) < 8) {
    http_response_code(400);
    sendJsonResponse(false, "La contraseña debe tener al menos 8 caracteres");
}

try {
    // Verificar que el usuario existe
    $stmt = $pdo->prepare("SELECT id, nombre FROM usuarios WHERE id = :id");
    $stmt->execute([':id' => $user_id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        sendJsonResponse(false, "Usuario no encontrado");
    }

    // Hashear la nueva contraseña
    $hashed = password_hash($new_password, PASSWORD_BCRYPT);
    
    // Determinar el valor de debe_cambiar_password
    // - Si es acción de admin: TRUE (el usuario debe cambiar en próximo login)
    // - Si es primer inicio: FALSE (ya se está cambiando)
    // - Si es usuario cambiando propia: FALSE (cambio normal)
    $debe_cambiar_password = $is_admin_action ? 1 : 0;

    // Actualizar contraseña
    $sql = "UPDATE usuarios 
            SET password = :passwd, 
                debe_cambiar_password = :debe_cambiar,
                fecha_actualizacion = NOW() 
            WHERE id = :id";
    
    $stmt = $pdo->prepare($sql);
    $ok = $stmt->execute([
        ':passwd' => $hashed,
        ':debe_cambiar' => $debe_cambiar_password,
        ':id'     => $user_id
    ]);

    if ($ok && $stmt->rowCount() > 0) {
        $message = "Contraseña actualizada correctamente";
        if ($is_admin_action) {
            $message = "Contraseña restablecida correctamente. El usuario deberá cambiarla en su próximo inicio de sesión.";
        } elseif ($is_first_time) {
            $message = "Contraseña establecida correctamente. Ya puede acceder al sistema.";
        }
        
        sendJsonResponse(true, $message, [
            "actualizar_sesion" => true,
            "debe_cambiar_password" => $debe_cambiar_password
        ]);
    } else {
        http_response_code(400);
        sendJsonResponse(false, "Error al actualizar la contraseña en la base de datos");
    }
} catch (PDOException $e) {
    http_response_code(500);
    sendJsonResponse(false, "Error del servidor: " . $e->getMessage());
}