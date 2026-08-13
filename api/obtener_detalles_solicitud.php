<?php
/**
 * API para Obtener Detalles Completos de una Solicitud
 * MODIFICADO: Incluye IVA de la Orden de Compra
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'database.php';

session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$id = $_GET['id'] ?? 0;
$simple = $_GET['simple'] ?? false;

if (!$id) {
    echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
    exit;
}

try {
    // 1. OBTENER DATOS DE LA SOLICITUD
    $solicitud_query = "
        SELECT 
            sc.*,
            u.nombre as solicitante_nombre,
            u.email as solicitante_email,
            p.nombre as proyecto_nombre,
            p.id as proyecto_id,
            pr.nombre as partida_nombre,
            pr.codigo as partida_codigo,
            aprobador.nombre as aprobador_nombre,
            oc.codigo_oc,
            oc.monto_aprobado as monto_oc,
            oc.estado as estado_oc,
            prov.nombre as proveedor_nombre,
            prov.ci_rif as proveedor_rif,
            prov.cuenta_bancaria,
            prov.telefono as proveedor_telefono,
            prov.email as proveedor_email,
            prov.direccion as proveedor_direccion
        FROM solicitudes_compras sc
        LEFT JOIN usuarios u ON sc.solicitante_id = u.id
        LEFT JOIN proyectos p ON sc.proyecto_id = p.id
        LEFT JOIN partidas pr ON sc.partida_id = pr.id
        LEFT JOIN usuarios aprobador ON sc.aprobado_por = aprobador.id
        LEFT JOIN ordenes_compra oc ON sc.orden_compra_id = oc.id
        LEFT JOIN proveedores prov ON oc.proveedor_id = prov.id
        WHERE sc.id = :id
    ";
    
    $stmt = $pdo->prepare($solicitud_query);
    $stmt->execute([':id' => $id]);
    $solicitud = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$solicitud) {
        echo json_encode(['success' => false, 'message' => 'Solicitud no encontrada']);
        exit;
    }
    
    // Si es solicitud simple, solo devolver datos básicos
    if ($simple) {
        echo json_encode(['success' => true, 'solicitud' => $solicitud]);
        exit;
    }
    
    // 2. OBTENER ITEMS DE LA SOLICITUD ORIGINAL
    $items_query = "SELECT * FROM detalles_solicitud WHERE solicitud_id = :id ORDER BY id";
    $items_stmt = $pdo->prepare($items_query);
    $items_stmt->execute([':id' => $id]);
    $items = $items_stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 3. OBTENER ITEMS DE LA ORDEN DE COMPRA (con IVA incluido)
    $orden_compra_items = [];
    if ($solicitud['orden_compra_id']) {
        $oc_items_query = "
            SELECT * FROM orden_compra_items 
            WHERE orden_compra_id = :oc_id 
            ORDER BY id
        ";
        $oc_items_stmt = $pdo->prepare($oc_items_query);
        $oc_items_stmt->execute([':oc_id' => $solicitud['orden_compra_id']]);
        $orden_compra_items = $oc_items_stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // 4. OBTENER COTIZACIONES (si aplica)
    $cotizaciones = [];
    if ($solicitud['tipo_solicitud'] === 'compra' && $solicitud['requiere_cotizaciones'] == 1) {
        $cotizaciones_query = "
            SELECT 
                c.*,
                p.nombre as proveedor_nombre,
                p.ci_rif,
                p.cuenta_bancaria
            FROM cotizaciones c
            LEFT JOIN proveedores p ON c.proveedor_id = p.id
            WHERE c.solicitud_id = :id
            ORDER BY c.monto_cotizado ASC
        ";
        $cotizaciones_stmt = $pdo->prepare($cotizaciones_query);
        $cotizaciones_stmt->execute([':id' => $id]);
        $cotizaciones = $cotizaciones_stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // 5. OBTENER PAGOS
    $pagos_query = "
        SELECT 
            ps.*,
            b.nombre as banco_nombre,
            u.nombre as realizado_por_nombre,
            CASE WHEN ps.comprobante_foto IS NOT NULL THEN 1 ELSE 0 END as tiene_comprobante
        FROM pagos_solicitud ps
        LEFT JOIN bancos b ON ps.banco_origen_id = b.id
        LEFT JOIN usuarios u ON ps.realizado_por = u.id
        WHERE ps.solicitud_id = :id
        ORDER BY ps.fecha_pago DESC, ps.id DESC
    ";
    $pagos_stmt = $pdo->prepare($pagos_query);
    $pagos_stmt->execute([':id' => $id]);
    $pagos = $pagos_stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Limpiar blobs de la respuesta
    foreach ($pagos as &$pago) {
        unset($pago['comprobante_foto']);
    }
    
    // 6. OBTENER HISTORIAL
    $historial_query = "
        SELECT 
            h.*,
            u.nombre as usuario_nombre
        FROM historial_solicitud h
        LEFT JOIN usuarios u ON h.usuario_id = u.id
        WHERE h.solicitud_id = :id
        ORDER BY h.created_at DESC
    ";
    $historial_stmt = $pdo->prepare($historial_query);
    $historial_stmt->execute([':id' => $id]);
    $historial = $historial_stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 7. CONSTRUIR RESPUESTA COMPLETA
    $respuesta = [
        'success' => true,
        'solicitud' => $solicitud,
        'items' => $items,
        'orden_compra_items' => $orden_compra_items,
        'cotizaciones' => $cotizaciones,
        'pagos' => $pagos,
        'historial' => $historial
    ];
    
    echo json_encode($respuesta);
    
} catch (Exception $e) {
    error_log("Error en obtener_detalles_solicitud: " . $e->getMessage());
    echo json_encode([
        'success' => false, 
        'message' => 'Error: ' . $e->getMessage(),
        'items' => [],
        'orden_compra_items' => []
    ]);
}
?>