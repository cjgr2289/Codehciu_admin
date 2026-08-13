<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Solo para pruebas locales
header('Access-Control-Allow-Credentials: true'); // Permitir cookies de sesión

session_start();

require_once("database.php");

try {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);

    // Obtener email o id de POST o de sesión
    $email = '';
    $user_id = null;
    if ($input && isset($input['email']) && $input['email']) {
        $email = $input['email'];
    } elseif (isset($_SESSION['user_email']) && $_SESSION['user_email']) {
        $email = $_SESSION['user_email'];
    }
    if (!$email && isset($_SESSION['user_id']) && $_SESSION['user_id']) {
        $user_id = $_SESSION['user_id'];
    }

    if (!$email && !$user_id) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'No email or user_id provided',
            'debug_raw' => $raw,
            'debug_session' => $_SESSION,
            'debug_cookies' => $_COOKIE,
            'debug_php_session_id' => session_id()
        ]);
        exit;
    }

    if ($email) {
        $stmt = $pdo->prepare("SELECT nombre, email, telefono, foto, foto_tipo, fecha_vencimiento, cargo, telefono, departamento, cedula, Medicinas, TipoSangre, Alergias FROM usuarios WHERE email = ?");
        $stmt->execute([$email]);
    } else {
        $stmt = $pdo->prepare("SELECT nombre, email, telefono, foto, foto_tipo, fecha_vencimiento, cargo, telefono, departamento, cedula, Medicinas, TipoSangre, Alergias FROM usuarios WHERE id = ?");
        $stmt->execute([$user_id]);
    }
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found']);
        exit;
    }

    // Convertir foto a base64 si existe
    if ($user['foto']) {
        $user['foto'] = base64_encode($user['foto']);
    } else {
        $user['foto'] = null;
    }

    echo json_encode(['success' => true] + $user);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
