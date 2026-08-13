<?php
/**
 * API para Gestión de Proveedores
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
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

// Obtener acción - buscar en GET, POST o en el body JSON
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// Si viene por POST con JSON, intentar leer del body
if (empty($action) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
}

// Para PUT y DELETE, leer del body
if (($_SERVER['REQUEST_METHOD'] === 'PUT' || $_SERVER['REQUEST_METHOD'] === 'DELETE') && empty($action)) {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
}

try {
    switch ($action) {
        case 'listar':
            listarProveedores($pdo);
            break;
        case 'obtener':
            obtenerProveedor($pdo);
            break;
        case 'crear':
            crearProveedor($pdo);
            break;
        case 'actualizar':
            actualizarProveedor($pdo);
            break;
        case 'eliminar':
            eliminarProveedor($pdo);
            break;
        default:
            // Si no hay acción específica, intentar detectar por método HTTP
            if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                listarProveedores($pdo);
            } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
                crearProveedor($pdo);
            } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
                actualizarProveedor($pdo);
            } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
                eliminarProveedor($pdo);
            } else {
                echo json_encode(['success' => false, 'message' => 'Acción no válida']);
            }
            break;
    }
} catch (Exception $e) {
    error_log("Error en proveedores.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

function listarProveedores($pdo) {
    $tipo = $_GET['tipo'] ?? '';
    $activo = isset($_GET['activo']) ? intval($_GET['activo']) : 1;
    
    $where = ["activo = :activo"];
    $params = [':activo' => $activo];
    
    if (!empty($tipo)) {
        $where[] = "tipo_proveedor IN ('ambos', :tipo)";
        $params[':tipo'] = $tipo;
    }
    
    $query = "SELECT * FROM proveedores WHERE " . implode(" AND ", $where) . " ORDER BY nombre";
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $proveedores = $stmt->fetchAll();
    
    echo json_encode(['success' => true, 'proveedores' => $proveedores]);
}

function obtenerProveedor($pdo) {
    $id = $_GET['id'] ?? '';
    
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
        return;
    }
    
    $query = "SELECT * FROM proveedores WHERE id = :id";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':id' => $id]);
    $proveedor = $stmt->fetch();
    
    if ($proveedor) {
        echo json_encode(['success' => true, 'proveedor' => $proveedor]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Proveedor no encontrado']);
    }
}

function crearProveedor($pdo) {
    // Leer input de diferentes formas
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    
    $required = ['id', 'nombre', 'ci_rif', 'cuenta_bancaria'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            echo json_encode(['success' => false, 'message' => "Campo requerido: $field"]);
            return;
        }
    }
    
    // Verificar si ya existe
    $check = $pdo->prepare("SELECT id FROM proveedores WHERE id = :id OR ci_rif = :ci_rif");
    $check->execute([':id' => $input['id'], ':ci_rif' => $input['ci_rif']]);
    if ($check->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Ya existe un proveedor con este ID o RIF']);
        return;
    }
    
    $query = "
        INSERT INTO proveedores (
            id, nombre, ci_rif, cuenta_bancaria, telefono, email, direccion, tipo_proveedor, activo
        ) VALUES (
            :id, :nombre, :ci_rif, :cuenta_bancaria, :telefono, :email, :direccion, :tipo_proveedor, :activo
        )
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([
        ':id' => $input['id'],
        ':nombre' => $input['nombre'],
        ':ci_rif' => $input['ci_rif'],
        ':cuenta_bancaria' => $input['cuenta_bancaria'],
        ':telefono' => $input['telefono'] ?? null,
        ':email' => $input['email'] ?? null,
        ':direccion' => $input['direccion'] ?? null,
        ':tipo_proveedor' => $input['tipo_proveedor'] ?? 'ambos',
        ':activo' => $input['activo'] ?? 1
    ]);
    
    echo json_encode(['success' => true, 'message' => 'Proveedor creado exitosamente', 'id' => $input['id']]);
}

function actualizarProveedor($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    
    if (empty($input['id'])) {
        echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
        return;
    }
    
    $query = "
        UPDATE proveedores SET
            nombre = :nombre,
            ci_rif = :ci_rif,
            cuenta_bancaria = :cuenta_bancaria,
            telefono = :telefono,
            email = :email,
            direccion = :direccion,
            tipo_proveedor = :tipo_proveedor,
            activo = :activo
        WHERE id = :id
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([
        ':id' => $input['id'],
        ':nombre' => $input['nombre'],
        ':ci_rif' => $input['ci_rif'],
        ':cuenta_bancaria' => $input['cuenta_bancaria'],
        ':telefono' => $input['telefono'] ?? null,
        ':email' => $input['email'] ?? null,
        ':direccion' => $input['direccion'] ?? null,
        ':tipo_proveedor' => $input['tipo_proveedor'] ?? 'ambos',
        ':activo' => $input['activo'] ?? 1
    ]);
    
    echo json_encode(['success' => true, 'message' => 'Proveedor actualizado exitosamente']);
}

function eliminarProveedor($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    $id = $input['id'] ?? '';
    
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
        return;
    }
    
    // Verificar si tiene solicitudes asociadas
    $check = $pdo->prepare("SELECT COUNT(*) as total FROM solicitudes_compras WHERE orden_compra_id IN (SELECT id FROM ordenes_compra WHERE proveedor_id = :id)");
    $check->execute([':id' => $id]);
    $row = $check->fetch();
    
    if ($row['total'] > 0) {
        // Desactivar en lugar de eliminar
        $query = "UPDATE proveedores SET activo = 0 WHERE id = :id";
        $stmt = $pdo->prepare($query);
        $stmt->execute([':id' => $id]);
        echo json_encode(['success' => true, 'message' => 'Proveedor desactivado (tiene órdenes asociadas)']);
    } else {
        $query = "DELETE FROM proveedores WHERE id = :id";
        $stmt = $pdo->prepare($query);
        $stmt->execute([':id' => $id]);
        echo json_encode(['success' => true, 'message' => 'Proveedor eliminado exitosamente']);
    }
}
?>