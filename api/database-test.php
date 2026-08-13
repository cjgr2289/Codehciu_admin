<?php
/**
 * Configuración de prueba para la base de datos
 */

// Configuración de la base de datos
$dbConfig = [
    'host' => '148.72.3.93',
    'dbname' => 'sistema_noticias',
    'username' => 'admincodehciu',
    'password' => 'C0d3hc1u.25*',
    'charset' => 'utf8mb4',
    'options' => [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
];

try {
    $dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['dbname']};charset={$dbConfig['charset']}";
    $pdo = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], $dbConfig['options']);
    
    // Verificación adicional de conexión
    $pdo->query("SELECT 1");
    
    return $pdo;
    
} catch (PDOException $e) {
    throw new Exception("Error de conexión a la base de datos: " . $e->getMessage());
}
?>