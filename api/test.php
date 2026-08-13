<?php
header('Content-Type: application/json');

// Verificar si hay errores PHP
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Probar conexión a base de datos
try {
    require_once 'database.php';
    echo json_encode(['success' => true, 'message' => 'Conexión OK']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>