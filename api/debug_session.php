<?php
// Crear /admin/api/debug_session.php
session_start();
header('Content-Type: application/json');

echo json_encode([
    'session' => $_SESSION,
    'user_id' => $_SESSION['user_id'] ?? null,
    'user_rol' => $_SESSION['user_rol'] ?? null,
    'all_session' => $_SESSION
]);
?>