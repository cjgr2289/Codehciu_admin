<?php
// api/partidas.php - Versión completa con reasignación de presupuesto
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once 'database.php';

error_reporting(E_ALL);
ini_set('display_errors', 1);

function sendJsonResponse($data, $httpCode = 200) {
    http_response_code($httpCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Manejar preflight
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    sendJsonResponse(['success' => true], 200);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$proyecto_id = intval($_GET['proyecto_id'] ?? 0);

// FUNCIÓN NUEVA: Calcular gastos de una partida (incluyendo subpartidas)
function calcularGastosPartida($pdo, $partida_id, $tipo) {
    $gastos = 0;
    
    if ($tipo === 'Secundaria') {
        // Para partida secundaria: sumar transacciones directamente
        $stmt = $pdo->prepare("
            SELECT SUM(monto) as total_gastado
            FROM transacciones 
            WHERE partida_id = ? 
            AND tipo = 'Egreso'
            AND status = 'Completado'
        ");
        $stmt->execute([$partida_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $gastos = floatval($result['total_gastado'] ?? 0);
    } else {
        // Para partida principal: sumar gastos de todas las subpartidas
        // Primero obtener todas las subpartidas
        $stmtSubpartidas = $pdo->prepare("
            SELECT id 
            FROM partidas 
            WHERE partida_padre_id = ? 
            AND activo = 1
        ");
        $stmtSubpartidas->execute([$partida_id]);
        $subpartidas = $stmtSubpartidas->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($subpartidas as $subpartida) {
            // Calcular gastos de cada subpartida
            $stmtGastos = $pdo->prepare("
                SELECT SUM(monto) as total_gastado
                FROM transacciones 
                WHERE partida_id = ? 
                AND tipo = 'Egreso'
                AND status = 'Completado'
            ");
            $stmtGastos->execute([$subpartida['id']]);
            $result = $stmtGastos->fetch(PDO::FETCH_ASSOC);
            $gastos += floatval($result['total_gastado'] ?? 0);
        }
    }
    
    return $gastos;
}

// FUNCIÓN NUEVA: Calcular disponible de una partida
function calcularDisponiblePartida($pdo, $partida) {
    $presupuesto_asignado = floatval($partida['presupuesto_asignado'] ?? 0);
    $gastos = calcularGastosPartida($pdo, $partida['id'], $partida['tipo']);
    
    return max(0, $presupuesto_asignado - $gastos);
}

// FUNCIÓN NUEVA: Registrar ajuste de presupuesto
function registrarAjustePresupuesto($pdo, $datos) {
    $stmt = $pdo->prepare("
        INSERT INTO ajustes_presupuesto 
        (proyecto_id, partida_id, monto_anterior, monto_nuevo, tipo, motivo, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    ");
    
    return $stmt->execute([
        $datos['proyecto_id'],
        $datos['partida_id'],
        $datos['monto_anterior'],
        $datos['monto_nuevo'],
        $datos['tipo'],
        $datos['motivo'],
        $datos['created_by']
    ]);
}

// FUNCIÓN NUEVA: Validar ajuste de presupuesto para reasignación
function validarAjustePresupuesto($pdo, $partida_id, $monto_a_transferir) {
    // Obtener datos actuales de la partida con gastos reales
    $stmt = $pdo->prepare("
        SELECT 
            p.*,
            COALESCE(SUM(CASE WHEN t.tipo = 'Egreso' THEN t.monto ELSE 0 END), 0) as total_gastado_real
        FROM partidas p
        LEFT JOIN transacciones t ON t.partida_id = p.id AND t.status = 'Completado'
        WHERE p.id = ?
        GROUP BY p.id
    ");
    $stmt->execute([$partida_id]);
    $partida = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$partida) {
        return [
            'success' => false,
            'error' => 'Partida no encontrada'
        ];
    }
    
    $presupuesto_asignado = floatval($partida['presupuesto_asignado']) || 0;
    $total_gastado = floatval($partida['total_gastado_real']) || 0;
    
    // Validación 1: El monto no debe ser mayor al presupuesto asignado
    if ($monto_a_transferir > $presupuesto_asignado) {
        return [
            'valido' => false,
            'error' => "El monto ($$monto_a_transferir) excede el presupuesto asignado ($$presupuesto_asignado)"
        ];
    }
    
    // Validación 2: Presupuesto asignado - monto - gastos no debe ser menor a 0
    $presupuesto_restante = $presupuesto_asignado - $monto_a_transferir - $total_gastado;
    
    if ($presupuesto_restante < 0) {
        return [
            'valido' => false,
            'error' => "No hay suficiente presupuesto disponible después de considerar los gastos",
            'detalle' => [
                'presupuesto_asignado' => $presupuesto_asignado,
                'monto_a_transferir' => $monto_a_transferir,
                'total_gastado' => $total_gastado,
                'presupuesto_restante' => $presupuesto_restante
            ]
        ];
    }
    
    return [
        'success' => true,
        'valido' => true,
        'datos' => [
            'presupuesto_asignado' => $presupuesto_asignado,
            'total_gastado' => $total_gastado,
            'presupuesto_disponible' => $presupuesto_asignado - $total_gastado,
            'presupuesto_restante_despues' => $presupuesto_restante
        ]
    ];
}

// FUNCIÓN NUEVA: Ejecutar reasignación de presupuesto
function ejecutarReasignacionPresupuesto($pdo, $data) {
    try {
        $pdo->beginTransaction();
        
        $proyecto_id = intval($data['proyecto_id']);
        $partida_origen_id = intval($data['partida_origen_id']);
        $partida_destino_id = intval($data['partida_destino_id']);
        $monto = floatval($data['monto']);
        $motivo = $data['motivo'];
        $usuario_id = intval($data['usuario_id']);
        
        // 1. Obtener datos actuales de partida origen
        $sql_origen = "SELECT 
                    p.*,
                    COALESCE(SUM(CASE WHEN t.tipo = 'Egreso' THEN t.monto ELSE 0 END), 0) as total_gastado_real
                FROM partidas p
                LEFT JOIN transacciones t ON t.partida_id = p.id AND t.status = 'Completado'
                WHERE p.id = ?
                GROUP BY p.id";
        $stmt_origen = $pdo->prepare($sql_origen);
        $stmt_origen->execute([$partida_origen_id]);
        $partida_origen = $stmt_origen->fetch(PDO::FETCH_ASSOC);
        
        if (!$partida_origen) {
            throw new Exception("Partida origen no encontrada");
        }
        
        // 2. Validar que el monto no sea mayor al presupuesto asignado disponible
        $presupuesto_disponible_origen = $partida_origen['presupuesto_asignado'] - $partida_origen['total_gastado_real'];
        
        if ($monto > $presupuesto_disponible_origen) {
            throw new Exception("El monto a transferir ($$monto) excede el presupuesto disponible en la partida origen ($$presupuesto_disponible_origen)");
        }
        
        // 3. Obtener datos de partida destino
        $sql_destino = "SELECT * FROM partidas WHERE id = ?";
        $stmt_destino = $pdo->prepare($sql_destino);
        $stmt_destino->execute([$partida_destino_id]);
        $partida_destino = $stmt_destino->fetch(PDO::FETCH_ASSOC);
        
        if (!$partida_destino) {
            throw new Exception("Partida destino no encontrada");
        }
        
        // 4. Guardar montos anteriores para registro
        $monto_anterior_origen = $partida_origen['presupuesto_asignado'];
        $monto_anterior_destino = $partida_destino['presupuesto_asignado'];
        
        // 5. Calcular nuevos montos
        $nuevo_monto_origen = $monto_anterior_origen - $monto;
        $nuevo_monto_destino = $monto_anterior_destino + $monto;
        
        // 6. Actualizar presupuesto_asignado en partida origen
        $sql_update_origen = "UPDATE partidas SET 
                            presupuesto_asignado = ?,
                            presupuesto_actual = LEAST(presupuesto_actual, ?),
                            updated_at = NOW()
                          WHERE id = ?";
        $stmt_update_origen = $pdo->prepare($sql_update_origen);
        $stmt_update_origen->bindParam(1, $nuevo_monto_origen, PDO::PARAM_STR);
        $stmt_update_origen->bindParam(2, $nuevo_monto_origen, PDO::PARAM_STR);
        $stmt_update_origen->bindParam(3, $partida_origen_id, PDO::PARAM_INT);
        
        if (!$stmt_update_origen->execute()) {
            throw new Exception("Error al actualizar partida origen");
        }
        
        // 7. Actualizar presupuesto_asignado en partida destino
        $sql_update_destino = "UPDATE partidas SET 
                             presupuesto_asignado = ?,
                             presupuesto_actual = presupuesto_actual + ?,
                             updated_at = NOW()
                           WHERE id = ?";
        $stmt_update_destino = $pdo->prepare($sql_update_destino);
        $stmt_update_destino->bindParam(1, $nuevo_monto_destino, PDO::PARAM_STR);
        $stmt_update_destino->bindParam(2, $monto, PDO::PARAM_STR);
        $stmt_update_destino->bindParam(3, $partida_destino_id, PDO::PARAM_INT);
        
        if (!$stmt_update_destino->execute()) {
            throw new Exception("Error al actualizar partida destino");
        }
        
        // 8. Registrar el ajuste en la tabla ajustes_presupuesto
        // Registro para partida origen
        $ajuste_origen = [
            'proyecto_id' => $proyecto_id,
            'partida_id' => $partida_origen_id,
            'monto_anterior' => $monto_anterior_origen,
            'monto_nuevo' => $nuevo_monto_origen,
            'tipo' => 'Reasignación',
            'motivo' => $motivo . " (Transferencia a partida " . $partida_destino['codigo'] . ")",
            'created_by' => $usuario_id
        ];
        
        if (!registrarAjustePresupuesto($pdo, $ajuste_origen)) {
            throw new Exception("Error al registrar ajuste para partida origen");
        }
        
        // Registro para partida destino
        $ajuste_destino = [
            'proyecto_id' => $proyecto_id,
            'partida_id' => $partida_destino_id,
            'monto_anterior' => $monto_anterior_destino,
            'monto_nuevo' => $nuevo_monto_destino,
            'tipo' => 'Reasignación',
            'motivo' => $motivo . " (Transferencia desde partida " . $partida_origen['codigo'] . ")",
            'created_by' => $usuario_id
        ];
        
        if (!registrarAjustePresupuesto($pdo, $ajuste_destino)) {
            throw new Exception("Error al registrar ajuste para partida destino");
        }
        
        $pdo->commit();
        
        return [
            'success' => true,
            'message' => 'Presupuesto reasignado correctamente',
            'data' => [
                'partida_origen' => [
                    'id' => $partida_origen_id,
                    'codigo' => $partida_origen['codigo'],
                    'monto_anterior' => $monto_anterior_origen,
                    'nuevo_presupuesto' => $nuevo_monto_origen,
                    'diferencia' => -$monto
                ],
                'partida_destino' => [
                    'id' => $partida_destino_id,
                    'codigo' => $partida_destino['codigo'],
                    'monto_anterior' => $monto_anterior_destino,
                    'nuevo_presupuesto' => $nuevo_monto_destino,
                    'diferencia' => $monto
                ]
            ]
        ];
        
    } catch (Exception $e) {
        $pdo->rollBack();
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

try {
    if (!isset($pdo) || !$pdo) {
        sendJsonResponse(['success' => false, 'error' => 'Error de conexión a base de datos'], 500);
    }

    if ($method === 'GET') {
        switch ($action) {
            case 'listar':
                if ($proyecto_id <= 0) {
                    sendJsonResponse([
                        'success' => false,
                        'error' => 'ID de proyecto requerido',
                        'proyecto_id_recibido' => $_GET['proyecto_id'] ?? 'N/A'
                    ], 400);
                }

                // Verificar si el proyecto existe
                $stmtCheck = $pdo->prepare("SELECT id FROM proyectos WHERE id = ?");
                $stmtCheck->execute([$proyecto_id]);
                if (!$stmtCheck->fetch()) {
                    sendJsonResponse([
                        'success' => false,
                        'error' => 'Proyecto no encontrado',
                        'proyecto_id' => $proyecto_id
                    ], 404);
                }

                // Obtener todas las partidas del proyecto
                $stmt = $pdo->prepare("
                    SELECT
                        id,
                        codigo,
                        nombre,
                        descripcion,
                        presupuesto_asignado,
                        presupuesto_actual,
                        tipo,
                        partida_padre_id,
                        DATE_FORMAT(created_at, '%d/%m/%Y %H:%i') as fecha_creacion
                    FROM partidas
                    WHERE proyecto_id = ? AND activo = 1
                    ORDER BY tipo, codigo, nombre
                ");
                $stmt->execute([$proyecto_id]);
                $partidas = $stmt->fetchAll(PDO::FETCH_ASSOC);

                // Calcular valores reales para cada partida
                foreach ($partidas as &$partida) {
                    // Asegurar valores numéricos
                    $partida['presupuesto_asignado'] = floatval($partida['presupuesto_asignado']);
                    $partida['presupuesto_actual'] = floatval($partida['presupuesto_actual']);
                    $partida['partida_padre_id'] = $partida['partida_padre_id'] ? intval($partida['partida_padre_id']) : null;
                    
                    // Calcular gastos REALES según tipo de partida
                    $partida['total_gastado_real'] = calcularGastosPartida($pdo, $partida['id'], $partida['tipo']);
                    
                    // Calcular disponible REAL
                    $partida['disponible_real'] = calcularDisponiblePartida($pdo, $partida);
                    
                    // Calcular porcentaje gastado
                    $partida['porcentaje_gastado'] = $partida['presupuesto_asignado'] > 0 ? 
                        ($partida['total_gastado_real'] / $partida['presupuesto_asignado']) * 100 : 0;
                    
                    // Calcular porcentaje disponible
                    $partida['porcentaje_disponible'] = 100 - $partida['porcentaje_gastado'];
                }
                unset($partida); // Liberar referencia

                sendJsonResponse([
                    'success' => true,
                    'partidas' => $partidas,
                    'total' => count($partidas),
                    'proyecto_id' => $proyecto_id,
                    'nota' => 'Los valores reales se calculan basados en transacciones completadas'
                ]);
                break;

            case 'listar-principales':
                if ($proyecto_id <= 0) {
                    sendJsonResponse(['success' => false, 'error' => 'ID de proyecto requerido'], 400);
                }
                
                $stmt = $pdo->prepare("
                    SELECT 
                        id, 
                        codigo, 
                        nombre, 
                        presupuesto_asignado, 
                        presupuesto_actual,
                        tipo
                    FROM partidas 
                    WHERE proyecto_id = ? 
                    AND tipo = 'Principal' 
                    AND activo = 1
                    ORDER BY codigo
                ");
                $stmt->execute([$proyecto_id]);
                $partidas = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Calcular valores reales para cada partida principal
                foreach ($partidas as &$partida) {
                    $partida['presupuesto_asignado'] = floatval($partida['presupuesto_asignado']);
                    $partida['presupuesto_actual'] = floatval($partida['presupuesto_actual']);
                    
                    // Calcular gastos sumando subpartidas
                    $partida['total_gastado_real'] = calcularGastosPartida($pdo, $partida['id'], 'Principal');
                    $partida['disponible_real'] = calcularDisponiblePartida($pdo, $partida);
                }
                unset($partida);
                
                sendJsonResponse(['success' => true, 'partidas' => $partidas]);
                break;

            case 'obtener':
                if (empty($_GET['id'])) {
                    sendJsonResponse(['success' => false, 'error' => 'ID requerido'], 400);
                }

                $partida_id = intval($_GET['id']);
                
                $stmt = $pdo->prepare("SELECT * FROM partidas WHERE id = ?");
                $stmt->execute([$partida_id]);
                $partida = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$partida) {
                    sendJsonResponse(['success' => false, 'error' => 'Partida no encontrada'], 404);
                }

                // Calcular valores reales
                $partida['presupuesto_asignado'] = floatval($partida['presupuesto_asignado']);
                $partida['presupuesto_actual'] = floatval($partida['presupuesto_actual']);
                $partida['partida_padre_id'] = $partida['partida_padre_id'] ? intval($partida['partida_padre_id']) : null;
                
                // Calcular gastos REALES según tipo
                $partida['total_gastado_real'] = calcularGastosPartida($pdo, $partida_id, $partida['tipo']);
                
                // Calcular disponible REAL
                $partida['disponible_real'] = calcularDisponiblePartida($pdo, $partida);
                
                // Calcular porcentajes
                $partida['porcentaje_gastado'] = $partida['presupuesto_asignado'] > 0 ? 
                    ($partida['total_gastado_real'] / $partida['presupuesto_asignado']) * 100 : 0;
                $partida['porcentaje_disponible'] = 100 - $partida['porcentaje_gastado'];

                sendJsonResponse(['success' => true, 'partida' => $partida]);
                break;

            case 'obtener-tipo':
                if (empty($_GET['id'])) {
                    sendJsonResponse(['success' => false, 'error' => 'ID requerido'], 400);
                }
                
                $stmt = $pdo->prepare("SELECT id, tipo FROM partidas WHERE id = ?");
                $stmt->execute([$_GET['id']]);
                $partida = $stmt->fetch(PDO::FETCH_ASSOC);
                
                sendJsonResponse(['success' => true, 'partida' => $partida]);
                break;

            case 'validar-presupuesto':
                $padre_id = intval($_GET['padre_id'] ?? 0);
                $nuevo_presupuesto = floatval($_GET['nuevo_presupuesto'] ?? 0);
                
                if ($padre_id <= 0 || $nuevo_presupuesto <= 0) {
                    sendJsonResponse(['success' => false, 'error' => 'Parámetros inválidos'], 400);
                }
                
                // Obtener presupuesto de partida padre
                $stmtPadre = $pdo->prepare("SELECT presupuesto_asignado FROM partidas WHERE id = ?");
                $stmtPadre->execute([$padre_id]);
                $padre = $stmtPadre->fetch(PDO::FETCH_ASSOC);
                
                if (!$padre) {
                    sendJsonResponse(['success' => false, 'error' => 'Partida padre no encontrada'], 404);
                }
                
                // Calcular presupuesto ya asignado a subpartidas
                $stmtSubpartidas = $pdo->prepare("
                    SELECT SUM(presupuesto_asignado) as total_asignado
                    FROM partidas 
                    WHERE partida_padre_id = ? AND activo = 1
                ");
                $stmtSubpartidas->execute([$padre_id]);
                $subpartidas = $stmtSubpartidas->fetch(PDO::FETCH_ASSOC);
                
                $totalAsignado = ($subpartidas['total_asignado'] ?? 0) + $nuevo_presupuesto;
                $disponible = floatval($padre['presupuesto_asignado']) - ($subpartidas['total_asignado'] ?? 0);
                $valido = $totalAsignado <= $padre['presupuesto_asignado'];
                
                sendJsonResponse([
                    'success' => true,
                    'valido' => $valido,
                    'presupuesto_padre' => floatval($padre['presupuesto_asignado']),
                    'total_asignado' => $totalAsignado,
                    'disponible' => $disponible
                ]);
                break;

            // NUEVA ACCIÓN: Validar ajuste para reasignación
            case 'validar-ajuste':
                $partida_origen_id = intval($_GET['partida_origen_id'] ?? 0);
                $monto = floatval($_GET['monto'] ?? 0);
                
                if ($partida_origen_id <= 0 || $monto <= 0) {
                    sendJsonResponse(['success' => false, 'error' => 'Parámetros inválidos'], 400);
                }
                
                $resultado = validarAjustePresupuesto($pdo, $partida_origen_id, $monto);
                sendJsonResponse($resultado);
                break;

            case 'calcular-consolidado':
                // NUEVA ACCIÓN: Calcular consolidado para partida principal
                $partida_id = intval($_GET['partida_id'] ?? 0);
                
                if ($partida_id <= 0) {
                    sendJsonResponse(['success' => false, 'error' => 'ID de partida requerido'], 400);
                }
                
                // Verificar que sea partida principal
                $stmtTipo = $pdo->prepare("SELECT tipo FROM partidas WHERE id = ?");
                $stmtTipo->execute([$partida_id]);
                $tipo = $stmtTipo->fetchColumn();
                
                if ($tipo !== 'Principal') {
                    sendJsonResponse(['success' => false, 'error' => 'Solo se puede calcular consolidado para partidas principales'], 400);
                }
                
                // Obtener partida padre
                $stmtPadre = $pdo->prepare("
                    SELECT id, codigo, nombre, presupuesto_asignado 
                    FROM partidas 
                    WHERE id = ?
                ");
                $stmtPadre->execute([$partida_id]);
                $partidaPadre = $stmtPadre->fetch(PDO::FETCH_ASSOC);
                
                // Obtener todas las subpartidas
                $stmtSubpartidas = $pdo->prepare("
                    SELECT 
                        id,
                        codigo,
                        nombre,
                        presupuesto_asignado,
                        presupuesto_actual
                    FROM partidas 
                    WHERE partida_padre_id = ? 
                    AND activo = 1
                    ORDER BY codigo
                ");
                $stmtSubpartidas->execute([$partida_id]);
                $subpartidas = $stmtSubpartidas->fetchAll(PDO::FETCH_ASSOC);
                
                // Calcular valores consolidados
                $total_asignado_consolidado = 0;
                $total_gastado_consolidado = 0;
                $total_disponible_consolidado = 0;
                
                foreach ($subpartidas as &$subpartida) {
                    $subpartida['presupuesto_asignado'] = floatval($subpartida['presupuesto_asignado']);
                    $subpartida['presupuesto_actual'] = floatval($subpartida['presupuesto_actual']);
                    
                    // Calcular gastos de la subpartida
                    $gastos = calcularGastosPartida($pdo, $subpartida['id'], 'Secundaria');
                    $disponible = max(0, $subpartida['presupuesto_asignado'] - $gastos);
                    
                    $subpartida['total_gastado_real'] = $gastos;
                    $subpartida['disponible_real'] = $disponible;
                    
                    // Acumular para consolidado
                    $total_asignado_consolidado += $subpartida['presupuesto_asignado'];
                    $total_gastado_consolidado += $gastos;
                    $total_disponible_consolidado += $disponible;
                }
                unset($subpartida);
                
                // Calcular porcentajes del consolidado
                $porcentaje_gastado_consolidado = $total_asignado_consolidado > 0 ? 
                    ($total_gastado_consolidado / $total_asignado_consolidado) * 100 : 0;
                $porcentaje_disponible_consolidado = 100 - $porcentaje_gastado_consolidado;
                
                sendJsonResponse([
                    'success' => true,
                    'partida_principal' => $partidaPadre,
                    'subpartidas' => $subpartidas,
                    'consolidado' => [
                        'total_asignado' => $total_asignado_consolidado,
                        'total_gastado' => $total_gastado_consolidado,
                        'total_disponible' => $total_disponible_consolidado,
                        'porcentaje_gastado' => $porcentaje_gastado_consolidado,
                        'porcentaje_disponible' => $porcentaje_disponible_consolidado
                    ],
                    'total_subpartidas' => count($subpartidas)
                ]);
                break;

            // NUEVA ACCIÓN: Obtener historial de ajustes
            case 'historial-ajustes':
                $partida_id = intval($_GET['partida_id'] ?? 0);
                $proyecto_id = intval($_GET['proyecto_id'] ?? 0);
                $limit = intval($_GET['limit'] ?? 50);
                
                $sql = "
                    SELECT 
                        a.*,
                        DATE_FORMAT(a.created_at, '%d/%m/%Y %H:%i') as fecha_formateada,
                        p.codigo as partida_codigo,
                        p.nombre as partida_nombre,
                        u.nombre as usuario_nombre
                    FROM ajustes_presupuesto a
                    LEFT JOIN partidas p ON p.id = a.partida_id
                    LEFT JOIN usuarios u ON u.id = a.created_by
                    WHERE 1=1
                ";
                
                $params = [];
                $types = "";
                
                if ($partida_id > 0) {
                    $sql .= " AND a.partida_id = ?";
                    $params[] = $partida_id;
                    $types .= "i";
                }
                
                if ($proyecto_id > 0) {
                    $sql .= " AND a.proyecto_id = ?";
                    $params[] = $proyecto_id;
                    $types .= "i";
                }
                
                $sql .= " ORDER BY a.created_at DESC LIMIT ?";
                $params[] = $limit;
                $types .= "i";
                
                $stmt = $pdo->prepare($sql);
                
                if (!empty($params)) {
                    $stmt->bind_param($types, ...$params);
                }
                
                $stmt->execute();
                $result = $stmt->get_result();
                $ajustes = $result->fetch_all(MYSQLI_ASSOC);
                
                sendJsonResponse([
                    'success' => true,
                    'ajustes' => $ajustes,
                    'total' => count($ajustes)
                ]);
                break;

                // En el switch case 'GET' de partidas.php, agregar:

                    case 'graficos-principales':
                if ($proyecto_id <= 0) {
                    sendJsonResponse(['success' => false, 'error' => 'ID de proyecto requerido'], 400);
                }

                // Obtener solo partidas principales del proyecto
                $stmt = $pdo->prepare("
                    SELECT
                        id,
                        codigo,
                        nombre,
                        presupuesto_asignado,
                        tipo
                    FROM partidas
                    WHERE proyecto_id = ? 
                    AND tipo = 'Principal' 
                    AND activo = 1
                    ORDER BY codigo
                ");
                $stmt->execute([$proyecto_id]);
                $partidasPrincipales = $stmt->fetchAll(PDO::FETCH_ASSOC);

                if (empty($partidasPrincipales)) {
                    sendJsonResponse([
                        'success' => true,
                        'graficos' => [
                            'distribucion' => ['labels' => [], 'data' => []],
                            'gastos' => ['labels' => [], 'data' => []]
                        ],
                        'message' => 'No hay partidas principales en este proyecto'
                    ]);
                }

                // Preparar datos para los gráficos
                $labelsDistribucion = [];
                $dataDistribucion = [];
                $labelsGastos = [];
                $dataGastos = [];

                foreach ($partidasPrincipales as $partida) {
                    $presupuesto = floatval($partida['presupuesto_asignado']);
                    $gastos = calcularGastosPartida($pdo, $partida['id'], 'Principal');
                    
                    // Solo incluir en gráficos si tiene presupuesto > 0
                    if ($presupuesto > 0) {
                        // Gráfico de distribución (presupuesto asignado)
                        $labelsDistribucion[] = $partida['codigo'] . ' - ' . $partida['nombre'];
                        $dataDistribucion[] = $presupuesto;
                        
                        // Gráfico de gastos (gastos reales)
                        if ($gastos > 0) {
                            $labelsGastos[] = $partida['codigo'] . ' - ' . $partida['nombre'];
                            $dataGastos[] = $gastos;
                        }
                    }
                }

                sendJsonResponse([
                    'success' => true,
                    'graficos' => [
                        'distribucion' => [
                            'labels' => $labelsDistribucion,
                            'data' => $dataDistribucion
                        ],
                        'gastos' => [
                            'labels' => $labelsGastos,
                            'data' => $dataGastos
                        ]
                    ],
                    'total_partidas' => count($partidasPrincipales),
                    'proyecto_id' => $proyecto_id
                ]);
                break;

            default:
                sendJsonResponse([
                    'success' => false,
                    'error' => 'Acción GET no válida',
                    'acciones_validas' => ['listar', 'listar-principales', 'obtener', 'obtener-tipo', 
                                          'validar-presupuesto', 'validar-ajuste', 'calcular-consolidado',
                                          'historial-ajustes']
                ], 400);
        }
    } elseif ($method === 'POST') {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            sendJsonResponse([
                'success' => false,
                'error' => 'Datos JSON inválidos: ' . json_last_error_msg(),
                'raw_input' => substr($input, 0, 200)
            ], 400);
        }

        switch ($action) {
            case 'crear':
                // Validar campos requeridos
                $required = ['proyecto_id', 'codigo', 'nombre', 'presupuesto_asignado', 'tipo'];
                $missing = [];

                foreach ($required as $field) {
                    if (empty($data[$field])) {
                        $missing[] = $field;
                    }
                }

                if (!empty($missing)) {
                    sendJsonResponse([
                        'success' => false,
                        'error' => 'Campos requeridos faltantes: ' . implode(', ', $missing),
                        'data_recibida' => array_keys($data)
                    ], 400);
                }

                // Validar tipo
                $tiposPermitidos = ['Principal', 'Secundaria'];
                if (!in_array($data['tipo'], $tiposPermitidos)) {
                    sendJsonResponse([
                        'success' => false,
                        'error' => 'Tipo de partida no válido',
                        'tipo_recibido' => $data['tipo'],
                        'tipos_permitidos' => $tiposPermitidos
                    ], 400);
                }

                // Validar que el proyecto existe
                $stmtCheck = $pdo->prepare("SELECT id FROM proyectos WHERE id = ?");
                $stmtCheck->execute([$data['proyecto_id']]);
                if (!$stmtCheck->fetch()) {
                    sendJsonResponse([
                        'success' => false,
                        'error' => 'Proyecto no encontrado',
                        'proyecto_id' => $data['proyecto_id']
                    ], 404);
                }

                // Validar que el código no exista en el mismo proyecto
                $stmtCheckCodigo = $pdo->prepare("
                    SELECT id FROM partidas
                    WHERE proyecto_id = ? AND codigo = ? AND activo = 1
                ");
                $stmtCheckCodigo->execute([$data['proyecto_id'], $data['codigo']]);
                if ($stmtCheckCodigo->fetch()) {
                    sendJsonResponse([
                        'success' => false,
                        'error' => 'Ya existe una partida con este código en el proyecto',
                        'codigo' => $data['codigo']
                    ], 409);
                }

                // Validar presupuesto
                $presupuesto = floatval($data['presupuesto_asignado']);
                if ($presupuesto <= 0) {
                    sendJsonResponse([
                        'success' => false,
                        'error' => 'El presupuesto asignado debe ser mayor a 0',
                        'presupuesto_recibido' => $data['presupuesto_asignado']
                    ], 400);
                }

                // Validar partida padre si es secundaria
                $partidaPadreId = null;
                if ($data['tipo'] === 'Secundaria') {
                    if (empty($data['partida_padre_id'])) {
                        sendJsonResponse([
                            'success' => false,
                            'error' => 'Para partidas secundarias se requiere especificar la partida padre'
                        ], 400);
                    }

                    // Verificar que la partida padre exista y sea principal
                    $stmtPadre = $pdo->prepare("
                        SELECT id, presupuesto_asignado, presupuesto_actual 
                        FROM partidas 
                        WHERE id = ? AND tipo = 'Principal' AND activo = 1 AND proyecto_id = ?
                    ");
                    $stmtPadre->execute([$data['partida_padre_id'], $data['proyecto_id']]);
                    $partidaPadre = $stmtPadre->fetch(PDO::FETCH_ASSOC);
                    
                    if (!$partidaPadre) {
                        sendJsonResponse([
                            'success' => false,
                            'error' => 'La partida padre seleccionada no existe, no es principal o pertenece a otro proyecto'
                        ], 400);
                    }
                    
                    // Calcular presupuesto ya asignado a subpartidas
                    $stmtSubpartidas = $pdo->prepare("
                        SELECT SUM(presupuesto_asignado) as total_asignado
                        FROM partidas 
                        WHERE partida_padre_id = ? AND activo = 1
                    ");
                    $stmtSubpartidas->execute([$data['partida_padre_id']]);
                    $subpartidas = $stmtSubpartidas->fetch(PDO::FETCH_ASSOC);
                    
                    $totalAsignado = ($subpartidas['total_asignado'] ?? 0) + $presupuesto;
                    if ($totalAsignado > $partidaPadre['presupuesto_asignado']) {
                        sendJsonResponse([
                            'success' => false,
                            'error' => 'El presupuesto total de las subpartidas excede el presupuesto de la partida padre',
                            'presupuesto_padre' => $partidaPadre['presupuesto_asignado'],
                            'total_asignado' => $totalAsignado,
                            'disponible' => $partidaPadre['presupuesto_asignado'] - ($subpartidas['total_asignado'] ?? 0)
                        ], 400);
                    }
                    
                    $partidaPadreId = $data['partida_padre_id'];
                } else {
                    // Si es principal, asegurar que partida_padre_id sea NULL
                    $partidaPadreId = null;
                }
                
                // Insertar partida
                $stmt = $pdo->prepare("
                    INSERT INTO partidas
                    (proyecto_id, codigo, nombre, descripcion, presupuesto_asignado, 
                     presupuesto_actual, tipo, partida_padre_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ");

                $result = $stmt->execute([
                    $data['proyecto_id'],
                    trim($data['codigo']),
                    trim($data['nombre']),
                    trim($data['descripcion'] ?? ''),
                    $presupuesto,
                    $presupuesto, // presupuesto_actual inicial = presupuesto_asignado
                    $data['tipo'],
                    $partidaPadreId
                ]);

                if ($result) {
                    $idInsertado = $pdo->lastInsertId();

                    // Devolver también los campos que el frontend necesita
                    $partidaCreada = [
                        'id' => $idInsertado,
                        'codigo' => $data['codigo'],
                        'nombre' => $data['nombre'],
                        'tipo' => $data['tipo'],
                        'partida_padre_id' => $partidaPadreId,
                        'presupuesto_asignado' => $presupuesto,
                        'presupuesto_actual' => $presupuesto,
                        'total_gastado_real' => 0, // Inicialmente 0
                        'disponible_real' => $presupuesto // Inicialmente igual al presupuesto
                    ];

                    sendJsonResponse([
                        'success' => true,
                        'message' => 'Partida creada correctamente',
                        'id' => $idInsertado,
                        'partida' => $partidaCreada
                    ], 201);
                } else {
                    sendJsonResponse([
                        'success' => false,
                        'error' => 'Error al insertar en la base de datos',
                        'error_info' => $stmt->errorInfo()
                    ], 500);
                }
                break;

            case 'ajustar':
                if (empty($data['id'])) {
                    sendJsonResponse(['success' => false, 'error' => 'ID requerido'], 400);
                }

                // Validar que la partida existe
                $stmtCheck = $pdo->prepare("SELECT * FROM partidas WHERE id = ?");
                $stmtCheck->execute([$data['id']]);
                $partidaActual = $stmtCheck->fetch(PDO::FETCH_ASSOC);

                if (!$partidaActual) {
                    sendJsonResponse(['success' => false, 'error' => 'Partida no encontrada'], 404);
                }

                // Obtener montos anteriores
                $monto_anterior_asignado = floatval($partidaActual['presupuesto_asignado']);
                $monto_anterior_actual = floatval($partidaActual['presupuesto_actual']);
                
                $monto_nuevo_asignado = floatval($data['presupuesto_asignado']);
                $monto_nuevo_actual = floatval($data['presupuesto_actual']);
                
                // Determinar tipo de ajuste
                $tipo_ajuste = '';
                if ($monto_nuevo_asignado > $monto_anterior_asignado) {
                    $tipo_ajuste = 'Aumento';
                } elseif ($monto_nuevo_asignado < $monto_anterior_asignado) {
                    $tipo_ajuste = 'Disminución';
                } else {
                    $tipo_ajuste = 'Ajuste';
                }

                // Actualizar partida
                $stmt = $pdo->prepare("
                    UPDATE partidas SET
                    presupuesto_actual = ?,
                    presupuesto_asignado = ?,
                    updated_at = NOW()
                    WHERE id = ?
                ");

                $result = $stmt->execute([
                    $monto_nuevo_actual,
                    $monto_nuevo_asignado,
                    $data['id']
                ]);

                if ($result) {
                    // Registrar ajuste en historial
                    $ajuste_data = [
                        'proyecto_id' => $partidaActual['proyecto_id'],
                        'partida_id' => $data['id'],
                        'monto_anterior' => $monto_anterior_asignado,
                        'monto_nuevo' => $monto_nuevo_asignado,
                        'tipo' => $tipo_ajuste,
                        'motivo' => $data['justificacion'] ?? 'Ajuste manual',
                        'created_by' => $data['usuario_id'] ?? 1
                    ];
                    
                    registrarAjustePresupuesto($pdo, $ajuste_data);
                    
                    sendJsonResponse([
                        'success' => true,
                        'message' => 'Presupuesto ajustado correctamente',
                        'ajuste_registrado' => true
                    ]);
                } else {
                    sendJsonResponse(['success' => false, 'error' => 'Error al ajustar presupuesto'], 500);
                }
                break;

            // NUEVA ACCIÓN: Ajustar presupuesto con reasignación
            case 'ajustar-presupuesto':
                // Validar campos requeridos
                $required = ['proyecto_id', 'partida_origen_id', 'partida_destino_id', 'monto', 'motivo', 'usuario_id'];
                $missing = [];

                foreach ($required as $field) {
                    if (empty($data[$field])) {
                        $missing[] = $field;
                    }
                }

                if (!empty($missing)) {
                    sendJsonResponse([
                        'success' => false,
                        'error' => 'Campos requeridos faltantes: ' . implode(', ', $missing)
                    ], 400);
                }

                // Validar que las partidas sean diferentes
                if ($data['partida_origen_id'] == $data['partida_destino_id']) {
                    sendJsonResponse([
                        'success' => false,
                        'error' => 'La partida origen y destino no pueden ser la misma'
                    ], 400);
                }

                // Validar monto positivo
                if ($data['monto'] <= 0) {
                    sendJsonResponse([
                        'success' => false,
                        'error' => 'El monto a transferir debe ser mayor a 0'
                    ], 400);
                }

                // Ejecutar reasignación
                $resultado = ejecutarReasignacionPresupuesto($pdo, $data);
                sendJsonResponse($resultado);
                break;

            default:
                sendJsonResponse([
                    'success' => false,
                    'error' => 'Acción POST no válida',
                    'acciones_validas' => ['crear', 'ajustar', 'ajustar-presupuesto']
                ], 400);
        }
    } else {
        sendJsonResponse([
            'success' => false,
            'error' => 'Método HTTP no permitido',
            'metodo_recibido' => $method,
            'metodos_permitidos' => ['GET', 'POST']
        ], 405);
    }
} catch (PDOException $e) {
    sendJsonResponse([
        'success' => false,
        'error' => 'Error de base de datos: ' . $e->getMessage(),
        'error_code' => $e->getCode(),
        'trace' => $e->getTraceAsString()
    ], 500);
} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'error' => 'Error interno: ' . $e->getMessage(),
        'archivo' => $e->getFile(),
        'linea' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ], 500);
}
?>