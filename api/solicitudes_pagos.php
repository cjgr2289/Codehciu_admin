<?php
/**
 * API Principal para Solicitudes de Pagos
 * CODEHCIU - Sistema de Finanzas
 * Con soporte para Honorarios/Terceros
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
require_once 'email_config.php';

session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$usuario_id = $_SESSION['user_id'];
$rol = $_SESSION['user_role'] ?? '';

// Leer action de múltiples fuentes
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// Si no viene en GET o POST, buscar en el body JSON
if (empty($action)) {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
}

// Si aún está vacío y es POST, intentar leer de $_POST
if (empty($action) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
}

try {
    switch ($action) {
        case 'generar_codigo':
            $proyecto_id = $_GET['proyecto_id'] ?? 0;
            generarCodigoPreview($pdo, $proyecto_id);
            break;
        case 'listar':
            listarSolicitudes($pdo, $usuario_id, $rol);
            break;
        case 'crear':
            crearSolicitud($pdo, $usuario_id);
            break;
        case 'obtener':
            obtenerSolicitud($pdo);
            break;
        default:
            echo json_encode([
                'success' => false,
                'message' => 'Acción no válida: ' . $action
            ]);
            break;
    }
} catch (Exception $e) {
    error_log("Error en solicitudes_pagos.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

/**
 * Genera código de solicitud de pago
 * Formato: PAG-CGE-PAY-{proyecto_id}-{año}-{secuencia}
 */
function generarCodigoSolicitud($pdo, $proyecto_id) {
    $anio = date('Y');
    $prefijo = 'PAG-CGE-PAY-' . $proyecto_id . '-' . $anio . '-';
    
    $query = "SELECT COUNT(*) as total FROM solicitudes_pagos WHERE codigo_solicitud LIKE :prefijo";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':prefijo' => $prefijo . '%']);
    $row = $stmt->fetch();
    $numero = $row['total'] + 1;
    $correlativo = str_pad($numero, 6, '0', STR_PAD_LEFT);
    
    return $prefijo . $correlativo;
}

function generarCodigoPreview($pdo, $proyecto_id = 0) {
    $anio = date('Y');
    $codigo = 'PAG-CGE-PAY-' . $proyecto_id . '-' . $anio . '-XXXXXX';
    
    echo json_encode([
        'success' => true,
        'codigo' => $codigo
    ]);
}

function listarSolicitudes($pdo, $usuario_id, $rol) {
    $proyecto_id = $_GET['proyecto_id'] ?? '';
    $estado = $_GET['estado'] ?? '';
    $fecha_desde = $_GET['fechaDesde'] ?? '';
    $fecha_hasta = $_GET['fechaHasta'] ?? '';
    $busqueda = $_GET['busqueda'] ?? '';
    
    $where = ["1=1"];
    $params = [];
    
    if (!empty($proyecto_id)) {
        $where[] = "sp.proyecto_id = :proyecto_id";
        $params[':proyecto_id'] = $proyecto_id;
    } else {
        echo json_encode(['success' => true, 'solicitudes' => []]);
        return;
    }
    
    $rol_lower = strtolower($rol);
    if (in_array($rol_lower, ['coord', 'coordinador', 'socio'])) {
        $where[] = "sp.solicitante_id = :usuario_id";
        $params[':usuario_id'] = $usuario_id;
    }
    
    if (!empty($estado)) {
        $where[] = "sp.estado = :estado";
        $params[':estado'] = $estado;
    }
    if (!empty($fecha_desde)) {
        $where[] = "sp.fecha_solicitud >= :fecha_desde";
        $params[':fecha_desde'] = $fecha_desde;
    }
    if (!empty($fecha_hasta)) {
        $where[] = "sp.fecha_solicitud <= :fecha_hasta";
        $params[':fecha_hasta'] = $fecha_hasta;
    }
    if (!empty($busqueda)) {
        $where[] = "(sp.codigo_solicitud LIKE :busqueda OR sp.concepto LIKE :busqueda2 OR sp.beneficiario LIKE :busqueda3)";
        $params[':busqueda'] = "%$busqueda%";
        $params[':busqueda2'] = "%$busqueda%";
        $params[':busqueda3'] = "%$busqueda%";
    }
    
    $query = "
        SELECT 
            sp.id, sp.codigo_solicitud, sp.fecha_solicitud, sp.concepto,
            sp.descripcion, sp.monto_solicitado, sp.moneda, sp.prioridad, sp.estado,
            sp.beneficiario, sp.forma_pago, sp.fecha_requerida,
            sp.es_honorario, sp.tipo_contrato,
            u.nombre as solicitante_nombre, 
            p.nombre as proyecto_nombre, 
            p.id as proyecto_id,
            sp.pago_registrado
        FROM solicitudes_pagos sp
        LEFT JOIN usuarios u ON sp.solicitante_id = u.id
        LEFT JOIN proyectos p ON sp.proyecto_id = p.id
        WHERE " . implode(" AND ", $where) . "
        ORDER BY sp.fecha_solicitud DESC, sp.id DESC
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $solicitudes = $stmt->fetchAll();
    
    echo json_encode(['success' => true, 'solicitudes' => $solicitudes]);
}

