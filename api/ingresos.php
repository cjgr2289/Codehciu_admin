<?php
// api/ingresos.php
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
                    sendJsonResponse(['success' => false, 'message' => 'No se pueden registrar ingresos en proyectos no activos']);
                }
                
                // Verificar que la cuenta bancaria exista
                $stmt = $pdo->prepare("SELECT id, nombre FROM bancos WHERE id = ?");
                $stmt->execute([$banco_id]);
                $cuenta = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$cuenta) {
                    sendJsonResponse(['success' => false, 'message' => 'Cuenta bancaria no encontrada']);
                }
                
                // Iniciar transacción
                $pdo->beginTransaction();
                
                try {
                    // Insertar la transacción de ingreso
                    $stmt = $pdo->prepare("
                        INSERT INTO transacciones 
                        (proyecto_id, banco_id, tipo, monto, moneda, tasa_cambio,
                         concepto, fecha_transaccion, numero_documento, beneficiario,
                         descripcion, metodo_pago, status, created_by)
                        VALUES (?, ?, 'Ingreso', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completado', ?)
                    ");
                    
                    $success = $stmt->execute([
                        $proyecto_id,
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
                        throw new Exception('Error al insertar el ingreso');
                    }
                    
                    $transaccion_id = $pdo->lastInsertId();
                    
                    // Actualizar el saldo de la cuenta bancaria
                    $stmt = $pdo->prepare("UPDATE bancos SET saldo_actual = saldo_actual + ? WHERE id = ?");
                    $stmt->execute([$monto, $banco_id]);
                    
                    // Actualizar el presupuesto disponible del proyecto
                    $stmt = $pdo->prepare("
                        UPDATE proyectos 
                        SET presupuesto_disponible = presupuesto_disponible + ?,
                            total_ingresos = COALESCE(total_ingresos, 0) + ?
                        WHERE id = ?
                    ");
                    $stmt->execute([$monto, $monto, $proyecto_id]);
                    
                    // Confirmar transacción
                    $pdo->commit();
                    
                    sendJsonResponse([
                        'success' => true,
                        'message' => 'Ingreso registrado exitosamente',
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
    else {
        sendJsonResponse(['success' => false, 'message' => 'Método no permitido']);
    }
    
} catch (PDOException $e) {
    error_log("Error en ingresos.php: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'Error de base de datos']);
} catch (Exception $e) {
    error_log("Error en ingresos.php: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => $e->getMessage()]);
}
?>