<?php
/**
 * API para Gestión de Cotizaciones
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

error_reporting(0);
ini_set('display_errors', 0);

require_once 'database.php';

session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'listar':
            listarCotizaciones($pdo);
            break;
        case 'crear':
            crearCotizacion($pdo);
            break;
        case 'actualizar':
            actualizarCotizacion($pdo);
            break;
        case 'eliminar':
            eliminarCotizacion($pdo);
            break;
        case 'seleccionar_ganador':
            seleccionarGanador($pdo);
            break;
        default:
            echo json_encode(['success' => false, 'message' => 'Acción no válida']);
            break;
    }
} catch (Exception $e) {
    error_log("Error en cotizaciones.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

function listarCotizaciones($pdo) {
    $solicitud_id = $_GET['solicitud_id'] ?? 0;
    
    if (!$solicitud_id) {
        echo json_encode(['success' => false, 'message' => 'ID de solicitud no proporcionado']);
        return;
    }
    
    $query = "
        SELECT c.*, p.nombre as proveedor_nombre, p.ci_rif, p.cuenta_bancaria, p.telefono, p.email
        FROM cotizaciones c
        LEFT JOIN proveedores p ON c.proveedor_id = p.id
        WHERE c.solicitud_id = :solicitud_id
        ORDER BY c.monto_cotizado ASC
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([':solicitud_id' => $solicitud_id]);
    $cotizaciones = $stmt->fetchAll();
    
    echo json_encode(['success' => true, 'cotizaciones' => $cotizaciones]);
}

function crearCotizacion($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $required = ['solicitud_id', 'proveedor_id', 'monto_cotizado', 'fecha_cotizacion'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            echo json_encode(['success' => false, 'message' => "Campo requerido: $field"]);
            return;
        }
    }
    
    // Verificar que la solicitud existe y requiere cotizaciones
    $check = $pdo->prepare("SELECT requiere_cotizaciones FROM solicitudes_compras WHERE id = :id");
    $check->execute([':id' => $input['solicitud_id']]);
    $solicitud = $check->fetch();
    
    if (!$solicitud) {
        echo json_encode(['success' => false, 'message' => 'Solicitud no encontrada']);
        return;
    }
    
    $query = "
        INSERT INTO cotizaciones (
            solicitud_id, proveedor_id, monto_cotizado, fecha_cotizacion, observaciones
        ) VALUES (
            :solicitud_id, :proveedor_id, :monto_cotizado, :fecha_cotizacion, :observaciones
        )
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([
        ':solicitud_id' => $input['solicitud_id'],
        ':proveedor_id' => $input['proveedor_id'],
        ':monto_cotizado' => $input['monto_cotizado'],
        ':fecha_cotizacion' => $input['fecha_cotizacion'],
        ':observaciones' => $input['observaciones'] ?? null
    ]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Cotización agregada exitosamente',
        'id' => $pdo->lastInsertId()
    ]);
}

function actualizarCotizacion($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['id'])) {
        echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
        return;
    }
    
    $query = "
        UPDATE cotizaciones SET
            monto_cotizado = :monto_cotizado,
            fecha_cotizacion = :fecha_cotizacion,
            observaciones = :observaciones
        WHERE id = :id
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([
        ':id' => $input['id'],
        ':monto_cotizado' => $input['monto_cotizado'],
        ':fecha_cotizacion' => $input['fecha_cotizacion'],
        ':observaciones' => $input['observaciones'] ?? null
    ]);
    
    echo json_encode(['success' => true, 'message' => 'Cotización actualizada exitosamente']);
}

function eliminarCotizacion($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? 0;
    
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID no proporcionado']);
        return;
    }
    
    $query = "DELETE FROM cotizaciones WHERE id = :id";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':id' => $id]);
    
    echo json_encode(['success' => true, 'message' => 'Cotización eliminada exitosamente']);
}

function seleccionarGanador($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $cotizacion_id = $input['cotizacion_id'] ?? 0;
    $solicitud_id = $input['solicitud_id'] ?? 0;
    
    if (!$cotizacion_id || !$solicitud_id) {
        echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
        return;
    }
    
    $pdo->beginTransaction();
    
    try {
        // Resetear todos los ganadores de esta solicitud
        $reset = $pdo->prepare("UPDATE cotizaciones SET es_ganador = 0 WHERE solicitud_id = :solicitud_id");
        $reset->execute([':solicitud_id' => $solicitud_id]);
        
        // Marcar la cotización seleccionada como ganadora
        $update = $pdo->prepare("UPDATE cotizaciones SET es_ganador = 1 WHERE id = :id");
        $update->execute([':id' => $cotizacion_id]);
        
        // Obtener la cotización ganadora
        $stmt = $pdo->prepare("SELECT * FROM cotizaciones WHERE id = :id");
        $stmt->execute([':id' => $cotizacion_id]);
        $cotizacion = $stmt->fetch();
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Proveedor seleccionado como ganador',
            'cotizacion' => $cotizacion
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}
?>