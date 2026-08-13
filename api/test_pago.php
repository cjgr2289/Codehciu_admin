<?php
// No mostrar errores en pantalla
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');

// Solo para probar si el archivo es accesible
echo json_encode([
    'success' => true,
    'message' => 'El archivo funciona correctamente',
    'timestamp' => date('Y-m-d H:i:s')
]);
exit;
?>