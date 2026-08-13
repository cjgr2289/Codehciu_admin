<?php
// session-helper.php - Funciones auxiliares para manejo de sesión

function getCurrentUser() {
    if (!isset($_SESSION['user_id'])) {
        return null;
    }
    
    // Si existe $_SESSION['user'] como array, usar eso
    if (isset($_SESSION['user']) && is_array($_SESSION['user'])) {
        return $_SESSION['user'];
    }
    
    // Si no, construir el array desde las variables individuales
    return [
        'id' => $_SESSION['user_id'],
        'name' => $_SESSION['user_name'] ?? '',
        'email' => $_SESSION['user_email'] ?? '',
        'role' => $_SESSION['user_role'] ?? '',
        'politicas_aceptadas' => $_SESSION['politicas_aceptadas'] ?? false,
        'debe_cambiar_password' => $_SESSION['debe_cambiar_password'] ?? false
    ];
}

function isUserLoggedIn() {
    return isset($_SESSION['user_id']);
}

function isUserAdmin() {
    if (!isUserLoggedIn()) {
        return false;
    }
    
    $user = getCurrentUser();
    return ($user['role'] === 'admin' || $user['role'] === 'administrador');
}

function requireLogin() {
    if (!isUserLoggedIn()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado. Por favor, inicie sesión.']);
        exit();
    }
}

function requireAdmin() {
    requireLogin();
    
    if (!isUserAdmin()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado. Se requiere rol de administrador.']);
        exit();
    }
}
?>