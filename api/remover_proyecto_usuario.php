<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/database.php';

// Función para registrar logs
function logError($message, $data = []) {
    $logFile = __DIR__ . '/logs/errores.log';
    if (!file_exists(dirname($logFile))) {
        mkdir(dirname($logFile), 0777, true);
    }
    $logEntry = date('Y-m-d H:i:s') . " - " . $message . " - " . json_encode($data) . PHP_EOL;
    file_put_contents($logFile, $logEntry, FILE_APPEND);
}

try {
    // Obtener datos del cuerpo de la solicitud
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    // Validar JSON
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('JSON inválido: ' . json_last_error_msg());
    }
    
    $usuario_id = isset($data['usuario_id']) ? (int)$data['usuario_id'] : 0;
    $proyecto_id = isset($data['proyecto_id']) ? (int)$data['proyecto_id'] : 0;
    
    // Validar datos
    if (!$usuario_id || $usuario_id <= 0) {
        echo json_encode([
            'success' => false, 
            'message' => 'ID de usuario inválido',
            'code' => 'INVALID_USER_ID'
        ]);
        exit;
    }
    
    if (!$proyecto_id || $proyecto_id <= 0) {
        echo json_encode([
            'success' => false, 
            'message' => 'ID de proyecto inválido',
            'code' => 'INVALID_PROJECT_ID'
        ]);
        exit;
    }
    
    // Establecer conexión a la base de datos
    if (isset($pdo) && $pdo instanceof PDO) {
        $db = $pdo;
    } elseif (class_exists('Database')) {
        $database = new Database();
        $db = $database->getConnection();
    } else {
        throw new Exception('No se pudo establecer conexión con la base de datos');
    }
    
    // Verificar si la asignación existe
    $checkQuery = "SELECT id, activo FROM usuario_proyecto 
                   WHERE usuario_id = :usuario_id AND proyecto_id = :proyecto_id";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->bindParam(':usuario_id', $usuario_id);
    $checkStmt->bindParam(':proyecto_id', $proyecto_id);
    $checkStmt->execute();
    
    $asignacion = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$asignacion) {
        echo json_encode([
            'success' => false, 
            'message' => 'No se encontró la asignación del proyecto',
            'code' => 'ASSIGNMENT_NOT_FOUND'
        ]);
        exit;
    }
    
    if ($asignacion['activo'] == 0) {
        echo json_encode([
            'success' => false, 
            'message' => 'El proyecto ya había sido removido anteriormente',
            'code' => 'ALREADY_REMOVED'
        ]);
        exit;
    }
    
    // Iniciar transacción
    $db->beginTransaction();

    try {
        // Detectar si la columna fecha_remocion existe en la tabla
        $colExists = false;
        try {
            $colCheckStmt = $db->prepare("SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS \
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuario_proyecto' AND COLUMN_NAME = :col");
            $col = 'fecha_remocion';
            $colCheckStmt->bindParam(':col', $col);
            $colCheckStmt->execute();
            $res = $colCheckStmt->fetch(PDO::FETCH_ASSOC);
            if ($res && isset($res['cnt']) && (int)$res['cnt'] > 0) {
                $colExists = true;
            }
        } catch (Exception $e) {
            // Si no es posible consultar INFORMATION_SCHEMA, asumimos que la columna no existe
            $colExists = false;
        }

        // Preparar UPDATE según si la columna existe
        if ($colExists) {
            $query = "UPDATE usuario_proyecto SET activo = 0, fecha_remocion = NOW() WHERE usuario_id = :usuario_id AND proyecto_id = :proyecto_id";
        } else {
            $query = "UPDATE usuario_proyecto SET activo = 0 WHERE usuario_id = :usuario_id AND proyecto_id = :proyecto_id";
        }

        $stmt = $db->prepare($query);
        $stmt->bindParam(':usuario_id', $usuario_id, PDO::PARAM_INT);
        $stmt->bindParam(':proyecto_id', $proyecto_id, PDO::PARAM_INT);

        if ($stmt->execute()) {
            // Opcional: Registrar la acción en una tabla de auditoría si existe
            try {
                $auditQuery = "INSERT INTO auditoria_proyectos (usuario_id, proyecto_id, accion, fecha) VALUES (:usuario_id, :proyecto_id, 'remover', NOW())";
                $auditStmt = $db->prepare($auditQuery);
                $auditStmt->bindParam(':usuario_id', $usuario_id);
                $auditStmt->bindParam(':proyecto_id', $proyecto_id);
                $auditStmt->execute();
            } catch (Exception $e) {
                // No detener la operación si la tabla de auditoría no existe
                logError('Auditoría no registrada: ' . $e->getMessage());
            }

            // Confirmar transacción
            $db->commit();

            $responseData = [
                'usuario_id' => $usuario_id,
                'proyecto_id' => $proyecto_id
            ];
            if ($colExists) $responseData['fecha_remocion'] = date('Y-m-d H:i:s');

            echo json_encode([
                'success' => true,
                'message' => 'Proyecto removido correctamente',
                'data' => $responseData
            ]);
        } else {
            throw new Exception('Error al ejecutar la actualización');
        }
    } catch (Exception $e) {
        // Revertir transacción en caso de error
        $db->rollBack();
        throw $e;
    }
    
} catch (Exception $e) {
    // Log del error
    logError($e->getMessage(), ['input' => $input ?? null, 'trace' => $e->getTraceAsString()]);
    
    echo json_encode([
        'success' => false, 
        'message' => 'Error al remover el proyecto: ' . $e->getMessage(),
        'code' => 'SERVER_ERROR'
    ]);
}
?>