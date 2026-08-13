<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/html; charset=utf-8');

require_once '../config/database.php';

echo "<h2>Debug de Transacciones</h2>";

try {
    $database = new Database();
    $conn = $database->getConnection();
    echo "<p style='color: green;'>✓ Conexión a base de datos exitosa</p>";
    
    // Verificar datos POST
    echo "<h3>Datos recibidos:</h3>";
    echo "<pre>";
    var_dump(file_get_contents('php://input'));
    echo "</pre>";
    
    // Verificar usuario en sesión
    session_start();
    echo "<h3>Sesión:</h3>";
    echo "<pre>";
    var_dump($_SESSION);
    echo "</pre>";
    
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ Error: " . $e->getMessage() . "</p>";
}