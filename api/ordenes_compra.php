<?php
/**
 * API para Gestión de Órdenes de Compra
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'generar_codigo':
            generarCodigoOCPreview($pdo);
            break;
        case 'crear':
            crearOrdenCompra($pdo);
            break;
        case 'obtener':
            obtenerOrdenCompra($pdo);
            break;
        case 'listar_por_solicitud':
            listarPorSolicitud($pdo);
            break;
        case 'reporte':
            generarReporteOC($pdo);
            break;
        default:
            echo json_encode(['success' => false, 'message' => 'Acción no válida']);
            break;
    }
} catch (Exception $e) {
    error_log("Error en ordenes_compra.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

function generarCodigoOCPreview($pdo) {
    $anio = date('Y');
    $prefijo = "CMP-OC-{$anio}-";
    
    $query = "SELECT COUNT(*) as total FROM ordenes_compra WHERE codigo_oc LIKE :prefijo";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':prefijo' => $prefijo . '%']);
    $row = $stmt->fetch();
    $numero = $row['total'] + 1;
    $correlativo = str_pad($numero, 6, '0', STR_PAD_LEFT);
    $codigo = $prefijo . $correlativo;
    
    echo json_encode([
        'success' => true,
        'codigo' => $codigo,
        'prefijo' => $prefijo,
        'correlativo' => $correlativo
    ]);
}

function crearOrdenCompra($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $required = ['solicitud_id', 'proveedor_id', 'monto_aprobado'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            echo json_encode(['success' => false, 'message' => "Campo requerido: $field"]);
            return;
        }
    }
    
    // Generar código de OC
    $anio = date('Y');
    $prefijo = "CMP-OC-{$anio}-";
    $query = "SELECT COUNT(*) as total FROM ordenes_compra WHERE codigo_oc LIKE :prefijo";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':prefijo' => $prefijo . '%']);
    $row = $stmt->fetch();
    $numero = $row['total'] + 1;
    $correlativo = str_pad($numero, 6, '0', STR_PAD_LEFT);
    $codigo_oc = $prefijo . $correlativo;
    
    // Verificar que la solicitud existe
    $check = $pdo->prepare("SELECT id FROM solicitudes_compras WHERE id = :id");
    $check->execute([':id' => $input['solicitud_id']]);
    if (!$check->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Solicitud no encontrada']);
        return;
    }
    
    // Verificar que el proveedor existe
    $check = $pdo->prepare("SELECT id FROM proveedores WHERE id = :id AND activo = 1");
    $check->execute([':id' => $input['proveedor_id']]);
    if (!$check->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Proveedor no encontrado o inactivo']);
        return;
    }
    
    $pdo->beginTransaction();
    
    try {
        $query = "
            INSERT INTO ordenes_compra (
                codigo_oc, solicitud_id, proveedor_id, monto_aprobado,
                fecha_emision, aprobado_por, estado, observaciones, created_by
            ) VALUES (
                :codigo_oc, :solicitud_id, :proveedor_id, :monto_aprobado,
                CURDATE(), :aprobado_por, 'Aprobada', :observaciones, :created_by
            )
        ";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([
            ':codigo_oc' => $codigo_oc,
            ':solicitud_id' => $input['solicitud_id'],
            ':proveedor_id' => $input['proveedor_id'],
            ':monto_aprobado' => $input['monto_aprobado'],
            ':aprobado_por' => $_SESSION['user_id'],
            ':observaciones' => $input['observaciones'] ?? null,
            ':created_by' => $_SESSION['user_id']
        ]);
        
        $oc_id = $pdo->lastInsertId();
        
        // Actualizar solicitud con la OC
        $update = $pdo->prepare("UPDATE solicitudes_compras SET orden_compra_id = :oc_id WHERE id = :solicitud_id");
        $update->execute([
            ':oc_id' => $oc_id,
            ':solicitud_id' => $input['solicitud_id']
        ]);
        
        // Si hay cotizaciones, marcar el proveedor ganador
        if (isset($input['cotizacion_id']) && $input['cotizacion_id']) {
            $update_cot = $pdo->prepare("UPDATE cotizaciones SET es_ganador = 1 WHERE id = :id");
            $update_cot->execute([':id' => $input['cotizacion_id']]);
        }
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Orden de Compra creada exitosamente',
            'orden_compra' => [
                'id' => $oc_id,
                'codigo_oc' => $codigo_oc,
                'solicitud_id' => $input['solicitud_id'],
                'proveedor_id' => $input['proveedor_id'],
                'monto_aprobado' => $input['monto_aprobado']
            ]
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function obtenerOrdenCompra($pdo) {
    $id = $_GET['id'] ?? 0;
    
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
        return;
    }
    
    $query = "
        SELECT oc.*, 
               p.nombre as proveedor_nombre, p.ci_rif as proveedor_rif, p.cuenta_bancaria,
               p.telefono as proveedor_telefono, p.email as proveedor_email,
               s.codigo_solicitud, s.descripcion as solicitud_descripcion,
               u.nombre as aprobador_nombre
        FROM ordenes_compra oc
        LEFT JOIN proveedores p ON oc.proveedor_id = p.id
        LEFT JOIN solicitudes_compras s ON oc.solicitud_id = s.id
        LEFT JOIN usuarios u ON oc.aprobado_por = u.id
        WHERE oc.id = :id
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([':id' => $id]);
    $oc = $stmt->fetch();
    
    if ($oc) {
        // Obtener items de la solicitud
        $items = $pdo->prepare("SELECT * FROM detalles_solicitud WHERE solicitud_id = :sid");
        $items->execute([':sid' => $oc['solicitud_id']]);
        $oc['items'] = $items->fetchAll();
        
        echo json_encode(['success' => true, 'orden_compra' => $oc]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Orden de Compra no encontrada']);
    }
}

function listarPorSolicitud($pdo) {
    $solicitud_id = $_GET['solicitud_id'] ?? 0;
    
    if (!$solicitud_id) {
        echo json_encode(['success' => false, 'message' => 'ID de solicitud no proporcionado']);
        return;
    }
    
    $query = "
        SELECT oc.*, p.nombre as proveedor_nombre
        FROM ordenes_compra oc
        LEFT JOIN proveedores p ON oc.proveedor_id = p.id
        WHERE oc.solicitud_id = :solicitud_id
        ORDER BY oc.id DESC
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([':solicitud_id' => $solicitud_id]);
    $ordenes = $stmt->fetchAll();
    
    echo json_encode(['success' => true, 'ordenes' => $ordenes]);
}

function generarReporteOC($pdo) {
    $id = $_GET['id'] ?? 0;
    
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
        return;
    }
    
    $query = "
        SELECT oc.*, 
               p.nombre as proveedor_nombre, p.ci_rif as proveedor_rif, p.cuenta_bancaria,
               p.telefono as proveedor_telefono, p.email as proveedor_email, p.direccion as proveedor_direccion,
               s.codigo_solicitud, s.descripcion as solicitud_descripcion, s.fecha_solicitud,
               u.nombre as solicitante_nombre, u.cargo as solicitante_cargo,
               a.nombre as aprobador_nombre
        FROM ordenes_compra oc
        LEFT JOIN proveedores p ON oc.proveedor_id = p.id
        LEFT JOIN solicitudes_compras s ON oc.solicitud_id = s.id
        LEFT JOIN usuarios u ON s.solicitante_id = u.id
        LEFT JOIN usuarios a ON oc.aprobado_por = a.id
        WHERE oc.id = :id
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([':id' => $id]);
    $oc = $stmt->fetch();
    
    if (!$oc) {
        echo json_encode(['success' => false, 'message' => 'Orden de Compra no encontrada']);
        return;
    }
    
    // Obtener items
    $items = $pdo->prepare("SELECT * FROM detalles_solicitud WHERE solicitud_id = :sid");
    $items->execute([':sid' => $oc['solicitud_id']]);
    $oc['items'] = $items->fetchAll();
    
    echo json_encode(['success' => true, 'reporte' => $oc]);
}
?>