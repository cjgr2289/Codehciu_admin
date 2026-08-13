<?php
/**
 * API Principal para Solicitudes de Compras
 * CODEHCIU - Sistema de Finanzas
 * Siguiendo el Manual de Codificación Documental CODEHCIU
 * Con soporte para Servicios y Compras
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

$action = $_GET['action'] ?? $_POST['action'] ?? '';

if (empty($action) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
}

try {
    switch ($action) {
        case 'generar_codigo':
            generarCodigoPreview($pdo);
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
            echo json_encode(['success' => false, 'message' => 'Acción no válida']);
            break;
    }
} catch (Exception $e) {
    error_log("Error en solicitudes_compras.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

function generarCodigoPreview($pdo) {
    $anio = date('Y');
    $subproceso_origen = 'CMP';
    $subproceso_destino = 'CGE';
    $tipo_doc = 'SOL';
    
    $prefijo = $subproceso_origen . '-' . $subproceso_destino . '-' . $tipo_doc . '-' . $anio . '-';
    
    $query = "SELECT COUNT(*) as total FROM solicitudes_compras WHERE codigo_solicitud LIKE :prefijo";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':prefijo' => $prefijo . '%']);
    $row = $stmt->fetch();
    $numero = $row['total'] + 1;
    $correlativo = str_pad($numero, 6, '0', STR_PAD_LEFT);
    $codigo = $prefijo . $correlativo;
    
    echo json_encode([
        'success' => true,
        'codigo' => $codigo,
        'estructura' => [
            'origen' => $subproceso_origen,
            'destino' => $subproceso_destino,
            'tipo' => $tipo_doc,
            'anio' => $anio,
            'correlativo' => $correlativo,
            'digitos_correlativo' => 6
        ]
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
        $where[] = "sc.proyecto_id = :proyecto_id";
        $params[':proyecto_id'] = $proyecto_id;
    } else {
        echo json_encode(['success' => true, 'solicitudes' => []]);
        return;
    }
    
    $rol_lower = strtolower($rol);
    if (in_array($rol_lower, ['coord', 'coordinador', 'socio'])) {
        $where[] = "sc.solicitante_id = :usuario_id";
        $params[':usuario_id'] = $usuario_id;
    }
    
    if (!empty($estado)) {
        $where[] = "sc.estado = :estado";
        $params[':estado'] = $estado;
    }
    if (!empty($fecha_desde)) {
        $where[] = "sc.fecha_solicitud >= :fecha_desde";
        $params[':fecha_desde'] = $fecha_desde;
    }
    if (!empty($fecha_hasta)) {
        $where[] = "sc.fecha_solicitud <= :fecha_hasta";
        $params[':fecha_hasta'] = $fecha_hasta;
    }
    if (!empty($busqueda)) {
        $where[] = "(sc.codigo_solicitud LIKE :busqueda OR sc.descripcion LIKE :busqueda2 OR u.nombre LIKE :busqueda3)";
        $params[':busqueda'] = "%$busqueda%";
        $params[':busqueda2'] = "%$busqueda%";
        $params[':busqueda3'] = "%$busqueda%";
    }
    
    $query = "
        SELECT 
            sc.id, sc.codigo_solicitud, sc.fecha_solicitud, sc.descripcion,
            sc.monto_estimado, sc.moneda, sc.prioridad, sc.estado,
            sc.tipo_solicitud, sc.requiere_cotizaciones, sc.orden_compra_id,
            u.nombre as solicitante_nombre, p.nombre as proyecto_nombre, p.id as proyecto_id,
            oc.codigo_oc,
            CASE WHEN EXISTS (SELECT 1 FROM pagos_solicitud ps WHERE ps.solicitud_id = sc.id AND ps.comprobante_foto IS NOT NULL) 
                THEN 1 ELSE 0 END as tiene_comprobante
        FROM solicitudes_compras sc
        LEFT JOIN usuarios u ON sc.solicitante_id = u.id
        LEFT JOIN proyectos p ON sc.proyecto_id = p.id
        LEFT JOIN ordenes_compra oc ON sc.orden_compra_id = oc.id
        WHERE " . implode(" AND ", $where) . "
        ORDER BY sc.fecha_solicitud DESC, sc.id DESC
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $solicitudes = $stmt->fetchAll();
    
    echo json_encode(['success' => true, 'solicitudes' => $solicitudes]);
}

function generarCodigoSolicitud($pdo) {
    $anio = date('Y');
    $subproceso_origen = 'CMP';
    $subproceso_destino = 'CGE';
    $tipo_doc = 'SOL';
    
    $prefijo = $subproceso_origen . '-' . $subproceso_destino . '-' . $tipo_doc . '-' . $anio . '-';
    
    $query = "SELECT COUNT(*) as total FROM solicitudes_compras WHERE codigo_solicitud LIKE :prefijo";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':prefijo' => $prefijo . '%']);
    $row = $stmt->fetch();
    $numero = $row['total'] + 1;
    $correlativo = str_pad($numero, 6, '0', STR_PAD_LEFT);
    
    return $prefijo . $correlativo;
}

function crearSolicitud($pdo, $usuario_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $required = ['proyecto_id', 'descripcion', 'monto_estimado', 'fecha_requerida', 'items', 'tipo_solicitud'];
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
    
    // Determinar si requiere cotizaciones (compra >= $1000)
    $requiere_cotizaciones = 0;
    $tipo = $input['tipo_solicitud'];
    $monto = floatval($input['monto_estimado']);
    
    if ($tipo === 'compra' && $monto >= 1000) {
        $requiere_cotizaciones = 1;
    }
    
    // Obtener datos del solicitante
    $solicitante = getUsuarioById($pdo, $usuario_id);
    
    $pdo->beginTransaction();
    
    try {
        $codigo = generarCodigoSolicitud($pdo);
        
        $stmt = $pdo->prepare("
            INSERT INTO solicitudes_compras (
                codigo_solicitud, proyecto_id, partida_id, solicitante_id,
                fecha_solicitud, fecha_requerida, prioridad, descripcion,
                justificacion, monto_estimado, moneda, estado,
                tipo_solicitud, requiere_cotizaciones
            ) VALUES (
                :codigo, :proyecto_id, :partida_id, :solicitante_id,
                CURDATE(), :fecha_requerida, :prioridad, :descripcion,
                :justificacion, :monto_estimado, :moneda, 'Pendiente',
                :tipo_solicitud, :requiere_cotizaciones
            )
        ");
        
        $stmt->execute([
            ':codigo' => $codigo,
            ':proyecto_id' => $input['proyecto_id'],
            ':partida_id' => $input['partida_id'] ?? null,
            ':solicitante_id' => $usuario_id,
            ':fecha_requerida' => $input['fecha_requerida'],
            ':prioridad' => $input['prioridad'] ?? 'Media',
            ':descripcion' => $input['descripcion'],
            ':justificacion' => $input['justificacion'] ?? null,
            ':monto_estimado' => $monto,
            ':moneda' => $input['moneda'] ?? 'USD',
            ':tipo_solicitud' => $tipo,
            ':requiere_cotizaciones' => $requiere_cotizaciones
        ]);
        
        $solicitud_id = $pdo->lastInsertId();
        
        // Insertar items
        $item_stmt = $pdo->prepare("
            INSERT INTO detalles_solicitud (
                solicitud_id, descripcion_item, cantidad, unidad_medida,
                precio_unitario_estimado, subtotal_estimado
            ) VALUES (:sid, :desc, :cant, :unidad, :precio, :subtotal)
        ");
        
        foreach ($input['items'] as $item) {
            $cant = (int)$item['cantidad'];
            $precio = (float)$item['precio_unitario_estimado'];
            $item_stmt->execute([
                ':sid' => $solicitud_id,
                ':desc' => $item['descripcion_item'],
                ':cant' => $cant,
                ':unidad' => $item['unidad_medida'] ?? null,
                ':precio' => $precio,
                ':subtotal' => $cant * $precio
            ]);
        }
        
        // Historial
        $historial = $pdo->prepare("
            INSERT INTO historial_solicitud (solicitud_id, usuario_id, estado_nuevo, comentario)
            VALUES (?, ?, 'Pendiente', 'Solicitud creada')
        ");
        $historial->execute([$solicitud_id, $usuario_id]);
        
        $pdo->commit();
        
        // Enviar notificación a contabilidad
        $contabEmails = getEmailsPorRol($pdo, 'contab');
        $asunto = "NUEVA SOLICITUD DE COMPRA - {$codigo}";
        $fecha = date('d/m/Y');
        $monto_formateado = number_format($monto, 2, ',', '.');
        $tipo_texto = $tipo === 'servicio' ? 'Servicio' : 'Compra de Items';
        
        $cuerpo = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                <div style='background-color: #2c3e50; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;'>
                    <h2 style='color: #fff; margin: 0;'>CODEHCIU - Finanzas</h2>
                    <p style='color: #ecf0f1; margin: 5px 0 0;'>Nueva Solicitud de Compra</p>
                </div>
                <div style='background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #dee2e6; border-top: none;'>
                    <div style='margin-bottom: 20px;'>
                        <p><strong>Código:</strong> <code>{$codigo}</code></p>
                        <p><strong>Tipo:</strong> {$tipo_texto}</p>
                        <p><strong>Solicitante:</strong> {$solicitante['nombre']}</p>
                        <p><strong>Fecha:</strong> {$fecha}</p>
                        <p><strong>Prioridad:</strong> {$input['prioridad']}</p>
                    </div>
                    <div style='background-color: #fff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3498db;'>
                        <p><strong>Descripción:</strong><br>{$input['descripcion']}</p>
                        <p><strong>Monto Estimado:</strong> <strong style='color: #27ae60;'>$ {$monto_formateado}</strong></p>
                    </div>
                    <hr>
                    <p style='color: #7f8c8d; font-size: 12px; text-align: center;'>
                        <a href='http://localhost/admin/control-flujo.html' style='color: #3498db;'>Ir al sistema</a>
                    </p>
                </div>
            </div>
        ";
        
        foreach ($contabEmails as $contab) {
            enviarCorreo($contab['email'], $contab['nombre'], $asunto, $cuerpo);
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Solicitud creada exitosamente',
            'id' => $solicitud_id,
            'codigo' => $codigo,
            'tipo' => $tipo,
            'requiere_cotizaciones' => $requiere_cotizaciones
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Error en crearSolicitud: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
    }
}

function obtenerSolicitud($pdo) {
    $id = $_GET['id'] ?? 0;
    $simple = $_GET['simple'] ?? false;
    
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
        return;
    }
    
    $query = "
        SELECT sc.*, 
               u.nombre as solicitante_nombre, u.email as solicitante_email,
               p.nombre as proyecto_nombre, p.id as proyecto_id,
               oc.codigo_oc, oc.monto_aprobado as monto_oc, oc.estado as estado_oc,
               pr.nombre as proveedor_nombre, pr.ci_rif as proveedor_rif, pr.cuenta_bancaria,
               pr.telefono as proveedor_telefono, pr.email as proveedor_email
        FROM solicitudes_compras sc
        LEFT JOIN usuarios u ON sc.solicitante_id = u.id
        LEFT JOIN proyectos p ON sc.proyecto_id = p.id
        LEFT JOIN ordenes_compra oc ON sc.orden_compra_id = oc.id
        LEFT JOIN proveedores pr ON oc.proveedor_id = pr.id
        WHERE sc.id = :id
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([':id' => $id]);
    $solicitud = $stmt->fetch();
    
    if (!$solicitud) {
        echo json_encode(['success' => false, 'message' => 'Solicitud no encontrada']);
        return;
    }
    
    if ($simple) {
        echo json_encode(['success' => true, 'solicitud' => $solicitud]);
        return;
    }
    
    // Obtener items
    $items = $pdo->prepare("SELECT * FROM detalles_solicitud WHERE solicitud_id = :id ORDER BY id");
    $items->execute([':id' => $id]);
    $solicitud['items'] = $items->fetchAll();
    
    // Obtener cotizaciones si aplica
    if ($solicitud['tipo_solicitud'] === 'compra' && $solicitud['requiere_cotizaciones']) {
        $cotizaciones = $pdo->prepare("
            SELECT c.*, p.nombre as proveedor_nombre, p.ci_rif, p.cuenta_bancaria
            FROM cotizaciones c
            LEFT JOIN proveedores p ON c.proveedor_id = p.id
            WHERE c.solicitud_id = :id
            ORDER BY c.monto_cotizado ASC
        ");
        $cotizaciones->execute([':id' => $id]);
        $solicitud['cotizaciones'] = $cotizaciones->fetchAll();
    }
    
    // Obtener pagos
    $pagos = $pdo->prepare("
        SELECT ps.*, b.nombre as banco_nombre, u.nombre as realizado_por_nombre,
               CASE WHEN ps.comprobante_foto IS NOT NULL THEN 1 ELSE 0 END as tiene_comprobante
        FROM pagos_solicitud ps
        LEFT JOIN bancos b ON ps.banco_origen_id = b.id
        LEFT JOIN usuarios u ON ps.realizado_por = u.id
        WHERE ps.solicitud_id = :id
        ORDER BY ps.fecha_pago DESC
    ");
    $pagos->execute([':id' => $id]);
    $solicitud['pagos'] = $pagos->fetchAll();
    
    // Obtener historial
    $historial = $pdo->prepare("
        SELECT h.*, u.nombre as usuario_nombre
        FROM historial_solicitud h
        LEFT JOIN usuarios u ON h.usuario_id = u.id
        WHERE h.solicitud_id = :id
        ORDER BY h.created_at DESC
    ");
    $historial->execute([':id' => $id]);
    $solicitud['historial'] = $historial->fetchAll();
    
    echo json_encode(['success' => true, 'solicitud' => $solicitud]);
}
?>