<?php
// api/bancos.php - VERSIÓN FINAL SIN SIMULACIÓN
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once 'database.php';

error_reporting(E_ALL);
ini_set('display_errors', 0);

function sendJsonResponse($data, $httpCode = 200) {
    http_response_code($httpCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Manejar preflight
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    sendJsonResponse(['success' => true], 200);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = intval($_GET['id'] ?? 0);

try {
    if (!isset($pdo)) {
        throw new Exception('Error de conexión a base de datos');
    }

    if ($method === 'GET') {
        switch ($action) {
            case 'listar':
                $mostrarInactivos = isset($_GET['inactivos']) && $_GET['inactivos'] == 'true';
                
                $sql = "SELECT * FROM bancos WHERE 1=1";
                $params = [];
                
                if (!$mostrarInactivos) {
                    $sql .= " AND activo = 1";
                }
                
                $sql .= " ORDER BY nombre, created_at DESC";
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $cuentas = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                sendJsonResponse([
                    'success' => true,
                    'cuentas' => $cuentas,
                    'total' => count($cuentas)
                ]);
                break;
                
            case 'obtener':
                if ($id <= 0) {
                    sendJsonResponse(['success' => false, 'error' => 'ID inválido'], 400);
                }
                
                $stmt = $pdo->prepare("SELECT * FROM bancos WHERE id = ?");
                $stmt->execute([$id]);
                $cuenta = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$cuenta) {
                    sendJsonResponse(['success' => false, 'error' => 'Cuenta no encontrada'], 404);
                }
                
                sendJsonResponse([
                    'success' => true,
                    'cuenta' => $cuenta
                ]);
                break;
                
            default:
                sendJsonResponse(['success' => false, 'error' => 'Acción no válida'], 400);
        }
    } elseif ($method === 'POST') {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            sendJsonResponse(['success' => false, 'error' => 'JSON inválido'], 400);
        }
        
        switch ($action) {
            case 'crear':
                $required = ['nombre', 'numero_cuenta', 'moneda'];
                foreach ($required as $field) {
                    if (empty($data[$field])) {
                        sendJsonResponse(['success' => false, 'error' => "Campo $field requerido"], 400);
                    }
                }
                
                // Verificar número de cuenta único
                $stmtCheck = $pdo->prepare("SELECT id FROM bancos WHERE numero_cuenta = ?");
                $stmtCheck->execute([$data['numero_cuenta']]);
                if ($stmtCheck->fetch()) {
                    sendJsonResponse(['success' => false, 'error' => 'El número de cuenta ya existe'], 409);
                }
                
                $saldoInicial = floatval($data['saldo_inicial'] ?? 0);
                $saldoActual = $saldoInicial;
                
                $stmt = $pdo->prepare("
                    INSERT INTO bancos 
                    (nombre, pais, numero_cuenta, tipo_cuenta, representante, 
                     email_representante, telefono_representante, saldo_inicial, 
                     saldo_actual, moneda) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                
                $result = $stmt->execute([
                    $data['nombre'],
                    $data['pais'] ?? 'Venezuela',
                    $data['numero_cuenta'],
                    $data['tipo_cuenta'] ?? 'Corriente',
                    $data['representante'] ?? '',
                    $data['email_representante'] ?? '',
                    $data['telefono_representante'] ?? '',
                    $saldoInicial,
                    $saldoActual,
                    $data['moneda']
                ]);
                
                if ($result) {
                    sendJsonResponse([
                        'success' => true,
                        'message' => 'Cuenta creada correctamente',
                        'id' => $pdo->lastInsertId()
                    ], 201);
                } else {
                    sendJsonResponse(['success' => false, 'error' => 'Error al crear cuenta'], 500);
                }
                break;
                
            case 'editar':
                if (empty($data['id'])) {
                    sendJsonResponse(['success' => false, 'error' => 'ID requerido'], 400);
                }
                
                $required = ['nombre', 'numero_cuenta', 'moneda'];
                foreach ($required as $field) {
                    if (empty($data[$field])) {
                        sendJsonResponse(['success' => false, 'error' => "Campo $field requerido"], 400);
                    }
                }
                
                // Verificar que la cuenta existe
                $stmtCheck = $pdo->prepare("SELECT id, numero_cuenta FROM bancos WHERE id = ?");
                $stmtCheck->execute([$data['id']]);
                $cuentaActual = $stmtCheck->fetch(PDO::FETCH_ASSOC);
                
                if (!$cuentaActual) {
                    sendJsonResponse(['success' => false, 'error' => 'Cuenta no encontrada'], 404);
                }
                
                // Verificar número de cuenta único (si cambió)
                if ($data['numero_cuenta'] !== $cuentaActual['numero_cuenta']) {
                    $stmtCheckNum = $pdo->prepare("SELECT id FROM bancos WHERE numero_cuenta = ? AND id != ?");
                    $stmtCheckNum->execute([$data['numero_cuenta'], $data['id']]);
                    if ($stmtCheckNum->fetch()) {
                        sendJsonResponse(['success' => false, 'error' => 'El número de cuenta ya existe'], 409);
                    }
                }
                
                $stmt = $pdo->prepare("
                    UPDATE bancos SET
                    nombre = ?,
                    pais = ?,
                    numero_cuenta = ?,
                    tipo_cuenta = ?,
                    representante = ?,
                    email_representante = ?,
                    telefono_representante = ?,
                    moneda = ?,
                    updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ");
                
                $result = $stmt->execute([
                    $data['nombre'],
                    $data['pais'] ?? 'Venezuela',
                    $data['numero_cuenta'],
                    $data['tipo_cuenta'] ?? 'Corriente',
                    $data['representante'] ?? '',
                    $data['email_representante'] ?? '',
                    $data['telefono_representante'] ?? '',
                    $data['moneda'],
                    $data['id']
                ]);
                
                if ($result) {
                    sendJsonResponse([
                        'success' => true,
                        'message' => 'Cuenta actualizada correctamente'
                    ]);
                } else {
                    sendJsonResponse(['success' => false, 'error' => 'Error al actualizar cuenta'], 500);
                }
                break;
                
            case 'eliminar':
                if (empty($data['id'])) {
                    sendJsonResponse(['success' => false, 'error' => 'ID requerido'], 400);
                }
                
                // Verificar que existe
                $stmtCheck = $pdo->prepare("SELECT id, nombre, saldo_actual FROM bancos WHERE id = ? AND activo = 1");
                $stmtCheck->execute([$data['id']]);
                $cuenta = $stmtCheck->fetch(PDO::FETCH_ASSOC);
                
                if (!$cuenta) {
                    sendJsonResponse(['success' => false, 'error' => 'Cuenta no encontrada o ya eliminada'], 404);
                }
                
                // Verificar saldo
                if (abs(floatval($cuenta['saldo_actual'])) > 0.01) {
                    sendJsonResponse([
                        'success' => false, 
                        'error' => "No se puede eliminar la cuenta '{$cuenta['nombre']}' porque tiene saldo: {$cuenta['saldo_actual']}"
                    ], 400);
                }
                
                // Verificar transacciones
                $stmtTrans = $pdo->prepare("SELECT COUNT(*) as total FROM transacciones WHERE banco_id = ?");
                $stmtTrans->execute([$data['id']]);
                $resultado = $stmtTrans->fetch(PDO::FETCH_ASSOC);
                $totalTransacciones = $resultado['total'] ?? 0;
                
                if ($totalTransacciones > 0) {
                    sendJsonResponse([
                        'success' => false, 
                        'error' => "No se puede eliminar la cuenta '{$cuenta['nombre']}' porque tiene {$totalTransacciones} transacción(es)"
                    ], 400);
                }
                
                // Soft delete
                $stmt = $pdo->prepare("UPDATE bancos SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
                $result = $stmt->execute([$data['id']]);
                
                if ($result) {
                    sendJsonResponse([
                        'success' => true,
                        'message' => 'Cuenta eliminada correctamente'
                    ]);
                } else {
                    sendJsonResponse(['success' => false, 'error' => 'Error al eliminar cuenta'], 500);
                }
                break;
                
            default:
                sendJsonResponse(['success' => false, 'error' => 'Acción no válida'], 400);
        }
    } else {
        sendJsonResponse(['success' => false, 'error' => 'Método no permitido'], 405);
    }
} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'error' => 'Error interno: ' . $e->getMessage()
    ], 500);
}
?>