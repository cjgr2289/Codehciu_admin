<?php
// api/transacciones.php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once 'database.php';

function sendJsonResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function logError($message, $context = null) {
    $payload = is_array($context) || is_object($context) ? json_encode($context, JSON_UNESCAPED_UNICODE) : (string)$context;
    error_log(date('[Y-m-d H:i:s] ') . $message . ($payload ? ' | ' . $payload : ''));
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if (!isset($pdo)) {
    sendJsonResponse(['success' => false, 'message' => 'Error de conexión a base de datos']);
}

try {
    if ($method === 'POST') {
        // Obtener user_id de sesión o usar 1 por defecto
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $user_id = $_SESSION['user_id'] ?? 1;
        
        // Leer body crudo una vez para validación/logging y posible uso
        $rawBody = file_get_contents('php://input');
        $jsonBody = null;
        if ($rawBody !== false && strlen(trim($rawBody)) > 0) {
            $jsonBody = json_decode($rawBody, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                logError('Error parseando JSON en POST', ['error' => json_last_error_msg(), 'input' => $rawBody]);
            }
        }

        switch ($action) {
            case 'crear':
                $data = $jsonBody;
                if (!$data) {
                    sendJsonResponse(['success' => false, 'message' => 'Datos JSON inválidos']);
                }
                
                $proyecto_id = $data['proyecto_id'] ?? 0;
                $partida_id = $data['partida_id'] ?? 0;
                $banco_id = $data['banco_id'] ?? 0;
                $tipo = $data['tipo'] ?? 'Egreso';
                $monto = floatval($data['monto'] ?? 0);
                $moneda = $data['moneda'] ?? 'USD';
                $tasa_cambio = floatval($data['tasa_cambio'] ?? 1.00);
                $concepto = trim($data['concepto'] ?? '');
                $fecha = $data['fecha_transaccion'] ?? date('Y-m-d');
                $numero_documento = trim($data['numero_documento'] ?? '');
                $beneficiario = trim($data['beneficiario'] ?? '');
                $descripcion = trim($data['descripcion'] ?? '');
                $metodo_pago = $data['metodo_pago'] ?? 'Transferencia';
                $status = 'Completado';
                
                // Validaciones básicas
                if ($proyecto_id <= 0) {
                    sendJsonResponse(['success' => false, 'message' => 'Proyecto no válido']);
                }
                if ($partida_id <= 0) {
                    sendJsonResponse(['success' => false, 'message' => 'Partida no válida']);
                }
                if ($banco_id <= 0) {
                    sendJsonResponse(['success' => false, 'message' => 'Banco no válido']);
                }
                if ($monto <= 0) {
                    sendJsonResponse(['success' => false, 'message' => 'Monto debe ser mayor a 0']);
                }
                
                // Verificar proyecto (usar columna `estado` según el esquema)
                $stmt = $pdo->prepare("SELECT estado FROM proyectos WHERE id = ?");
                $stmt->execute([$proyecto_id]);
                $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$proyecto) {
                    sendJsonResponse(['success' => false, 'message' => 'Proyecto no encontrado']);
                }
                // Validar que el proyecto esté activo
                if (($proyecto['estado'] ?? '') !== 'Activo') {
                    sendJsonResponse(['success' => false, 'message' => 'El proyecto no está activo']);
                }
                
                // Calcular USD gastado
                $monto_usd_gastado = ($moneda === 'BS') ? ($monto / $tasa_cambio) : $monto;
                
                // Verificar partida
                $stmt = $pdo->prepare("SELECT presupuesto_actual FROM partidas WHERE id = ? AND proyecto_id = ?");
                $stmt->execute([$partida_id, $proyecto_id]);
                $partida = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$partida) {
                    sendJsonResponse(['success' => false, 'message' => 'Partida no encontrada']);
                }
                
                if ($partida['presupuesto_actual'] < $monto_usd_gastado) {
                    sendJsonResponse([
                        'success' => false, 
                        'message' => 'Fondos insuficientes. Disponible: $' . number_format($partida['presupuesto_actual'], 2)
                    ]);
                }
                
                // Insertar transacción (intentamos con la columna `status`; si la tabla no la tiene, reintentamos sin ella)
                $insertWithStatus = "INSERT INTO transacciones 
                    (proyecto_id, partida_id, banco_id, tipo, 
                     monto, moneda, tasa_cambio,
                     concepto, fecha_transaccion, numero_documento, beneficiario,
                     descripcion, metodo_pago, status, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

                $insertWithoutStatus = "INSERT INTO transacciones 
                    (proyecto_id, partida_id, banco_id, tipo, 
                     monto, moneda, tasa_cambio,
                     concepto, fecha_transaccion, numero_documento, beneficiario,
                     descripcion, metodo_pago, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

                try {
                    $stmt = $pdo->prepare($insertWithStatus);
                    $result = $stmt->execute([
                        $proyecto_id, $partida_id, $banco_id, $tipo,
                        $monto, $moneda, $tasa_cambio,
                        $concepto, $fecha, $numero_documento, $beneficiario,
                        $descripcion, $metodo_pago, $status, $user_id
                    ]);
                } catch (PDOException $e) {
                    // Si la causa es columna desconocida (p. ej. 'status'), reintentamos sin esa columna
                    if (strpos($e->getMessage(), "Unknown column 'status'") !== false || $e->getCode() === '42S22') {
                        $stmt = $pdo->prepare($insertWithoutStatus);
                        $result = $stmt->execute([
                            $proyecto_id, $partida_id, $banco_id, $tipo,
                            $monto, $moneda, $tasa_cambio,
                            $concepto, $fecha, $numero_documento, $beneficiario,
                            $descripcion, $metodo_pago, $user_id
                        ]);
                    } else {
                        throw $e; // dejar que el catch externo lo maneje
                    }
                }

                if (!$result) {
                    sendJsonResponse(['success' => false, 'message' => 'Error al insertar transacción']);
                }
                
                // Obtener el ID de la transacción recién insertada
                $nuevo_id = $pdo->lastInsertId();
                
                // Actualizar presupuesto de partida
                $stmt = $pdo->prepare("UPDATE partidas SET presupuesto_actual = presupuesto_actual - ? WHERE id = ?");
                $stmt->execute([$monto_usd_gastado, $partida_id]);
                
                // Actualizar saldo de cuenta bancaria
                $stmt = $pdo->prepare("UPDATE bancos SET saldo_actual = saldo_actual - ? WHERE id = ?");
                $stmt->execute([$monto, $banco_id]);
                
                // Respuesta exitosa incluyendo el ID de la transacción
                sendJsonResponse([
                    'success' => true, 
                    'message' => 'Egreso registrado exitosamente', 
                    'id' => $nuevo_id
                ]);
                break;
                
            default:
                sendJsonResponse(['success' => false, 'message' => 'Acción no reconocida: ' . $action]);
        }
    } elseif ($method === 'GET') {
        // Manejo de rutas GET
        switch ($action) {
            case 'listar':
                // Parámetros de paginación y búsqueda
                $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
                $limit = isset($_GET['limit']) ? max(1, intval($_GET['limit'])) : 25;
                $offset = ($page - 1) * $limit;

                $search = isset($_GET['search']) ? trim($_GET['search']) : '';

                $countSql = "SELECT COUNT(*) as total FROM transacciones t JOIN partidas p ON t.partida_id = p.id";
                $listSql = "SELECT t.*, p.codigo as codigo_partida, p.nombre as partida_nombre FROM transacciones t JOIN partidas p ON t.partida_id = p.id";

                $params = [];
                if ($search !== '') {
                    $where = " WHERE (t.concepto LIKE :search OR t.beneficiario LIKE :search OR p.nombre LIKE :search)";
                    $countSql .= $where;
                    $listSql .= $where;
                    $params[':search'] = "%$search%";
                }

                $listSql .= " ORDER BY t.fecha_transaccion DESC LIMIT :limit OFFSET :offset";

                $stmtCount = $pdo->prepare($countSql);
                foreach ($params as $k => $v) {
                    $stmtCount->bindValue($k, $v);
                }
                $stmtCount->execute();
                $total = (int)$stmtCount->fetchColumn();

                $stmt = $pdo->prepare($listSql);
                foreach ($params as $k => $v) {
                    $stmt->bindValue($k, $v);
                }
                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                $stmt->execute();

                $transacciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

                sendJsonResponse(['success' => true, 'transacciones' => $transacciones, 'total' => $total]);
                break;

            case 'listar-todas':
                // listar todas las transacciones de una partida (sin paginación)
                $partida_id = isset($_GET['partida_id']) ? intval($_GET['partida_id']) : 0;
                $stmt = $pdo->prepare("SELECT t.*, p.codigo as codigo_partida, p.nombre as partida_nombre FROM transacciones t JOIN partidas p ON t.partida_id = p.id WHERE t.partida_id = :pid ORDER BY t.fecha_transaccion DESC");
                $stmt->execute([':pid' => $partida_id]);
                $transacciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

                // Estadísticas simples
                $estadisticas = [
                    'total_registros' => count($transacciones),
                    'total_monto' => array_sum(array_map(function ($r) { return floatval($r['monto']); }, $transacciones)),
                ];

                sendJsonResponse(['success' => true, 'transacciones' => $transacciones, 'estadisticas' => $estadisticas]);
                break;

            case 'obtener':
                $id = intval($_GET['id'] ?? 0);
                if ($id <= 0) {
                    sendJsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
                }
                $stmt = $pdo->prepare("
                    SELECT t.*, 
                        p.codigo as codigo_partida, 
                        p.nombre as partida_nombre 
                    FROM transacciones t 
                    LEFT JOIN partidas p ON t.partida_id = p.id 
                    WHERE t.id = :id
                ");
                $stmt->execute([':id' => $id]);
                $transaccion = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$transaccion) {
                    sendJsonResponse(['success' => false, 'message' => 'Transacción no encontrada'], 404);
                }

                sendJsonResponse(['success' => true, 'transaccion' => $transaccion]);
            break;

            default:
                sendJsonResponse(['success' => false, 'message' => 'Acción GET desconocida'], 400);
        }
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Método no permitido'], 405);
    }
    
} catch (PDOException $e) {
    sendJsonResponse(['success' => false, 'message' => 'Error DB: ' . $e->getMessage()]);
} catch (Exception $e) {
    sendJsonResponse(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>