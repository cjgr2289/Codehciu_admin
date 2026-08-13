<?php
// api/egresos.php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once 'database.php';
require_once 'session-helper.php';

error_reporting(E_ALL);
ini_set('display_errors', 0);

function sendJsonResponse($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
    exit;
}

// Manejar preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

if (!isset($pdo)) {
    sendJsonResponse(['success' => false, 'message' => 'Error de conexión a base de datos']);
}

try {
    if ($method === 'POST') {
        // Verificar sesión
        if (!verifySession()) {
            sendJsonResponse(['success' => false, 'message' => 'No autorizado']);
        }
        
        $user_id = $_SESSION['user_id'] ?? null;
        
        switch ($action) {
            case 'crear':
                // Obtener datos del formulario
                $proyecto_id = $_POST['proyecto_id'] ?? 0;
                $partida_id = $_POST['partida_id'] ?? 0;
                $banco_id = $_POST['cuenta_bancaria_id'] ?? 0;
                $monto = floatval($_POST['monto'] ?? 0);
                $moneda = $_POST['moneda'] ?? 'USD';
                $concepto = trim($_POST['concepto'] ?? '');
                $fecha = $_POST['fecha'] ?? date('Y-m-d');
                $beneficiario = trim($_POST['beneficiario'] ?? '');
                $descripcion = trim($_POST['descripcion'] ?? '');
                $tasa_cambio = floatval($_POST['tasa_cambio'] ?? 1.0);
                $numero_documento = trim($_POST['numero_documento'] ?? '');
                $metodo_pago = $_POST['metodo_pago'] ?? 'Transferencia';
                
                // Validaciones
                if (!$proyecto_id) {
                    sendJsonResponse(['success' => false, 'message' => 'ID de proyecto requerido']);
                }
                
                if (!$partida_id) {
                    sendJsonResponse(['success' => false, 'message' => 'Partida requerida']);
                }
                
                if (!$banco_id) {
                    sendJsonResponse(['success' => false, 'message' => 'Cuenta bancaria requerida']);
                }
                
                if ($monto <= 0) {
                    sendJsonResponse(['success' => false, 'message' => 'El monto debe ser mayor a 0']);
                }
                
                if (empty($concepto)) {
                    sendJsonResponse(['success' => false, 'message' => 'Concepto requerido']);
                }
                
                // Verificar que el proyecto exista y esté abierto
                $stmt = $pdo->prepare("SELECT estado FROM proyectos WHERE id = ?");
                $stmt->execute([$proyecto_id]);
                $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$proyecto) {
                    sendJsonResponse(['success' => false, 'message' => 'Proyecto no encontrado']);
                }
                
                if (($proyecto['estado'] ?? '') !== 'Activo') {
                    sendJsonResponse(['success' => false, 'message' => 'No se pueden registrar egresos en proyectos no activos']);
                }
                
                // Verificar que la partida exista y pertenezca al proyecto
                $stmt = $pdo->prepare("
                    SELECT p.id, p.nombre, p.presupuesto_actual, p.codigo
                    FROM partidas p 
                    WHERE p.id = ? AND p.proyecto_id = ? AND p.activo = 1
                ");
                $stmt->execute([$partida_id, $proyecto_id]);
                $partida = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$partida) {
                    sendJsonResponse(['success' => false, 'message' => 'Partida no encontrada o no pertenece a este proyecto']);
                }
                
                // Verificar disponibilidad en la partida
                if ($partida['presupuesto_actual'] < $monto) {
                    sendJsonResponse([
                        'success' => false, 
                        'message' => 'Fondos insuficientes en la partida ' . $partida['codigo'] . '. Disponible: $' . number_format($partida['presupuesto_actual'], 2)
                    ]);
                }
                
                // Verificar que la cuenta bancaria exista y tenga saldo suficiente
                $stmt = $pdo->prepare("SELECT id, nombre, saldo_actual FROM bancos WHERE id = ?");
                $stmt->execute([$banco_id]);
                $cuenta = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$cuenta) {
                    sendJsonResponse(['success' => false, 'message' => 'Cuenta bancaria no encontrada']);
                }
                
                if ($cuenta['saldo_actual'] < $monto) {
                    sendJsonResponse([
                        'success' => false, 
                        'message' => 'Saldo insuficiente en la cuenta ' . $cuenta['nombre'] . '. Saldo disponible: $' . number_format($cuenta['saldo_actual'], 2)
                    ]);
                }
                
                // Iniciar transacción
                $pdo->beginTransaction();
                
                try {
                    // Insertar la transacción de egreso
                    $stmt = $pdo->prepare("
                        INSERT INTO transacciones 
                        (proyecto_id, partida_id, banco_id, tipo, monto, moneda, tasa_cambio,
                         concepto, fecha_transaccion, numero_documento, beneficiario,
                         descripcion, metodo_pago, status, created_by)
                        VALUES (?, ?, ?, 'Egreso', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completado', ?)
                    ");
                    
                    $success = $stmt->execute([
                        $proyecto_id,
                        $partida_id,
                        $banco_id,
                        $monto,
                        $moneda,
                        $tasa_cambio,
                        $concepto,
                        $fecha,
                        $numero_documento,
                        $beneficiario,
                        $descripcion,
                        $metodo_pago,
                        $user_id
                    ]);
                    
                    if (!$success) {
                        throw new Exception('Error al insertar el egreso');
                    }
                    
                    $transaccion_id = $pdo->lastInsertId();
                    
                    // Actualizar el presupuesto actual de la partida
                    $stmt = $pdo->prepare("
                        UPDATE partidas 
                        SET presupuesto_actual = presupuesto_actual - ? 
                        WHERE id = ?
                    ");
                    $stmt->execute([$monto, $partida_id]);
                    
                        // Actualizar el saldo de la cuenta bancaria
                        $stmt = $pdo->prepare("
                            UPDATE bancos 
                            SET saldo_actual = saldo_actual - ? 
                            WHERE id = ?
                        ");
                        $stmt->execute([$monto, $banco_id]);
                    
                    // Actualizar el presupuesto disponible del proyecto
                    $stmt = $pdo->prepare("
                        UPDATE proyectos 
                        SET presupuesto_disponible = presupuesto_disponible - ?,
                            total_egresos = COALESCE(total_egresos, 0) + ?
                        WHERE id = ?
                    ");
                    $stmt->execute([$monto, $monto, $proyecto_id]);
                    
                    // Confirmar transacción
                    $pdo->commit();
                    
                    sendJsonResponse([
                        'success' => true,
                        'message' => 'Egreso registrado exitosamente',
                        'transaccion_id' => $transaccion_id
                    ]);
                    
                } catch (Exception $e) {
                    $pdo->rollBack();
                    throw $e;
                }
                break;
                
            default:
                sendJsonResponse(['success' => false, 'message' => 'Acción POST no reconocida']);
        }
    } 
    elseif ($method === 'GET') {
        switch ($action) {
            case 'listar':
                $proyecto_id = $_GET['proyecto_id'] ?? 0;
                $partida_id = $_GET['partida_id'] ?? null;
                
                $sql = "
                    SELECT t.*, 
                           p.codigo_partida, p.nombre as partida_nombre,
                           cb.nombre as banco_nombre, cb.numero_cuenta
                    FROM transacciones t
                    LEFT JOIN partidas p ON t.partida_id = p.id
                    LEFT JOIN bancos cb ON t.banco_id = cb.id
                    WHERE t.proyecto_id = ? AND t.tipo = 'Egreso'
                ";
                
                $params = [$proyecto_id];
                
                if ($partida_id) {
                    $sql .= " AND t.partida_id = ?";
                    $params[] = $partida_id;
                }
                
                $sql .= " ORDER BY t.fecha_transaccion DESC, t.created_at DESC";
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $egresos = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                sendJsonResponse([
                    'success' => true,
                    'egresos' => $egresos
                ]);
                break;
                
            default:
                sendJsonResponse(['success' => false, 'message' => 'Acción GET no reconocida']);
        }
    }
    else {
        sendJsonResponse(['success' => false, 'message' => 'Método no permitido']);
    }
    
} catch (PDOException $e) {
    error_log("Error en egresos.php: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'Error de base de datos']);
} catch (Exception $e) {
    error_log("Error en egresos.php: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => $e->getMessage()]);
}
?>