<?php
header('Content-Type: application/json');
require_once '../config/database.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['imagen'])) {
    $imagen = $_FILES['imagen'];
    
    // Validar el archivo
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!in_array($imagen['type'], $allowedTypes)) {
        echo json_encode(['success' => false, 'message' => 'Tipo de archivo no permitido']);
        exit;
    }
    
    // Leer el contenido del archivo
    $imagenData = file_get_contents($imagen['tmp_name']);
    $imagenTipo = $imagen['type'];
    
    echo json_encode([
        'success' => true,
        'imagen_data' => base64_encode($imagenData),
        'imagen_tipo' => $imagenTipo
    ]);
}
?>