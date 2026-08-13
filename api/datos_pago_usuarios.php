<?php
/**
 * API para gestionar datos de pago de usuarios
 * CODEHCIU - Sistema de Finanzas
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'database.php';

session_start();

// Verificar autenticación
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado. Por favor, inicie sesión.']);
    exit();
}

// Verificar que el usuario sea administrador
if ($_SESSION['user_role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Se requiere rol de administrador.']);
    exit();
}

try {
    $action = $_GET['action'] ?? '';

    switch ($action) {
        case 'obtener':
            obtenerDatosPago($pdo);
            break;
        case 'guardar':
            guardarDatosPago($pdo);
            break;
        case 'eliminar':
            eliminarDatosPago($pdo);
            break;
        case 'listar_usuarios':
            listarUsuariosConDatosPago($pdo);
            break;
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Acción no válida']);
            break;
    }
} catch (PDOException $e) {
    error_log("Error en datos_pago_usuarios.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error en el servidor: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log("Error general en datos_pago_usuarios.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error: ' . $e->getMessage()]);
}

/**
 * Obtener datos de pago de un usuario
 */
function obtenerDatosPago($pdo) {
    $usuario_id = $_GET['usuario_id'] ?? 0;
    
    if (!$usuario_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID de usuario requerido']);
        return;
    }
    
    $stmt = $pdo->prepare("
        SELECT * FROM datos_pago_usuarios 
        WHERE usuario_id = ? AND activo = 1
    ");
    $stmt->execute([$usuario_id]);
    $datos = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $datos
    ]);
}

/**
 * Guardar datos de pago (crear o actualizar)
 */
function guardarDatosPago($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
        return;
    }
    
    $usuario_id = $input['usuario_id'] ?? 0;
    $banco = $input['banco'] ?? '';
    $tipo_cuenta = $input['tipo_cuenta'] ?? 'Corriente';
    $numero_cuenta = $input['numero_cuenta'] ?? '';
    $numero_cedula = $input['numero_cedula'] ?? '';
    $forma_pago = $input['forma_pago'] ?? 'Transferencia';
    $monto_honorarios = isset($input['monto_honorarios']) ? floatval($input['monto_honorarios']) : null;
    $es_tercero = isset($input['es_tercero']) ? (int)$input['es_tercero'] : 0;
    $tipo_contrato = $input['tipo_contrato'] ?? null;
    $observaciones = $input['observaciones'] ?? null;
    
    if (!$usuario_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID de usuario requerido']);
        return;
    }
    
    if (!$banco || !$numero_cuenta || !$numero_cedula) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Banco, número de cuenta y cédula son requeridos']);
        return;
    }
    
    // Verificar si ya existe
    $checkStmt = $pdo->prepare("SELECT id FROM datos_pago_usuarios WHERE usuario_id = ?");
    $checkStmt->execute([$usuario_id]);
    $existe = $checkStmt->fetch();
    
    if ($existe) {
        // Actualizar
        $stmt = $pdo->prepare("
            UPDATE datos_pago_usuarios 
            SET banco = ?, 
                tipo_cuenta = ?, 
                numero_cuenta = ?, 
                numero_cedula = ?, 
                forma_pago = ?, 
                monto_honorarios = ?, 
                es_tercero = ?, 
                tipo_contrato = ?, 
                observaciones = ?,
                activo = 1,
                updated_at = NOW()
            WHERE usuario_id = ?
        ");
        $stmt->execute([
            $banco,
            $tipo_cuenta,
            $numero_cuenta,
            $numero_cedula,
            $forma_pago,
            $monto_honorarios,
            $es_tercero,
            $tipo_contrato,
            $observaciones,
            $usuario_id
        ]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Datos de pago actualizados correctamente'
        ]);
    } else {
        // Crear
        $stmt = $pdo->prepare("
            INSERT INTO datos_pago_usuarios (
                usuario_id, banco, tipo_cuenta, numero_cuenta, numero_cedula,
                forma_pago, monto_honorarios, es_tercero, tipo_contrato,
                observaciones, activo
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, 1
            )
        ");
        $stmt->execute([
            $usuario_id,
            $banco,
            $tipo_cuenta,
            $numero_cuenta,
            $numero_cedula,
            $forma_pago,
            $monto_honorarios,
            $es_tercero,
            $tipo_contrato,
            $observaciones
        ]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Datos de pago guardados correctamente'
        ]);
    }
}

/**
 * Eliminar datos de pago (desactivar)
 */
function eliminarDatosPago($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    $usuario_id = $input['usuario_id'] ?? 0;
    
    if (!$usuario_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID de usuario requerido']);
        return;
    }
    
    $stmt = $pdo->prepare("
        UPDATE datos_pago_usuarios 
        SET activo = 0, updated_at = NOW()
        WHERE usuario_id = ?
    ");
    $stmt->execute([$usuario_id]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Datos de pago eliminados correctamente'
    ]);
}

/**
 * Listar usuarios con sus datos de pago
 */
function listarUsuariosConDatosPago($pdo) {
    $stmt = $pdo->prepare("
        SELECT 
            u.id,
            u.nombre,
            u.email,
            u.cedula,
            u.rol,
            u.Activo,
            dp.id as datos_pago_id,
            dp.banco,
            dp.tipo_cuenta,
            dp.numero_cuenta,
            dp.numero_cedula as pago_numero_cedula,
            dp.forma_pago,
            dp.monto_honorarios,
            dp.es_tercero,
            dp.tipo_contrato,
            dp.observaciones,
            dp.activo as datos_pago_activo
        FROM usuarios u
        LEFT JOIN datos_pago_usuarios dp ON u.id = dp.usuario_id
        WHERE u.Activo = 1
        ORDER BY u.nombre ASC
    ");
    $stmt->execute();
    $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $usuarios
    ]);
}
?>