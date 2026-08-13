<?php
/**
 * API para generación de reportes en Excel y PDF
 * Ubicación: /api/reportes.php
 */

// Configuración de errores - IMPORTANTE para evitar notices en producción
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
ini_set('display_errors', 0);

// Si necesitas debug, puedes usar este flag
$DEBUG_MODE = false;
if ($DEBUG_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Verificar si es una solicitud OPTIONS (CORS preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Incluir conexión a base de datos
require_once __DIR__ . '/database.php';

// Función para manejar errores de manera consistente
function enviarError($mensaje, $codigo = 400) {
    http_response_code($codigo);
    echo json_encode([
        'success' => false,
        'error' => $mensaje,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}

// Función para enviar respuesta exitosa
function enviarExito($data = [], $mensaje = '') {
    echo json_encode([
        'success' => true,
        'message' => $mensaje,
        'data' => $data,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}

// Obtener action de diferentes fuentes
$action = $_GET['action'] ?? '';

// Si es POST y tiene JSON, obtener del body
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($action)) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (json_last_error() === JSON_ERROR_NONE) {
        $action = $input['action'] ?? '';
    }
}

// Si aún no hay action, verificar $_POST
if (empty($action)) {
    $action = $_POST['action'] ?? '';
}

if (empty($action)) {
    enviarError('Acción no especificada');
}

try {
    switch ($action) {
        case 'generar_excel':
            generarExcel();
            break;
            
        case 'generar_pdf':
            generarPDF();
            break;
            
        case 'obtener_datos_reporte':
            obtenerDatosReporte();
            break;
            
        case 'test':
            echo json_encode([
                'success' => true, 
                'message' => 'API de reportes funcionando',
                'version' => '1.0',
                'timestamp' => date('Y-m-d H:i:s')
            ]);
            break;
            
        case 'debug':
            echo json_encode([
                'success' => true,
                'message' => 'Debug info',
                'server' => $_SERVER,
                'get' => $_GET,
                'post' => $_POST,
                'input' => file_get_contents('php://input'),
                'timestamp' => date('Y-m-d H:i:s')
            ]);
            break;
            
        default:
            enviarError('Acción no válida: ' . $action);
            break;
    }
} catch (Exception $e) {
    enviarError('Error interno: ' . $e->getMessage(), 500);
}

function obtenerDatosReporte() {
    global $pdo;
    
    // Obtener proyecto_id de diferentes fuentes
    $proyecto_id = $_GET['proyecto_id'] ?? $_POST['proyecto_id'] ?? 0;
    $proyecto_id = intval($proyecto_id);
    
    // Si es POST con JSON, obtener del body también
    if (!$proyecto_id && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $proyecto_id = intval($input['proyecto_id'] ?? 0);
        }
    }
    
    if (!$proyecto_id) {
        enviarError('ID de proyecto no especificado');
    }
    
    try {
        // Obtener datos completos para el reporte
        $data = obtenerDatosCompletosParaReporte($proyecto_id);
        
        enviarExito($data, 'Datos obtenidos correctamente');
        
    } catch (Exception $e) {
        enviarError('Error obteniendo datos: ' . $e->getMessage());
    }
}

function generarExcel() {
    global $pdo;
    
    // Obtener proyecto_id
    $proyecto_id = $_GET['proyecto_id'] ?? $_POST['proyecto_id'] ?? 0;
    $proyecto_id = intval($proyecto_id);
    
    if (!$proyecto_id) {
        enviarError('ID de proyecto no especificado');
    }
    
    try {
        // Obtener datos del proyecto
        $stmt = $pdo->prepare("SELECT nombre FROM proyectos WHERE id = ?");
        $stmt->execute([$proyecto_id]);
        $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$proyecto) {
            throw new Exception('Proyecto no encontrado');
        }
        
        // Obtener datos organizados
        $data = obtenerDatosCompletosParaReporte($proyecto_id);
        
        // Generar contenido CSV organizado
        $contenido = generarContenidoCSVOrganizado($data);
        
        // Crear nombre de archivo
        $nombreProyecto = preg_replace('/[^a-zA-Z0-9]/', '_', $proyecto['nombre']);
        $nombreArchivo = 'reporte_egresos_' . $nombreProyecto . '_' . date('Ymd_His') . '.csv';
        
        // Enviar directamente al navegador
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $nombreArchivo . '"');
        header('Content-Length: ' . strlen($contenido));
        header('Cache-Control: private, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        echo $contenido;
        exit;
        
    } catch (Exception $e) {
        enviarError('Error generando Excel: ' . $e->getMessage());
    }
}

function generarPDF() {
    global $pdo;
    
    // Obtener proyecto_id
    $proyecto_id = $_GET['proyecto_id'] ?? $_POST['proyecto_id'] ?? 0;
    $proyecto_id = intval($proyecto_id);
    
    if (!$proyecto_id) {
        enviarError('ID de proyecto no especificado');
    }
    
    try {
        // Obtener datos del proyecto
        $stmt = $pdo->prepare("SELECT nombre FROM proyectos WHERE id = ?");
        $stmt->execute([$proyecto_id]);
        $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$proyecto) {
            throw new Exception('Proyecto no encontrado');
        }
        
        // Obtener datos completos para el reporte
        $data = obtenerDatosCompletosParaReporte($proyecto_id);
        
        // Generar HTML
        $htmlContent = generarContenidoHTMLParaReporte($data);
        
        // Crear nombre de archivo
        $nombreProyecto = preg_replace('/[^a-zA-Z0-9]/', '_', $proyecto['nombre']);
        $nombreArchivo = 'reporte_egresos_' . $nombreProyecto . '_' . date('Ymd_His') . '.html';
        
        // Enviar directamente al navegador
        header('Content-Type: text/html; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $nombreArchivo . '"');
        header('Content-Length: ' . strlen($htmlContent));
        header('Cache-Control: private, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        echo $htmlContent;
        exit;
        
    } catch (Exception $e) {
        enviarError('Error generando reporte: ' . $e->getMessage());
    }
}

function obtenerDatosCompletosParaReporte($proyecto_id) {
    global $pdo;
    
    // 1. Obtener datos del proyecto
    $stmt = $pdo->prepare("
        SELECT 
            id, nombre, descripcion, cliente, 
            presupuesto, fecha_inicio, fecha_fin, estado,
            created_at, updated_at
        FROM proyectos 
        WHERE id = ?
    ");
    $stmt->execute([$proyecto_id]);
    $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // 2. Obtener TODAS las partidas del proyecto (principales y subpartidas)
    $stmt = $pdo->prepare("
        SELECT 
            p.id,
            p.codigo as codigo_partida,
            p.nombre as nombre_partida,
            p.descripcion as descripcion_partida,
            p.presupuesto_asignado,
            p.presupuesto_actual,
            p.tipo as tipo_partida,
            p.partida_padre_id,
            pp.codigo as codigo_padre,
            pp.nombre as nombre_padre,
            COALESCE(SUM(CASE WHEN t.tipo = 'Egreso' THEN t.monto ELSE 0 END), 0) as gastado,
            (p.presupuesto_actual - COALESCE(SUM(CASE WHEN t.tipo = 'Egreso' THEN t.monto ELSE 0 END), 0)) as saldo_disponible
        FROM partidas p
        LEFT JOIN partidas pp ON p.partida_padre_id = pp.id
        LEFT JOIN transacciones t ON p.id = t.partida_id AND t.proyecto_id = ?
        WHERE p.proyecto_id = ?
        GROUP BY p.id, pp.id
        ORDER BY 
            CASE WHEN p.partida_padre_id IS NULL THEN 0 ELSE 1 END,
            pp.codigo,
            p.codigo
    ");
    $stmt->execute([$proyecto_id, $proyecto_id]);
    $partidas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 3. Organizar partidas principales y subpartidas
    $partidas_principales = [];
    $subpartidas_por_padre = [];
    
    foreach ($partidas as $partida) {
        if (empty($partida['partida_padre_id'])) {
            // Partida principal
            $partida['subpartidas'] = [];
            $partidas_principales[$partida['id']] = $partida;
        } else {
            // Subpartida
            if (!isset($subpartidas_por_padre[$partida['partida_padre_id']])) {
                $subpartidas_por_padre[$partida['partida_padre_id']] = [];
            }
            $subpartidas_por_padre[$partida['partida_padre_id']][] = $partida;
        }
    }
    
    // 4. Asignar subpartidas a sus padres y calcular totales de partidas principales
    foreach ($subpartidas_por_padre as $padre_id => $subpartidas) {
        if (isset($partidas_principales[$padre_id])) {
            $partidas_principales[$padre_id]['subpartidas'] = $subpartidas;
            
            // Recalcular el gasto total de la partida principal (suma de egresos de subpartidas)
            $gasto_total_principal = 0;
            foreach ($subpartidas as $subpartida) {
                $gasto_total_principal += $subpartida['gastado'] ?? 0;
            }
            $partidas_principales[$padre_id]['gastado_total'] = $gasto_total_principal;
            $partidas_principales[$padre_id]['saldo_total'] = 
                ($partidas_principales[$padre_id]['presupuesto_actual'] ?? 0) - $gasto_total_principal;
        }
    }
    
    // Convertir a array indexado
    $partidas_principales = array_values($partidas_principales);
    
    // 5. Obtener TODOS los egresos (transacciones tipo 'Egreso') ordenados por partida y fecha
    $stmt = $pdo->prepare("
        SELECT 
            t.id,
            t.tipo,
            t.concepto,
            t.monto as monto_usd,
            t.fecha_transaccion,
            t.numero_documento,
            t.beneficiario,
            t.descripcion,
            t.metodo_pago,
            t.status,
            t.partida_id,
            p.codigo as codigo_partida,
            p.nombre as nombre_partida,
            p.partida_padre_id,
            pp.codigo as codigo_padre,
            pp.nombre as nombre_padre
        FROM transacciones t
        LEFT JOIN partidas p ON t.partida_id = p.id
        LEFT JOIN partidas pp ON p.partida_padre_id = pp.id
        WHERE t.proyecto_id = ? AND t.tipo = 'Egreso'
        ORDER BY 
            CASE WHEN p.partida_padre_id IS NULL THEN p.codigo ELSE pp.codigo END,
            p.codigo,
            t.fecha_transaccion DESC
    ");
    $stmt->execute([$proyecto_id]);
    $egresos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 6. Organizar egresos por partida principal y subpartida
    $egresos_organizados = [];
    foreach ($egresos as $egreso) {
        $partida_padre_id = $egreso['partida_padre_id'];
        $partida_id = $egreso['partida_id'];
        
        if ($partida_padre_id) {
            // Es una subpartida
            if (!isset($egresos_organizados[$partida_padre_id])) {
                $egresos_organizados[$partida_padre_id] = [
                    'partida_principal' => [
                        'codigo' => $egreso['codigo_padre'],
                        'nombre' => $egreso['nombre_padre'],
                        'id' => $partida_padre_id
                    ],
                    'subpartidas' => []
                ];
            }
            
            if (!isset($egresos_organizados[$partida_padre_id]['subpartidas'][$partida_id])) {
                $egresos_organizados[$partida_padre_id]['subpartidas'][$partida_id] = [
                    'codigo' => $egreso['codigo_partida'],
                    'nombre' => $egreso['nombre_partida'],
                    'id' => $partida_id,
                    'egresos' => []
                ];
            }
            
            $egresos_organizados[$partida_padre_id]['subpartidas'][$partida_id]['egresos'][] = $egreso;
        } else {
            // Es una partida principal (sin padre)
            if (!isset($egresos_organizados[$partida_id])) {
                $egresos_organizados[$partida_id] = [
                    'partida_principal' => [
                        'codigo' => $egreso['codigo_partida'],
                        'nombre' => $egreso['nombre_partida'],
                        'id' => $partida_id
                    ],
                    'subpartidas' => []
                ];
            }
            
            // Agregar egreso directamente a la partida principal
            if (!isset($egresos_organizados[$partida_id]['subpartidas'][0])) {
                $egresos_organizados[$partida_id]['subpartidas'][0] = [
                    'codigo' => $egreso['codigo_partida'],
                    'nombre' => $egreso['nombre_partida'],
                    'id' => $partida_id,
                    'egresos' => []
                ];
            }
            
            $egresos_organizados[$partida_id]['subpartidas'][0]['egresos'][] = $egreso;
        }
    }
    
    // 7. Obtener abonos
    $stmt = $pdo->prepare("
        SELECT 
            id,
            tipo,
            concepto,
            monto as monto_usd,
            fecha_transaccion,
            numero_documento,
            beneficiario,
            descripcion,
            metodo_pago,
            status,
            partida_id
        FROM transacciones 
        WHERE proyecto_id = ? AND tipo = 'Ingreso'
        ORDER BY fecha_transaccion DESC
    ");
    $stmt->execute([$proyecto_id]);
    $abonos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 8. Obtener ajustes de presupuesto
    $ajustes = [];
    try {
        $stmt = $pdo->prepare("
            SELECT 
                ap.id,
                ap.proyecto_id,
                ap.partida_id,
                ap.monto_anterior,
                ap.monto_nuevo,
                ap.tipo,
                ap.motivo,
                ap.created_by,
                ap.created_at,
                u.nombre as usuario_nombre,
                p.codigo as partida_codigo,
                p.nombre as partida_nombre,
                pp.codigo as partida_padre_codigo,
                pp.nombre as partida_padre_nombre
            FROM ajustes_presupuesto ap
            LEFT JOIN usuarios u ON ap.created_by = u.id
            LEFT JOIN partidas p ON ap.partida_id = p.id
            LEFT JOIN partidas pp ON p.partida_padre_id = pp.id
            WHERE ap.proyecto_id = ?
            ORDER BY ap.created_at DESC
        ");
        $stmt->execute([$proyecto_id]);
        $ajustes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Formatear los ajustes para mejor presentación
        foreach ($ajustes as &$ajuste) {
            $ajuste['diferencia'] = $ajuste['monto_nuevo'] - $ajuste['monto_anterior'];
            $ajuste['tipo_formateado'] = $ajuste['tipo'] == 'REASIGNACION' ? 'REASIGNACIÓN' : 'AJUSTE';
            $ajuste['partida_completa'] = $ajuste['partida_padre_codigo'] ? 
                "{$ajuste['partida_padre_codigo']} - {$ajuste['partida_codigo']}" : 
                $ajuste['partida_codigo'];
            $ajuste['nombre_completo'] = $ajuste['partida_padre_nombre'] ? 
                "{$ajuste['partida_padre_nombre']} > {$ajuste['partida_nombre']}" : 
                $ajuste['partida_nombre'];
        }
    } catch (Exception $e) {
        // Si no existe la tabla, continuar sin ajustes
        $ajustes = [];
    }
    
    // 9. Calcular resumen financiero
    $presupuestoTotal = (float) ($proyecto['presupuesto'] ?? 0);

     // Calcular PSC Cost y Valor Integral
    $pscCost = $presupuestoTotal * 0.07;
    $valorIntegral = $presupuestoTotal + $pscCost;
    
    $abonosRecibidos = array_sum(array_map(function($a) {
        return (float) ($a['monto_usd'] ?? 0);
    }, $abonos));
    
    $gastosRealizados = array_sum(array_column($egresos, 'monto_usd'));
    $saldoDisponible = $abonosRecibidos - $gastosRealizados;
    $saldoPorCobrar = $presupuestoTotal * 0.7;
    $porcentajeEjecutado = $presupuestoTotal > 0 ? ($gastosRealizados / $presupuestoTotal) * 100 : 0;
    
        return [
        'proyecto' => $proyecto,
        'partidas_principales' => $partidas_principales,
        'egresos_organizados' => $egresos_organizados,
        'abonos' => $abonos,
        'ajustes' => $ajustes,
        'egresos_totales' => $egresos,
        'resumen' => [
            'presupuesto_total' => $presupuestoTotal,
            'psc_cost' => $pscCost,
            'valor_integral' => $valorIntegral,
            'abonos_recibidos' => $abonosRecibidos,
            'gastos_realizados' => $gastosRealizados,
            'saldo_disponible' => $saldoDisponible,
            'saldo_por_cobrar' => $saldoPorCobrar,
            'porcentaje_ejecutado' => $porcentajeEjecutado
        ],
        'fecha_generacion' => date('d/m/Y H:i:s'),
        'config' => [
            'titulo' => 'Reporte Financiero - Egresos',
            'organizacion' => 'CODEHCIU',
            'proyecto_id' => $proyecto_id
        ]
    ];
}

function generarContenidoHTMLParaReporte($data) {
    // Obtener datos básicos
    $proyectoNombre = htmlspecialchars($data['proyecto']['nombre'] ?? 'Proyecto');
    $cliente = htmlspecialchars($data['proyecto']['cliente'] ?? 'No especificado');
    $fechaGeneracion = htmlspecialchars($data['fecha_generacion'] ?? date('d/m/Y H:i:s'));
    
    // Preparar datos para el resumen
    $presupuestoTotal = $data['resumen']['presupuesto_total'] ?? 0;
    $abonosRecibidos = $data['resumen']['abonos_recibidos'] ?? 0;
    $gastosRealizados = $data['resumen']['gastos_realizados'] ?? 0;
    $saldoDisponible = $data['resumen']['saldo_disponible'] ?? 0;

        // Calcular PSC Cost y Valor Integral
    $pscCost = $presupuestoTotal * 0.07;
    $valorIntegral = $presupuestoTotal + $pscCost;
    
    // Calcular porcentajes
    $porcentajeAbonos = $presupuestoTotal > 0 ? ($abonosRecibidos / $presupuestoTotal) * 100 : 0;
    $porcentajeGastos = $presupuestoTotal > 0 ? ($gastosRealizados / $presupuestoTotal) * 100 : 0;
    
    // HTML
    $html = '<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Reporte Financiero - ' . $proyectoNombre . '</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                font-size: 12px; 
                margin: 20px; 
                line-height: 1.4;
            }
            h1 { 
                font-size: 18px; 
                text-align: center; 
                margin-bottom: 5px;
                color: #333;
            }
            h2 { 
                font-size: 14px; 
                background-color: #2c3e50; 
                color: white;
                padding: 8px; 
                margin: 20px 0 10px 0;
                border-radius: 4px;
            }
            h3 {
                font-size: 13px;
                background-color: #3498db;
                color: white;
                padding: 6px;
                margin: 15px 0 8px 0;
                border-radius: 3px;
            }
            h4 {
                font-size: 12px;
                background-color: #7f8c8d;
                color: white;
                padding: 4px 8px;
                margin: 10px 0 5px 0;
                border-radius: 2px;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 15px; 
            }
            th { 
                background-color: #34495e; 
                color: white; 
                padding: 8px; 
                text-align: left; 
                border: 1px solid #2c3e50;
                font-weight: bold;
            }
            td { 
                padding: 6px; 
                border: 1px solid #ddd; 
                vertical-align: top;
            }
            .total { 
                font-weight: bold; 
                background-color: #ecf0f1; 
            }
            .negativo { 
                color: #e74c3c; 
                font-weight: bold;
            }
            .positivo { 
                color: #27ae60; 
                font-weight: bold;
            }
            .centro { 
                text-align: center; 
            }
            .derecha { 
                text-align: right; 
            }
            .izquierda {
                text-align: left;
            }
            .resumen-header {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                border: 1px solid #dee2e6;
            }
            .partida-principal {
                background-color: #f1f8ff;
                border-left: 4px solid #3498db;
                margin: 15px 0;
                padding: 10px;
            }
            .subpartida {
                background-color: #f9f9f9;
                border-left: 3px solid #7f8c8d;
                margin: 10px 0 10px 15px;
                padding: 8px;
            }
            .egreso-item {
                margin: 5px 0 5px 20px;
                padding: 4px;
                background-color: #fff;
                border-left: 2px solid #e74c3c;
            }
            .codigo-partida {
                font-family: "Courier New", monospace;
                font-weight: bold;
                color: #2c3e50;
            }
            .fecha {
                color: #666;
                font-size: 11px;
            }
            hr {
                border: none;
                border-top: 2px solid #eee;
                margin: 20px 0;
            }
            .footer {
                margin-top: 30px;
                padding-top: 15px;
                border-top: 2px solid #2c3e50;
                text-align: center;
                color: #666;
                font-size: 11px;
            }
            .ajuste-row {
                background-color: #fffde7;
                border-left: 3px solid #ffc107;
            }
            .reasignacion-row {
                background-color: #e8f5e9;
                border-left: 3px solid #4caf50;
            }
            .monto-aumento {
                color: #27ae60;
                font-weight: bold;
            }
            .monto-decremento {
                color: #e74c3c;
                font-weight: bold;
            }
        </style>
    </head>
    <body>';
    
    // Encabezado
    $html .= '
    <div class="centro">
        <h1>REPORTE FINANCIERO COMPLETO</h1>
        <div class="resumen-header">
            <strong>Socio:</strong> ' . $cliente . '<br>
            <strong>Proyecto:</strong> ' . $proyectoNombre . '<br>
            <strong>Fecha generación:</strong> ' . $fechaGeneracion . '
        </div>
    </div>';
    
    // 1. Resumen financiero
    $html .= '
    <h2>1. RESUMEN FINANCIERO</h2>
    <table>
        <tr>
            <th width="60%">CONCEPTO</th>
            <th width="20%" class="derecha">MONTO (USD)</th>
            <th width="20%" class="derecha">PORCENTAJE</th>
        </tr>
        <tr>
            <td>Presupuesto total ejecutable del proyecto</td>
            <td class="derecha">$' . number_format($presupuestoTotal, 2) . '</td>
            <td class="derecha">93%</td>
        </tr>
        <tr>
            <td>PSC Cost (7% del presupuesto)</td>
            <td class="derecha">$' . number_format($pscCost, 2) . '</td>
            <td class="derecha">7%</td>
        </tr>
        <tr class="total">
            <td><strong>Presupuesto total ejecutable + PSC Cost</strong></td>
            <td class="derecha"><strong>$' . number_format($valorIntegral, 2) . '</strong></td>
            <td class="derecha"><strong>100%</strong></td>
        </tr>
        <tr>
            <td>Abonos Recibidos</td>
            <td class="derecha positivo">$' . number_format($abonosRecibidos, 2) . '</td>
            <td class="derecha">' . number_format($porcentajeAbonos, 1) . '%</td>
        </tr>
        <tr>
            <td>Gastos Realizados (Egresos)</td>
            <td class="derecha negativo">$' . number_format($gastosRealizados, 2) . '</td>
            <td class="derecha">' . number_format($porcentajeGastos, 1) . '%</td>
        </tr>
        <tr class="total">
            <td><strong>SALDO DISPONIBLE EN CAJA</strong></td>
            <td class="derecha ' . ($saldoDisponible < 0 ? 'negativo' : 'positivo') . '">
                <strong>$' . number_format($saldoDisponible, 2) . '</strong>
            </td>
            <td class="derecha">&nbsp;</td>
        </tr>
    </table>';
    
    // 2. Abonos recibidos
    if (isset($data['abonos']) && count($data['abonos']) > 0) {
        $html .= '
        <h2>2. ABONOS RECIBIDOS</h2>
        <table>
            <tr>
                <th width="15%">FECHA</th>
                <th width="45%">CONCEPTO</th>
                <th width="20%" class="derecha">MONTO USD</th>
                <th width="20%">BENEFICIARIO</th>
            </tr>';
        
        foreach ($data['abonos'] as $abono) {
            $html .= '
            <tr>
                <td class="fecha">' . htmlspecialchars($abono['fecha_transaccion'] ?? '') . '</td>
                <td>' . htmlspecialchars($abono['concepto'] ?? '') . '</td>
                <td class="derecha positivo">$' . number_format($abono['monto_usd'] ?? 0, 2) . '</td>
                <td>' . htmlspecialchars($abono['beneficiario'] ?? '') . '</td>
            </tr>';
        }
        
        $html .= '
            <tr class="total">
                <td colspan="2"><strong>TOTAL ABONOS RECIBIDOS</strong></td>
                <td class="derecha positivo"><strong>$' . number_format($abonosRecibidos, 2) . '</strong></td>
                <td>&nbsp;</td>
            </tr>
        </table>';
    }
    
    // 3. Resumen de partidas principales
    if (isset($data['partidas_principales']) && count($data['partidas_principales']) > 0) {
        $html .= '
        <h2>3. RESUMEN DE PARTIDAS PRINCIPALES</h2>
        <table>
            <tr>
                <th width="15%">CÓDIGO</th>
                <th width="40%">NOMBRE</th>
                <th width="15%" class="derecha">PRESUPUESTO</th>
                <th width="15%" class="derecha">GASTADO</th>
                <th width="15%" class="derecha">SALDO</th>
            </tr>';
        
        $totalPresupuesto = 0;
        $totalGastado = 0;
        $totalSaldo = 0;
        
        foreach ($data['partidas_principales'] as $partida) {
            $presupuesto = $partida['presupuesto_actual'] ?? 0;
            $gastado = $partida['gastado_total'] ?? ($partida['gastado'] ?? 0);
            $saldo = $partida['saldo_total'] ?? ($partida['saldo_disponible'] ?? 0);
            $porcentaje = $presupuesto > 0 ? ($gastado / $presupuesto) * 100 : 0;
            
            $totalPresupuesto += $presupuesto;
            $totalGastado += $gastado;
            $totalSaldo += $saldo;
            
            $estadoClase = '';
            if ($porcentaje >= 90) $estadoClase = 'negativo';
            elseif ($porcentaje >= 75) $estadoClase = 'negativo';
            elseif ($porcentaje >= 50) $estadoClase = '';
            
            $html .= '
            <tr>
                <td><span class="codigo-partida">' . htmlspecialchars($partida['codigo_partida'] ?? '') . '</span></td>
                <td>' . htmlspecialchars($partida['nombre_partida'] ?? '') . '</td>
                <td class="derecha">$' . number_format($presupuesto, 2) . '</td>
                <td class="derecha ' . $estadoClase . '">$' . number_format($gastado, 2) . '</td>
                <td class="derecha ' . ($saldo < 0 ? 'negativo' : '') . '">$' . number_format($saldo, 2) . '</td>
            </tr>';
        }
        
        $html .= '
            <tr class="total">
                <td colspan="2"><strong>TOTALES GENERALES</strong></td>
                <td class="derecha"><strong>$' . number_format($totalPresupuesto, 2) . '</strong></td>
                <td class="derecha"><strong>$' . number_format($totalGastado, 2) . '</strong></td>
                <td class="derecha"><strong>$' . number_format($totalSaldo, 2) . '</strong></td>
            </tr>
        </table>';
    }
    
    // 4. Ajustes y Reasignaciones
    if (isset($data['ajustes']) && count($data['ajustes']) > 0) {
        $html .= '
        <h2>4. AJUSTES Y REASIGNACIONES DE PRESUPUESTO</h2>
        <table>
            <tr>
                <th width="12%">FECHA</th>
                <th width="12%">TIPO</th>
                <th width="25%">PARTIDA</th>
                <th width="15%" class="derecha">MONTO ANTERIOR</th>
                <th width="15%" class="derecha">MONTO NUEVO</th>
                <th width="15%" class="derecha">DIFERENCIA</th>
                <th width="6%">USUARIO</th>
            </tr>';
        
        foreach ($data['ajustes'] as $ajuste) {
            $tipoClase = $ajuste['tipo'] == 'REASIGNACION' ? 'reasignacion-row' : 'ajuste-row';
            $diferenciaClase = $ajuste['diferencia'] > 0 ? 'monto-aumento' : 'monto-decremento';
            $signo = $ajuste['diferencia'] > 0 ? '+' : '';
            
            $html .= '
            <tr class="' . $tipoClase . '">
                <td class="fecha">' . htmlspecialchars($ajuste['created_at'] ?? '') . '</td>
                <td><strong>' . htmlspecialchars($ajuste['tipo_formateado'] ?? '') . '</strong></td>
                <td>
                    <div><strong>' . htmlspecialchars($ajuste['partida_completo'] ?? '') . '</strong></div>
                    <div style="font-size: 11px; color: #666;">' . htmlspecialchars($ajuste['nombre_completo'] ?? '') . '</div>
                </td>
                <td class="derecha">$' . number_format($ajuste['monto_anterior'] ?? 0, 2) . '</td>
                <td class="derecha">$' . number_format($ajuste['monto_nuevo'] ?? 0, 2) . '</td>
                <td class="derecha ' . $diferenciaClase . '">' . $signo . '$' . number_format($ajuste['diferencia'] ?? 0, 2) . '</td>
                <td>' . htmlspecialchars($ajuste['usuario_nombre'] ?? 'Sistema') . '</td>
            </tr>';
            
            // Mostrar motivo si existe
            if (!empty($ajuste['motivo'])) {
                $html .= '
                <tr class="' . $tipoClase . '">
                    <td colspan="7" style="font-size: 11px; color: #555; padding-left: 30px;">
                        <strong>Motivo:</strong> ' . htmlspecialchars($ajuste['motivo'] ?? '') . '
                    </td>
                </tr>';
            }
        }
        
        $html .= '</table>';
    } else {
        $html .= '
        <h2>4. AJUSTES Y REASIGNACIONES DE PRESUPUESTO</h2>
        <p><em>No se han registrado ajustes o reasignaciones de presupuesto para este proyecto.</em></p>';
    }
    
    // 5. Egresos organizados por partida (subpartidas y transacciones completas)
    if (isset($data['egresos_organizados']) && count($data['egresos_organizados']) > 0) {
        $html .= '
        <h2>5. EGRESOS POR PARTIDA (DETALLE COMPLETO)</h2>';
        
        $totalEgresosReporte = 0;
        
        foreach ($data['egresos_organizados'] as $partidaPrincipal) {
            $codigoPrincipal = $partidaPrincipal['partida_principal']['codigo'] ?? '';
            $nombrePrincipal = $partidaPrincipal['partida_principal']['nombre'] ?? '';
            
            $html .= '
            <div class="partida-principal">
                <h3><span class="codigo-partida">' . htmlspecialchars($codigoPrincipal) . '</span> - ' . htmlspecialchars($nombrePrincipal) . '</h3>';
            
            $totalPartida = 0;
            
            foreach ($partidaPrincipal['subpartidas'] as $subpartida) {
                $codigoSubpartida = $subpartida['codigo'] ?? '';
                $nombreSubpartida = $subpartida['nombre'] ?? '';
                
                $html .= '
                <div class="subpartida">
                    <h4><span class="codigo-partida">' . htmlspecialchars($codigoSubpartida) . '</span> - ' . htmlspecialchars($nombreSubpartida) . '</h4>';
                
                if (isset($subpartida['egresos']) && count($subpartida['egresos']) > 0) {
                    $totalSubpartida = 0;
                    
                    $html .= '
                    <table>
                        <tr>
                            <th width="15%">FECHA</th>
                            <th width="45%">CONCEPTO</th>
                            <th width="20%" class="derecha">MONTO USD</th>
                            <th width="20%">BENEFICIARIO / REFERENCIA</th>
                        </tr>';
                    
                    foreach ($subpartida['egresos'] as $egreso) {
                        $fecha = htmlspecialchars($egreso['fecha_transaccion'] ?? '');
                        $concepto = htmlspecialchars($egreso['concepto'] ?? '');
                        $monto = $egreso['monto_usd'] ?? 0;
                        $beneficiario = htmlspecialchars($egreso['beneficiario'] ?? '');
                        $referencia = htmlspecialchars($egreso['numero_documento'] ?? '');
                        
                        $totalSubpartida += $monto;
                        
                        $html .= '
                        <tr>
                            <td class="fecha">' . $fecha . '</td>
                            <td>' . $concepto . '</td>
                            <td class="derecha negativo">$' . number_format($monto, 2) . '</td>
                            <td>' . $beneficiario . ($referencia ? ' (Ref: ' . $referencia . ')' : '') . '</td>
                        </tr>';
                    }
                    
                    $html .= '
                        <tr class="total">
                            <td colspan="2"><strong>Total Subpartida ' . htmlspecialchars($codigoSubpartida) . ':</strong></td>
                            <td class="derecha negativo"><strong>$' . number_format($totalSubpartida, 2) . '</strong></td>
                            <td>&nbsp;</td>
                        </tr>
                    </table>';
                    
                    $totalPartida += $totalSubpartida;
                } else {
                    $html .= '<p><em>No hay egresos registrados para esta subpartida</em></p>';
                }
                
                $html .= '</div>';
            }
            
            $html .= '
                <div style="margin-top: 10px; padding: 8px; background-color: #e8f4fc; border-radius: 3px;">
                    <strong>Total Partida ' . htmlspecialchars($codigoPrincipal) . ':</strong> 
                    <span class="negativo" style="float: right;">$' . number_format($totalPartida, 2) . ' USD</span>
                </div>
            </div>';
            
            $totalEgresosReporte += $totalPartida;
        }
        
        $html .= '
        <div style="margin: 20px 0; padding: 12px; background-color: #2c3e50; color: white; border-radius: 4px;">
            <strong>TOTAL GENERAL DE EGRESOS:</strong> 
            <span style="float: right; font-size: 14px;">$' . number_format($totalEgresosReporte, 2) . ' USD</span>
        </div>';
    } else {
        $html .= '
        <h2>5. EGRESOS POR PARTIDA (DETALLE COMPLETO)</h2>
        <p><em>No hay egresos registrados para este proyecto</em></p>';
    }
    
    // Pie de página
    $html .= '
    <div class="footer">
        <p><strong>Reporte generado por Sistema de Control Financiero - CODEHCIU</strong></p>
        <p><em>Documento confidencial para uso interno</em></p>
        <p>Fecha de impresión: ' . date('d/m/Y H:i:s') . ' | Total de egresos mostrados: ' . count($data['egresos_totales'] ?? []) . '</p>
    </div>
    
    </body>
    </html>';
    
    return $html;
}

function generarContenidoCSVOrganizado($data) {
    $contenido = "REPORTE FINANCIERO COMPLETO - " . ($data['proyecto']['nombre'] ?? 'Proyecto') . "\n";
    $contenido .= "Fecha de generación: " . ($data['fecha_generacion'] ?? date('Y-m-d H:i:s')) . "\n";
    $contenido .= "Cliente: " . ($data['proyecto']['cliente'] ?? 'No especificado') . "\n\n";

    // Calcular PSC Cost y Valor Integral
    $pscCost = $presupuestoTotal * 0.07;
    $valorIntegral = $presupuestoTotal + $pscCost;
    
    // 1. Resumen financiero
    $presupuestoTotal = $data['resumen']['presupuesto_total'] ?? 0;
    $abonosRecibidos = $data['resumen']['abonos_recibidos'] ?? 0;
    $gastosRealizados = $data['resumen']['gastos_realizados'] ?? 0;
    $saldoDisponible = $data['resumen']['saldo_disponible'] ?? 0;
    
     $contenido .= "1. RESUMEN FINANCIERO\n";
    $contenido .= "Concepto,Monto USD\n";
    $contenido .= "Presupuesto Total,$" . number_format($presupuestoTotal, 2) . "\n";
    $contenido .= "PSC Cost (7% del presupuesto),$" . number_format($pscCost, 2) . "\n";
    $contenido .= "Presupuesto total + PSC Cost (Valor Integral),$" . number_format($valorIntegral, 2) . "\n";
    $contenido .= "Abonos Recibidos,$" . number_format($abonosRecibidos, 2) . "\n";
    $contenido .= "Gastos Realizados,$" . number_format($gastosRealizados, 2) . "\n";
    $contenido .= "Saldo Disponible,$" . number_format($saldoDisponible, 2) . "\n\n";
    
    // 2. Abonos recibidos
    $contenido .= "2. ABONOS RECIBIDOS\n";
    $contenido .= "Fecha,Concepto,Monto USD,Beneficiario,Referencia\n";
    
    if (isset($data['abonos']) && count($data['abonos']) > 0) {
        foreach ($data['abonos'] as $abono) {
            $contenido .= '"' . ($abono['fecha_transaccion'] ?? '') . '","' .
                         ($abono['concepto'] ?? '') . '",' .
                         number_format($abono['monto_usd'] ?? 0, 2) . ',"' .
                         ($abono['beneficiario'] ?? '') . '","' .
                         ($abono['numero_documento'] ?? '') . '"' . "\n";
        }
    }
    $contenido .= '"TOTAL ABONOS","",' . number_format($abonosRecibidos, 2) . ',"",""' . "\n\n";
    
    // 3. Resumen de partidas principales
    $contenido .= "3. RESUMEN DE PARTIDAS PRINCIPALES\n";
    $contenido .= "Código,Nombre,Presupuesto USD,Gastado USD,Saldo USD,Porcentaje Gastado\n";
    
    if (isset($data['partidas_principales']) && count($data['partidas_principales']) > 0) {
        foreach ($data['partidas_principales'] as $partida) {
            $presupuesto = $partida['presupuesto_actual'] ?? 0;
            $gastado = $partida['gastado_total'] ?? ($partida['gastado'] ?? 0);
            $saldo = $partida['saldo_total'] ?? ($partida['saldo_disponible'] ?? 0);
            $porcentaje = $presupuesto > 0 ? ($gastado / $presupuesto) * 100 : 0;
            
            $contenido .= '"' . ($partida['codigo_partida'] ?? '') . '","' .
                         ($partida['nombre_partida'] ?? '') . '",' .
                         number_format($presupuesto, 2) . ',' .
                         number_format($gastado, 2) . ',' .
                         number_format($saldo, 2) . ',' .
                         number_format($porcentaje, 1) . '%' . "\n";
        }
    }
    $contenido .= "\n";
    
    // 4. Ajustes y reasignaciones
    $contenido .= "4. AJUSTES Y REASIGNACIONES DE PRESUPUESTO\n";
    $contenido .= "Fecha,Tipo,Partida,Monto Anterior USD,Monto Nuevo USD,Diferencia USD,Usuario,Motivo\n";
    
    if (isset($data['ajustes']) && count($data['ajustes']) > 0) {
        foreach ($data['ajustes'] as $ajuste) {
            $diferencia = $ajuste['diferencia'] ?? 0;
            $signo = $diferencia > 0 ? '+' : '';
            
            $contenido .= '"' . ($ajuste['created_at'] ?? '') . '","' .
                         ($ajuste['tipo_formateado'] ?? '') . '","' .
                         ($ajuste['partida_completo'] ?? '') . '",' .
                         number_format($ajuste['monto_anterior'] ?? 0, 2) . ',' .
                         number_format($ajuste['monto_nuevo'] ?? 0, 2) . ',' .
                         $signo . number_format($diferencia, 2) . ',"' .
                         ($ajuste['usuario_nombre'] ?? 'Sistema') . '","' .
                         ($ajuste['motivo'] ?? '') . '"' . "\n";
        }
    } else {
        $contenido .= "No se han registrado ajustes o reasignaciones de presupuesto\n";
    }
    $contenido .= "\n";
    
    // 5. Egresos organizados por partida
    $contenido .= "5. EGRESOS POR PARTIDA (DETALLE COMPLETO)\n";
    $contenido .= "Partida Principal,Subpartida,Fecha,Concepto,Monto USD,Beneficiario,Referencia\n";
    
    if (isset($data['egresos_organizados']) && count($data['egresos_organizados']) > 0) {
        foreach ($data['egresos_organizados'] as $partidaPrincipal) {
            $codigoPrincipal = $partidaPrincipal['partida_principal']['codigo'] ?? '';
            $nombrePrincipal = $partidaPrincipal['partida_principal']['nombre'] ?? '';
            
            foreach ($partidaPrincipal['subpartidas'] as $subpartida) {
                $codigoSubpartida = $subpartida['codigo'] ?? '';
                $nombreSubpartida = $subpartida['nombre'] ?? '';
                
                if (isset($subpartida['egresos']) && count($subpartida['egresos']) > 0) {
                    foreach ($subpartida['egresos'] as $egreso) {
                        $contenido .= '"' . $codigoPrincipal . ' - ' . $nombrePrincipal . '","' .
                                     $codigoSubpartida . ' - ' . $nombreSubpartida . '","' .
                                     ($egreso['fecha_transaccion'] ?? '') . '","' .
                                     ($egreso['concepto'] ?? '') . '",' .
                                     number_format($egreso['monto_usd'] ?? 0, 2) . ',"' .
                                     ($egreso['beneficiario'] ?? '') . '","' .
                                     ($egreso['numero_documento'] ?? '') . '"' . "\n";
                    }
                }
            }
        }
    }
    
    $contenido .= "\nReporte generado automáticamente por el Sistema de Control de Flujo Financiero - CODEHCIU\n";
    $contenido .= "Documento confidencial para uso interno\n";
    $contenido .= "Fecha: " . date('d/m/Y H:i:s') . "\n";
    
    return $contenido;
}