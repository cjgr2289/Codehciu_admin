<?php
header('Content-Type: application/json');
require_once 'database.php';

try {
    // Consultar bancos activos
    $query = "SELECT id, nombre, numero_cuenta, moneda, activo FROM bancos WHERE activo = 1";
    $stmt = $pdo->query($query);
    $bancos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'bancos' => $bancos,
        'total' => count($bancos)
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}
?>