function crearSolicitud($pdo, $usuario_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $required = ['proyecto_id', 'concepto', 'monto_solicitado', 'fecha_requerida', 'beneficiario'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            echo json_encode(['success' => false, 'message' => "Campo requerido: $field"]);
            return;
        }
    }
    
    // Validar proyecto
    $check = $pdo->prepare("SELECT id FROM proyectos WHERE id = ?");
    $check->execute([$input['proyecto_id']]);
    if (!$check->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Proyecto no existe']);
        return;
    }
    
    // Validar que si es honorario, tenga usuario_beneficiario_id
    $es_honorario = isset($input['es_honorario']) ? (int)$input['es_honorario'] : 0;
    if ($es_honorario && empty($input['usuario_beneficiario_id'])) {
        echo json_encode(['success' => false, 'message' => 'Para pagos de honorarios debe seleccionar un usuario beneficiario']);
        return;
    }
    
    $pdo->beginTransaction();
    
    try {
        $codigo = generarCodigoSolicitud($pdo, $input['proyecto_id']);
        
        $stmt = $pdo->prepare("
            INSERT INTO solicitudes_pagos (
                codigo_solicitud, proyecto_id, partida_id, solicitante_id,
                concepto, descripcion, monto_solicitado, moneda,
                beneficiario, documento_beneficiario, cuenta_beneficiario,
                banco_beneficiario, forma_pago, fecha_solicitud, fecha_requerida,
                prioridad, justificacion, estado,
                es_honorario, usuario_beneficiario_id, monto_honorarios, tipo_contrato
            ) VALUES (
                :codigo, :proyecto_id, :partida_id, :solicitante_id,
                :concepto, :descripcion, :monto_solicitado, :moneda,
                :beneficiario, :documento_beneficiario, :cuenta_beneficiario,
                :banco_beneficiario, :forma_pago, CURDATE(), :fecha_requerida,
                :prioridad, :justificacion, 'Pendiente',
                :es_honorario, :usuario_beneficiario_id, :monto_honorarios, :tipo_contrato
            )
        ");
        
        $stmt->execute([
            ':codigo' => $codigo,
            ':proyecto_id' => $input['proyecto_id'],
            ':partida_id' => $input['partida_id'] ?? null,
            ':solicitante_id' => $usuario_id,
            ':concepto' => $input['concepto'],
            ':descripcion' => $input['descripcion'] ?? null,
            ':monto_solicitado' => $input['monto_solicitado'],
            ':moneda' => $input['moneda'] ?? 'USD',
            ':beneficiario' => $input['beneficiario'],
            ':documento_beneficiario' => $input['documento_beneficiario'] ?? null,
            ':cuenta_beneficiario' => $input['cuenta_beneficiario'] ?? null,
            ':banco_beneficiario' => $input['banco_beneficiario'] ?? null,
            ':forma_pago' => $input['forma_pago'] ?? 'Transferencia',
            ':fecha_requerida' => $input['fecha_requerida'],
            ':prioridad' => $input['prioridad'] ?? 'Media',
            ':justificacion' => $input['justificacion'] ?? null,
            ':es_honorario' => $es_honorario,
            ':usuario_beneficiario_id' => $input['usuario_beneficiario_id'] ?? null,
            ':monto_honorarios' => $input['monto_honorarios'] ?? null,
            ':tipo_contrato' => $input['tipo_contrato'] ?? null
        ]);
        
        $solicitud_id = $pdo->lastInsertId();
        
        // Insertar detalles si existen
        if (!empty($input['detalles']) && is_array($input['detalles'])) {
            $detalle_stmt = $pdo->prepare("
                INSERT INTO pagos_detalles (solicitud_id, descripcion, monto, periodo, referencia)
                VALUES (?, ?, ?, ?, ?)
            ");
            foreach ($input['detalles'] as $detalle) {
                $detalle_stmt->execute([
                    $solicitud_id,
                    $detalle['descripcion'],
                    $detalle['monto'],
                    $detalle['periodo'] ?? null,
                    $detalle['referencia'] ?? null
                ]);
            }
        }
        
        // Si es honorario, guardar referencia en detalles
        if ($es_honorario && !empty($input['usuario_beneficiario_id'])) {
            $user_stmt = $pdo->prepare("SELECT nombre FROM usuarios WHERE id = ?");
            $user_stmt->execute([$input['usuario_beneficiario_id']]);
            $user = $user_stmt->fetch();
            
            if ($user) {
                $detalle_stmt = $pdo->prepare("
                    INSERT INTO pagos_detalles (solicitud_id, descripcion, monto, periodo)
                    VALUES (?, ?, ?, ?)
                ");
                $detalle_stmt->execute([
                    $solicitud_id,
                    "Honorarios - " . $user['nombre'],
                    $input['monto_solicitado'],
                    date('F Y')
                ]);
            }
        }
        
        // Historial
        $historial = $pdo->prepare("
            INSERT INTO historial_pagos (solicitud_id, usuario_id, estado_nuevo, comentario)
            VALUES (?, ?, 'Pendiente', 'Solicitud de pago creada')
        ");
        $historial->execute([$solicitud_id, $usuario_id]);
        
        $pdo->commit();
        
        // Enviar notificación a contabilidad
        $contabEmails = getEmailsPorRol($pdo, 'contab');
        $asunto = "NUEVA SOLICITUD DE PAGO - {$codigo}";
        $monto_formateado = number_format($input['monto_solicitado'], 2, ',', '.');
        $tipo_pago = $es_honorario ? 'Honorarios/Terceros' : 'Pago General';
        
        $cuerpo = "
            <div style='font-family: Arial, sans-serif; max-width: 600px;'>
                <div style='background-color: #2c3e50; padding: 20px; text-align: center;'>
                    <h2 style='color: #fff;'>CODEHCIU - Finanzas</h2>
                    <p style='color: #ecf0f1;'>Nueva Solicitud de Pago</p>
                </div>
                <div style='padding: 20px; border: 1px solid #dee2e6; border-top: none;'>
                    <p><strong>Código:</strong> {$codigo}</p>
                    <p><strong>Tipo:</strong> {$tipo_pago}</p>
                    <p><strong>Concepto:</strong> {$input['concepto']}</p>
                    <p><strong>Beneficiario:</strong> {$input['beneficiario']}</p>
                    <p><strong>Monto:</strong> <strong style='color: #27ae60;'>$ {$monto_formateado}</strong></p>
                    <p><strong>Fecha Requerida:</strong> {$input['fecha_requerida']}</p>
                </div>
            </div>
        ";
        
        foreach ($contabEmails as $contab) {
            enviarCorreo($contab['email'], $contab['nombre'], $asunto, $cuerpo);
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Solicitud de pago creada exitosamente',
            'id' => $solicitud_id,
            'codigo' => $codigo
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Error en crearSolicitudPago: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
    }
}

function obtenerSolicitud($pdo) {
    $id = $_GET['id'] ?? 0;
    
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
        return;
    }
    
    $query = "
        SELECT sp.*, 
               u.nombre as solicitante_nombre, u.email as solicitante_email,
               p.nombre as proyecto_nombre, p.id as proyecto_id,
               b.nombre as banco_nombre,
               ub.nombre as usuario_beneficiario_nombre
        FROM solicitudes_pagos sp
        LEFT JOIN usuarios u ON sp.solicitante_id = u.id
        LEFT JOIN proyectos p ON sp.proyecto_id = p.id
        LEFT JOIN bancos b ON sp.banco_origen_id = b.id
        LEFT JOIN usuarios ub ON sp.usuario_beneficiario_id = ub.id
        WHERE sp.id = :id
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([':id' => $id]);
    $solicitud = $stmt->fetch();
    
    if (!$solicitud) {
        echo json_encode(['success' => false, 'message' => 'Solicitud no encontrada']);
        return;
    }
    
    // Obtener detalles
    $detalles = $pdo->prepare("SELECT * FROM pagos_detalles WHERE solicitud_id = :id");
    $detalles->execute([':id' => $id]);
    $solicitud['detalles'] = $detalles->fetchAll();
    
    // Obtener historial
    $historial = $pdo->prepare("
        SELECT h.*, u.nombre as usuario_nombre
        FROM historial_pagos h
        LEFT JOIN usuarios u ON h.usuario_id = u.id
        WHERE h.solicitud_id = :id
        ORDER BY h.created_at DESC
    ");
    $historial->execute([':id' => $id]);
    $solicitud['historial'] = $historial->fetchAll();
    
    echo json_encode(['success' => true, 'solicitud' => $solicitud]);
}
?>