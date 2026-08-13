<?php
// api/proyectos.php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Definir función de respuesta lo antes posible
function sendJsonResponse($data, $httpCode = 200) {
    http_response_code($httpCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Manejo de errores personalizado para capturar cualquier error antes de la salida
set_exception_handler(function($e) {
    sendJsonResponse(['success' => false, 'error' => 'Error interno: ' . $e->getMessage()], 500);
});

// Manejar preflight
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    sendJsonResponse(['success' => true], 200);
}

// Incluir database.php (ruta correcta)
require_once __DIR__ . '/database.php';  // Ajusta si database.php está en otra carpeta

// Iniciar sesión (si no está iniciada)
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    sendJsonResponse(['success' => false, 'error' => 'No autorizado'], 401);
}
$user_id = $_SESSION['user_id'];
$user_role = $_SESSION['user_role'] ?? 'regular';

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
                $estado = $_GET['estado'] ?? null;

                $sql = "SELECT p.* FROM proyectos p WHERE 1=1";
                $params = [];

                $roleLower = strtolower($user_role);
                if ($roleLower === 'coord' || $roleLower === 'coordinador' || $roleLower === 'socio') {
                    $sql .= " AND p.id IN (SELECT up.proyecto_id FROM usuario_proyecto up WHERE up.usuario_id = ? AND up.activo = 1)";
                    $params[] = $user_id;
                } elseif (!in_array($roleLower, ['admin', 'administrador', 'contab', 'contador', 'directivo'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Permisos insuficientes'], 403);
                }

                if ($estado) {
                    $sql .= " AND p.estado = ?";
                    $params[] = $estado;
                }

                $sql .= " ORDER BY p.created_at DESC";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $proyectos = $stmt->fetchAll(PDO::FETCH_ASSOC);

                sendJsonResponse([
                    'success' => true,
                    'proyectos' => $proyectos
                ]);
                break;
                
                $estado = $_GET['estado'] ?? null;

                $sql = "SELECT p.* FROM proyectos p WHERE 1=1";
                $params = [];

                // Filtrar según rol
                $roleLower = strtolower($user_role);
                if ($roleLower === 'coord' || $roleLower === 'coordinador' || $roleLower === 'socio') {
                    $sql .= " AND p.id IN (SELECT up.proyecto_id FROM usuario_proyecto up WHERE up.usuario_id = ? AND up.activo = 1)";
                    $params[] = $user_id;
                } elseif (!in_array($roleLower, ['admin', 'administrador', 'contab', 'contador', 'directivo'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Permisos insuficientes'], 403);
                }

                if ($estado) {
                    $sql .= " AND p.estado = ?";
                    $params[] = $estado;
                }

                $sql .= " ORDER BY p.created_at DESC";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $proyectos = $stmt->fetchAll(PDO::FETCH_ASSOC);

                sendJsonResponse([
                    'success' => true,
                    'proyectos' => $proyectos
                ]);
                break;

            case 'obtener':
                if ($id <= 0) {
                    sendJsonResponse(['success' => false, 'error' => 'ID inválido'], 400);
                }

                $stmt = $pdo->prepare("SELECT * FROM proyectos WHERE id = ?");
                $stmt->execute([$id]);
                $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$proyecto) {
                    sendJsonResponse(['success' => false, 'error' => 'Proyecto no encontrado'], 404);
                }

                sendJsonResponse([
                    'success' => true,
                    'proyecto' => $proyecto
                ]);
                break;

            case 'resumen':
                if ($id <= 0) {
                    sendJsonResponse(['success' => false, 'error' => 'ID inválido'], 400);
                }

                $stmt = $pdo->prepare("SELECT * FROM proyectos WHERE id = ?");
                $stmt->execute([$id]);
                $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$proyecto) {
                    sendJsonResponse(['success' => false, 'error' => 'Proyecto no encontrado'], 404);
                }

                // Calcular total de transacciones
                $stmtIngresos = $pdo->prepare("
                    SELECT COALESCE(SUM(monto), 0) as total
                    FROM transacciones
                    WHERE proyecto_id = ? AND tipo = 'Ingreso'
                ");
                $stmtIngresos->execute([$id]);
                $totalIngresos = $stmtIngresos->fetch(PDO::FETCH_ASSOC)['total'];

                $stmtEgresos = $pdo->prepare("
                    SELECT COALESCE(SUM(monto), 0) as total
                    FROM transacciones
                    WHERE proyecto_id = ? AND tipo = 'Egreso'
                ");
                $stmtEgresos->execute([$id]);
                $totalEgresos = $stmtEgresos->fetch(PDO::FETCH_ASSOC)['total'];

                $presupuestoTotal = floatval($proyecto['presupuesto']);
                $disponible = $presupuestoTotal + $totalIngresos - $totalEgresos;

                $porcentajeIngresos = $presupuestoTotal > 0 ? ($totalIngresos / $presupuestoTotal) * 100 : 0;
                $porcentajeEgresos = $presupuestoTotal > 0 ? ($totalEgresos / $presupuestoTotal) * 100 : 0;
                $porcentajeDisponible = $presupuestoTotal > 0 ? ($disponible / $presupuestoTotal) * 100 : 0;

                sendJsonResponse([
                    'success' => true,
                    'resumen' => [
                        'presupuesto_total' => $presupuestoTotal,
                        'total_ingresos' => $totalIngresos,
                        'total_egresos' => $totalEgresos,
                        'disponible' => $disponible,
                        'porcentaje_ingresos' => round($porcentajeIngresos, 2),
                        'porcentaje_egresos' => round($porcentajeEgresos, 2),
                        'porcentaje_disponible' => round($porcentajeDisponible, 2)
                    ]
                ]);
                break;

            case 'graficos':
                if ($id <= 0) {
                    sendJsonResponse(['success' => false, 'error' => 'ID inválido'], 400);
                }

                $stmtDistribucion = $pdo->prepare("
                    SELECT
                        p.nombre,
                        p.presupuesto_asignado
                    FROM partidas p
                    WHERE p.proyecto_id = ? AND p.activo = 1
                    ORDER BY p.presupuesto_asignado DESC
                ");
                $stmtDistribucion->execute([$id]);
                $partidasDistribucion = $stmtDistribucion->fetchAll(PDO::FETCH_ASSOC);

                $stmtGastos = $pdo->prepare("
                    SELECT
                        p.nombre,
                        COALESCE(SUM(CASE WHEN t.tipo = 'Egreso' THEN t.monto ELSE 0 END), 0) as gastado
                    FROM partidas p
                    LEFT JOIN transacciones t ON p.id = t.partida_id AND t.status = 'Completado'
                    WHERE p.proyecto_id = ? AND p.activo = 1
                    GROUP BY p.id, p.nombre
                    HAVING gastado > 0
                    ORDER BY gastado DESC
                    LIMIT 10
                ");
                $stmtGastos->execute([$id]);
                $partidasGastos = $stmtGastos->fetchAll(PDO::FETCH_ASSOC);

                $distribucionLabels = [];
                $distribucionData = [];

                foreach ($partidasDistribucion as $partida) {
                    $presupuesto = floatval($partida['presupuesto_asignado']);
                    if ($presupuesto > 0) {
                        $distribucionLabels[] = $partida['nombre'];
                        $distribucionData[] = $presupuesto;
                    }
                }

                $gastosLabels = [];
                $gastosData = [];

                foreach ($partidasGastos as $partida) {
                    $gastado = floatval($partida['gastado']);
                    if ($gastado > 0) {
                        $gastosLabels[] = $partida['nombre'];
                        $gastosData[] = $gastado;
                    }
                }

                if (empty($gastosData)) {
                    $gastosLabels = ['Sin gastos registrados'];
                    $gastosData = [0];
                }

                sendJsonResponse([
                    'success' => true,
                    'graficos' => [
                        'distribucion' => [
                            'labels' => $distribucionLabels,
                            'data' => $distribucionData
                        ],
                        'gastos' => [
                            'labels' => $gastosLabels,
                            'data' => $gastosData
                        ]
                    ],
                    'metadata' => [
                        'total_partidas_con_presupuesto' => count($distribucionData),
                        'total_partidas_con_gastos' => count($gastosData) > 0 && $gastosLabels[0] !== 'Sin gastos registrados' ? count($gastosData) : 0
                    ]
                ]);
                break;

            default:
                sendJsonResponse([
                    'success' => false,
                    'error' => 'Acción no válida',
                    'acciones_validas' => ['listar', 'obtener', 'resumen', 'graficos']
                ], 400);
        }
    } elseif ($method === 'POST') {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            sendJsonResponse(['success' => false, 'error' => 'JSON inválido'], 400);
        }

        switch ($action) {
            case 'crear':
                $required = ['nombre', 'presupuesto'];
                foreach ($required as $field) {
                    if (empty($data[$field])) {
                        sendJsonResponse(['success' => false, 'error' => "Campo $field requerido"], 400);
                    }
                }

                $stmt = $pdo->prepare("
                    INSERT INTO proyectos
                    (nombre, descripcion, cliente, presupuesto, fecha_inicio, fecha_fin, estado)
                    VALUES (?, ?, ?, ?, ?, ?, 'Activo')
                ");

                $result = $stmt->execute([
                    $data['nombre'],
                    $data['descripcion'] ?? '',
                    $data['cliente'] ?? '',
                    floatval($data['presupuesto']),
                    $data['fecha_inicio'] ?? null,
                    $data['fecha_fin'] ?? null
                ]);

                if ($result) {
                    sendJsonResponse([
                        'success' => true,
                        'message' => 'Proyecto creado correctamente',
                        'id' => $pdo->lastInsertId()
                    ], 201);
                } else {
                    sendJsonResponse(['success' => false, 'error' => 'Error al crear proyecto'], 500);
                }
                break;

            case 'cerrar':
                if (empty($data['id'])) {
                    sendJsonResponse(['success' => false, 'error' => 'ID requerido'], 400);
                }

                $stmt = $pdo->prepare("UPDATE proyectos SET estado = 'Completado' WHERE id = ?");
                $result = $stmt->execute([$data['id']]);

                if ($result && $stmt->rowCount() > 0) {
                    sendJsonResponse([
                        'success' => true,
                        'message' => 'Proyecto cerrado correctamente'
                    ]);
                } else {
                    sendJsonResponse(['success' => false, 'error' => 'Proyecto no encontrado'], 404);
                }
                break;

            case 'reabrir':
                if (empty($data['id'])) {
                    sendJsonResponse(['success' => false, 'error' => 'ID requerido'], 400);
                }

                $stmt = $pdo->prepare("UPDATE proyectos SET estado = 'Activo' WHERE id = ?");
                $result = $stmt->execute([$data['id']]);

                if ($result && $stmt->rowCount() > 0) {
                    sendJsonResponse([
                        'success' => true,
                        'message' => 'Proyecto reabierto correctamente'
                    ]);
                } else {
                    sendJsonResponse(['success' => false, 'error' => 'Proyecto no encontrado'], 404);
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