<?php
/**
 * API para Aprobar/Rechazar Solicitudes de Compra
 * MODIFICADO: Soporte para IVA en items de la Orden de Compra
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

ob_clean();
error_reporting(0);
ini_set('display_errors', 0);

try {
    require_once 'database.php';
    require_once 'email_config.php';
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error de configuración: ' . $e->getMessage()]);
    exit;
}

session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$usuario_id = $_SESSION['user_id'];
$rol = strtolower($_SESSION['user_role'] ?? '');

$rolNormalizado = $rol;
if (in_array($rol, ['contab', 'contador'])) $rolNormalizado = 'contab';
if (in_array($rol, ['admin', 'administrador'])) $rolNormalizado = 'admin';

if (!in_array($rolNormalizado, ['admin', 'contab'])) {
    echo json_encode(['success' => false, 'message' => 'No tiene permisos para esta acción']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    echo json_encode(['success' => false, 'message' => 'Error al leer los datos de la solicitud']);
    exit;
}

$solicitud_id = $input['solicitud_id'] ?? 0;
$decision = $input['decision'] ?? '';
$comentario = $input['comentario'] ?? '';
$proveedor_id = $input['proveedor_id'] ?? null;
$cotizacion_ganadora_id = $input['cotizacion_ganadora_id'] ?? null;
$direccion_entrega = $input['direccion_entrega'] ?? null;
$fecha_entrega = $input['fecha_entrega'] ?? null;
$forma_pago = $input['forma_pago'] ?? null;
$items_oc = $input['items_oc'] ?? [];
$monto_total_oc = $input['monto_total_oc'] ?? 0;
$monto_total_con_iva = $input['monto_total_con_iva'] ?? 0;

if (!$solicitud_id || !in_array($decision, ['Aprobada', 'Rechazada'])) {
    echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
    exit;
}

try {
    if (!isset($pdo) || !$pdo) {
        throw new Exception('Error de conexión a la base de datos');
    }
    
    $solicitud_query = "
        SELECT sc.*, u.nombre as solicitante_nombre, u.email as solicitante_email,
               p.nombre as proyecto_nombre, p.id as proyecto_id
        FROM solicitudes_compras sc
        LEFT JOIN usuarios u ON sc.solicitante_id = u.id
        LEFT JOIN proyectos p ON sc.proyecto_id = p.id
        WHERE sc.id = :id
    ";
    $stmt = $pdo->prepare($solicitud_query);
    $stmt->execute([':id' => $solicitud_id]);
    $solicitud = $stmt->fetch();
    
    if (!$solicitud) {
        throw new Exception('Solicitud no encontrada');
    }
    
    if ($solicitud['estado'] !== 'Pendiente') {
        throw new Exception('La solicitud ya fue procesada. Estado actual: ' . $solicitud['estado']);
    }
    
    $aprobador = getUsuarioById($pdo, $usuario_id);
    $pdo->beginTransaction();
    
    // Actualizar solicitud
    $query = "
        UPDATE solicitudes_compras 
        SET estado = :estado, 
            comentarios_rechazo = :comentario,
            aprobado_por = :usuario_id,
            fecha_aprobacion = NOW(),
            direccion_entrega = :direccion_entrega,
            fecha_entrega = :fecha_entrega,
            forma_pago = :forma_pago
        WHERE id = :id AND estado = 'Pendiente'
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([
        ':estado' => $decision,
        ':comentario' => $comentario,
        ':usuario_id' => $usuario_id,
        ':id' => $solicitud_id,
        ':direccion_entrega' => $direccion_entrega,
        ':fecha_entrega' => $fecha_entrega,
        ':forma_pago' => $forma_pago
    ]);
    
    if ($stmt->rowCount() == 0) {
        throw new Exception('No se pudo actualizar la solicitud');
    }
    
    $historial_query = "
        INSERT INTO historial_solicitud (solicitud_id, usuario_id, estado_anterior, estado_nuevo, comentario)
        VALUES (:solicitud_id, :usuario_id, 'Pendiente', :estado, :comentario)
    ";
    $historial_stmt = $pdo->prepare($historial_query);
    $historial_stmt->execute([
        ':solicitud_id' => $solicitud_id,
        ':usuario_id' => $usuario_id,
        ':estado' => $decision,
        ':comentario' => $comentario
    ]);
    
    $orden_compra_id = null;
    $oc_codigo = null;
    
    // Si es aprobada, generar Orden de Compra
    if ($decision === 'Aprobada') {
        $proveedor_final = $proveedor_id;
        $monto_aprobado = $solicitud['monto_estimado'];
        
        if ($solicitud['tipo_solicitud'] === 'compra' && $solicitud['requiere_cotizaciones'] && $cotizacion_ganadora_id) {
            $cot_query = "SELECT * FROM cotizaciones WHERE id = :id";
            $cot_stmt = $pdo->prepare($cot_query);
            $cot_stmt->execute([':id' => $cotizacion_ganadora_id]);
            $cotizacion = $cot_stmt->fetch();
            
            if ($cotizacion) {
                $proveedor_final = $cotizacion['proveedor_id'];
                $monto_aprobado = $cotizacion['monto_cotizado'];
                
                $update_cot = $pdo->prepare("UPDATE cotizaciones SET es_ganador = 1 WHERE id = :id");
                $update_cot->execute([':id' => $cotizacion_ganadora_id]);
            }
        }
        
        if ($proveedor_final) {
            // Generar código de Orden de Compra con proyecto_id
            $anio = date('Y');
            $proyecto_id = $solicitud['proyecto_id'];
            $prefijo_oc = "CMP-OC-{$proyecto_id}-{$anio}-";
            $oc_count = $pdo->prepare("SELECT COUNT(*) as total FROM ordenes_compra WHERE codigo_oc LIKE :prefijo");
            $oc_count->execute([':prefijo' => $prefijo_oc . '%']);
            $oc_row = $oc_count->fetch();
            $oc_numero = $oc_row['total'] + 1;
            $oc_correlativo = str_pad($oc_numero, 6, '0', STR_PAD_LEFT);
            $oc_codigo = $prefijo_oc . $oc_correlativo;
            
            // Determinar el monto total a usar (prioridad: monto_total_con_iva > monto_total_oc > monto_aprobado)
            $monto_final = $monto_aprobado;
            if ($monto_total_con_iva > 0) {
                $monto_final = $monto_total_con_iva;
            } elseif ($monto_total_oc > 0) {
                $monto_final = $monto_total_oc;
            }
            
            // Insertar Orden de Compra
            $insert_oc = $pdo->prepare("
                INSERT INTO ordenes_compra (
                    codigo_oc, solicitud_id, proveedor_id, monto_aprobado,
                    fecha_emision, aprobado_por, estado, created_by
                ) VALUES (
                    :codigo_oc, :solicitud_id, :proveedor_id, :monto_aprobado,
                    CURDATE(), :aprobado_por, 'Aprobada', :created_by
                )
            ");
            $insert_oc->execute([
                ':codigo_oc' => $oc_codigo,
                ':solicitud_id' => $solicitud_id,
                ':proveedor_id' => $proveedor_final,
                ':monto_aprobado' => $monto_final,
                ':aprobado_por' => $usuario_id,
                ':created_by' => $usuario_id
            ]);
            
            $orden_compra_id = $pdo->lastInsertId();
            
            // Guardar items modificados de la Orden de Compra con soporte para IVA
            if (!empty($items_oc) && is_array($items_oc)) {
                $item_oc_stmt = $pdo->prepare("
                    INSERT INTO orden_compra_items (
                        orden_compra_id, descripcion_item, cantidad, unidad_medida,
                        precio_unitario, subtotal, tiene_iva, iva, total_con_iva
                    ) VALUES (
                        :oc_id, :descripcion, :cantidad, :unidad, :precio, :subtotal,
                        :tiene_iva, :iva, :total_con_iva
                    )
                ");
                
                foreach ($items_oc as $item) {
                    $precio_unitario = floatval($item['precio_unitario']);
                    $cantidad = floatval($item['cantidad']);
                    $subtotal = $precio_unitario * $cantidad;
                    $tiene_iva = isset($item['tiene_iva']) && $item['tiene_iva'] ? 1 : 0;
                    $iva = 0;
                    $total_con_iva = $subtotal;
                    
                    if ($tiene_iva) {
                        $iva = $subtotal * 0.16; // IVA del 16%
                        $total_con_iva = $subtotal + $iva;
                    }
                    
                    $item_oc_stmt->execute([
                        ':oc_id' => $orden_compra_id,
                        ':descripcion' => $item['descripcion_item'],
                        ':cantidad' => $cantidad,
                        ':unidad' => $item['unidad_medida'] ?? null,
                        ':precio' => $precio_unitario,
                        ':subtotal' => $subtotal,
                        ':tiene_iva' => $tiene_iva,
                        ':iva' => $iva,
                        ':total_con_iva' => $total_con_iva
                    ]);
                }
                
                // Actualizar monto total de la OC con el total con IVA si está disponible
                if ($monto_total_con_iva > 0) {
                    $update_monto = $pdo->prepare("UPDATE ordenes_compra SET monto_aprobado = :monto WHERE id = :id");
                    $update_monto->execute([
                        ':monto' => $monto_total_con_iva,
                        ':id' => $orden_compra_id
                    ]);
                } elseif ($monto_total_oc > 0) {
                    $update_monto = $pdo->prepare("UPDATE ordenes_compra SET monto_aprobado = :monto WHERE id = :id");
                    $update_monto->execute([
                        ':monto' => $monto_total_oc,
                        ':id' => $orden_compra_id
                    ]);
                }
            }
            
            // Actualizar solicitud con la OC
            $update_solicitud = $pdo->prepare("UPDATE solicitudes_compras SET orden_compra_id = :oc_id WHERE id = :id");
            $update_solicitud->execute([':oc_id' => $orden_compra_id, ':id' => $solicitud_id]);
        }
    }
    
    $pdo->commit();
    
    // ========== ENVIAR NOTIFICACIONES ==========
    $codigo = $solicitud['codigo_solicitud'];
    $descripcion = $solicitud['descripcion'];
    $tipo_texto = $solicitud['tipo_solicitud'] === 'servicio' ? 'Servicio' : 'Compra de Items';
    $monto_total_oc_formateado = number_format($monto_total_con_iva > 0 ? $monto_total_con_iva : ($monto_total_oc > 0 ? $monto_total_oc : $solicitud['monto_estimado']), 2, ',', '.');
    
    // Generar HTML de los items para el correo (con IVA)
    $items_html = '';
    if (!empty($items_oc) && is_array($items_oc)) {
        $items_html = '
            <div style="margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                <p><strong>📋 Detalle de la Orden de Compra:</strong></p>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background-color: #e9ecef;">
                            <th style="padding: 6px; border: 1px solid #dee2e6; text-align: left;">Cant.</th>
                            <th style="padding: 6px; border: 1px solid #dee2e6; text-align: left;">Descripción</th>
                            <th style="padding: 6px; border: 1px solid #dee2e6; text-align: left;">Unidad</th>
                            <th style="padding: 6px; border: 1px solid #dee2e6; text-align: right;">Precio Unit.</th>
                            <th style="padding: 6px; border: 1px solid #dee2e6; text-align: right;">IVA</th>
                            <th style="padding: 6px; border: 1px solid #dee2e6; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>';
        
        foreach ($items_oc as $item) {
            $precio = number_format($item['precio_unitario'], 2, ',', '.');
            $cantidad = $item['cantidad'];
            $subtotal = $item['precio_unitario'] * $cantidad;
            $tiene_iva = isset($item['tiene_iva']) && $item['tiene_iva'];
            $iva = $tiene_iva ? number_format($subtotal * 0.16, 2, ',', '.') : '0,00';
            $total = $tiene_iva ? number_format($subtotal * 1.16, 2, ',', '.') : number_format($subtotal, 2, ',', '.');
            $iva_texto = $tiene_iva ? 'Sí' : 'No';
            
            $items_html .= "
                <tr>
                    <td style=\"padding: 4px; border: 1px solid #dee2e6;\">{$cantidad}</td>
                    <td style=\"padding: 4px; border: 1px solid #dee2e6;\">{$item['descripcion_item']}</td>
                    <td style=\"padding: 4px; border: 1px solid #dee2e6;\">" . ($item['unidad_medida'] ?: '-') . "</td>
                    <td style=\"padding: 4px; border: 1px solid #dee2e6; text-align: right;\">$ {$precio}</td>
                    <td style=\"padding: 4px; border: 1px solid #dee2e6; text-align: right;\">$ {$iva}</td>
                    <td style=\"padding: 4px; border: 1px solid #dee2e6; text-align: right;\">$ {$total}</td>
                </tr>";
        }
        
        $items_html .= '
                    </tbody>
                    <tfoot>
                        <tr style="background-color: #f8f9fa; font-weight: bold;">
                            <td colspan="5" style="padding: 6px; border: 1px solid #dee2e6; text-align: right;">TOTAL GENERAL:</td>
                            <td style="padding: 6px; border: 1px solid #dee2e6; text-align: right; color: #27ae60;">$ ' . $monto_total_oc_formateado . '</td>
                        </tr>
                    </tfoot>
                </table>
            </div>';
    }
    
    if ($decision === 'Aprobada') {
        // Email al solicitante
        $asunto_solicitante = "SOLICITUD APROBADA - {$codigo}";
        $cuerpo_solicitante = "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                <div style='background-color: #27ae60; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;'>
                    <h2 style='color: #fff; margin: 0;'>¡Solicitud Aprobada!</h2>
                </div>
                <div style='background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #dee2e6; border-top: none;'>
                    <p><strong>Código:</strong> {$codigo}</p>
                    <p><strong>Tipo:</strong> {$tipo_texto}</p>
                    <p><strong>Descripción:</strong> {$descripcion}</p>
                    <p><strong>Monto Total de la Orden de Compra:</strong> <strong style='color: #27ae60;'>$ {$monto_total_oc_formateado}</strong></p>
                    " . ($direccion_entrega ? "<p><strong>Dirección de entrega:</strong> {$direccion_entrega}</p>" : "") . "
                    " . ($fecha_entrega ? "<p><strong>Fecha de entrega:</strong> " . date('d/m/Y', strtotime($fecha_entrega)) . "</p>" : "") . "
                    " . ($forma_pago ? "<p><strong>Forma de pago:</strong> {$forma_pago}</p>" : "") . "
                    " . ($oc_codigo ? "<p><strong>Orden de Compra:</strong> {$oc_codigo}</p>" : "") . "
                    <p><strong>Aprobado por:</strong> {$aprobador['nombre']}</p>
                    {$items_html}
                    <hr>
                    <p>Pronto se procederá con el pago.</p>
                </div>
            </div>
        </body></html>";
        enviarCorreo($solicitud['solicitante_email'], $solicitud['solicitante_nombre'], $asunto_solicitante, $cuerpo_solicitante);
        
        // Email a directivos
        $directivos = getEmailsPorRol($pdo, 'directivo');
        $asunto_directivos = "SOLICITUD APROBADA - {$codigo} - PENDIENTE DE PAGO";
        $cuerpo_directivos = "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                <div style='background-color: #3498db; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;'>
                    <h2 style='color: #fff; margin: 0;'>Solicitud Aprobada - Pendiente de Pago</h2>
                </div>
                <div style='background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #dee2e6; border-top: none;'>
                    <p><strong>Código:</strong> {$codigo}</p>
                    <p><strong>Tipo:</strong> {$tipo_texto}</p>
                    <p><strong>Solicitante:</strong> {$solicitud['solicitante_nombre']}</p>
                    <p><strong>Descripción:</strong> {$descripcion}</p>
                    <p><strong>Monto Total de la Orden de Compra:</strong> <strong style='color: #27ae60;'>$ {$monto_total_oc_formateado}</strong></p>
                    " . ($direccion_entrega ? "<p><strong>Dirección de entrega:</strong> {$direccion_entrega}</p>" : "") . "
                    " . ($fecha_entrega ? "<p><strong>Fecha de entrega:</strong> " . date('d/m/Y', strtotime($fecha_entrega)) . "</p>" : "") . "
                    " . ($forma_pago ? "<p><strong>Forma de pago:</strong> {$forma_pago}</p>" : "") . "
                    " . ($oc_codigo ? "<p><strong>Orden de Compra:</strong> {$oc_codigo}</p>" : "") . "
                    {$items_html}
                    <hr>
                    <p>Por favor ingrese al sistema para registrar el pago.</p>
                </div>
            </div>
        </body></html>";
        
        foreach ($directivos as $directivo) {
            enviarCorreo($directivo['email'], $directivo['nombre'], $asunto_directivos, $cuerpo_directivos);
        }
        
    } else {
        // Email al solicitante (rechazo)
        $asunto = "SOLICITUD RECHAZADA - {$codigo}";
        $cuerpo = "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                <div style='background-color: #e74c3c; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;'>
                    <h2 style='color: #fff; margin: 0;'>Solicitud Rechazada</h2>
                </div>
                <div style='background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #dee2e6; border-top: none;'>
                    <p><strong>Código:</strong> {$codigo}</p>
                    <p><strong>Tipo:</strong> {$tipo_texto}</p>
                    <p><strong>Descripción:</strong> {$descripcion}</p>
                    <p><strong>Monto estimado:</strong> $ {$monto_total_oc_formateado}</p>
                    <p><strong>Motivo del rechazo:</strong> {$comentario}</p>
                    <hr>
                    <p>Para más información, contacte a la Coordinación General.</p>
                </div>
            </div>
        </body></html>";
        enviarCorreo($solicitud['solicitante_email'], $solicitud['solicitante_nombre'], $asunto, $cuerpo);
    }
    
    // Limpiar buffer antes de enviar respuesta
    ob_clean();
    
// Enviar respuesta
    echo json_encode([
        'success' => true,
        'message' => 'Solicitud ' . ($decision === 'Aprobada' ? 'aprobada' : 'rechazada') . ' exitosamente',
        'orden_compra' => $oc_codigo ? ['id' => $orden_compra_id, 'codigo' => $oc_codigo] : null,
        'direccion_entrega' => $direccion_entrega,
        'fecha_entrega' => $fecha_entrega,
        'forma_pago' => $forma_pago,
        'items_oc' => count($items_oc),
        'monto_total_oc' => $monto_total_oc,
        'monto_total_con_iva' => $monto_total_con_iva
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Error en aprobar_solicitud: " . $e->getMessage());
    
    ob_clean();
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>