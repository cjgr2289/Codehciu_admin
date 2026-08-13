<?php
/**
 * API para Obtener Usuarios con Datos de Pago
 * Para usar en el select de beneficiarios de solicitudes de pago (Honorarios/Terceros)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

error_reporting(0);
ini_set('display_errors', 0);

require_once 'database.php';

session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$proyecto_id = $_GET['proyecto_id'] ?? 0;
$solo_terceros = $_GET['solo_terceros'] ?? 'false';

try {
    $query = "
        SELECT 
            u.id,
            u.nombre,
            u.cedula,
            u.email,
            u.cargo,
            u.departamento,
            u.rol,
            dp.banco,
            dp.tipo_cuenta,
            dp.numero_cuenta,
            dp.numero_cedula,
            dp.forma_pago,
            dp.monto_honorarios,
            dp.es_tercero,
            dp.tipo_contrato,
            dp.observaciones
        FROM usuarios u
        LEFT JOIN datos_pago_usuarios dp ON u.id = dp.usuario_id AND dp.activo = 1
        WHERE u.Activo = 1
    ";
    
    $params = [];
    
    // Si solo queremos terceros
    if ($solo_terceros === 'true') {
        $query .= " AND dp.es_tercero = 1";
    }
    
    // Si tenemos proyecto_id, filtrar usuarios asignados al proyecto
    if ($proyecto_id > 0) {
        $query .= " AND u.id IN (SELECT usuario_id FROM usuario_proyecto WHERE proyecto_id = :proyecto_id)";
        $params[':proyecto_id'] = $proyecto_id;
    }
    
    $query .= " ORDER BY u.nombre ASC";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $usuarios = $stmt->fetchAll();
    
    // Formatear datos para el frontend
    $result = [];
    foreach ($usuarios as $user) {
        $result[] = [
            'id' => $user['id'],
            'nombre' => $user['nombre'],
            'cedula' => $user['cedula'],
            'email' => $user['email'],
            'cargo' => $user['cargo'],
            'departamento' => $user['departamento'],
            'rol' => $user['rol'],
            'datos_pago' => [
                'banco' => $user['banco'] ?? null,
                'tipo_cuenta' => $user['tipo_cuenta'] ?? null,
                'numero_cuenta' => $user['numero_cuenta'] ?? null,
                'numero_cedula' => $user['numero_cedula'] ?? null,
                'forma_pago' => $user['forma_pago'] ?? 'Transferencia',
                'monto_honorarios' => $user['monto_honorarios'] ? floatval($user['monto_honorarios']) : null,
                'es_tercero' => (bool)$user['es_tercero'],
                'tipo_contrato' => $user['tipo_contrato'] ?? null,
                'observaciones' => $user['observaciones'] ?? null
            ]
        ];
    }
    
    echo json_encode([
        'success' => true,
        'usuarios' => $result,
        'total' => count($result)
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}
?>