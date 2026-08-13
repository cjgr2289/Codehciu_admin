<?php
/**
 * Configuración de la base de datos - Sistema de Noticias
 * Ubicación: /codehciu/config/database.php
 */

// Niveles de error para desarrollo/producción
define('DEV_MODE', true); // Cambiar a false en producción
ini_set('display_errors', DEV_MODE);
error_reporting(DEV_MODE ? E_ALL : 0);

// Configuración de la base de datos
$dbConfig = [
    'host' => 'localhost',
    'dbname' => 'sistema_noticias',
    'username' => 'root',
    'password' => '',
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
    
} catch (PDOException $e) {
    $errorMessage = "Error de conexión a la base de datos: " . $e->getMessage();
    // Registrar el error siempre
    error_log($errorMessage);
    // Lanzar una excepción para que el archivo que incluyó esta configuración la maneje y devuelva JSON
    throw new Exception($errorMessage);
}
?>