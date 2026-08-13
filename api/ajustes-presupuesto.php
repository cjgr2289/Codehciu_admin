<?php
// filepath: /Applications/XAMPP/xamppfiles/htdocs/admin-151225/api/ajustes-presupuesto.php

header('Content-Type: application/json');
session_start();

// Mostrar errores en JSON (solo en desarrollo, quitar después)
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Validar sesión
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado']);
    exit;
}

// Corregir la ruta relativa al archivo database.php
$dbPath = dirname(__FILE__) . DIRECTORY_SEPARATOR . 'database.php';
if (!file_exists($dbPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Archivo de configuración no encontrado: ' . $dbPath]);
    exit;
}

require_once($dbPath);

// Validar que la conexión PDO existe
if (!isset($pdo) || !$pdo) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de conexión a la base de datos']);
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    switch ($action) {
        case 'obtener':
            $proyecto_id = isset($_GET['proyecto_id']) ? (int)$_GET['proyecto_id'] : 0;
            
            if (!$proyecto_id) {
                echo json_encode(['success' => true, 'ajustes' => []]);
                exit;
            }

            $query = "
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
                    p.codigo,
                    p.nombre,
                    u.nombre as usuario_nombre
                FROM ajustes_presupuesto ap
                JOIN partidas p ON ap.partida_id = p.id
                LEFT JOIN usuarios u ON ap.created_by = u.id
                WHERE ap.proyecto_id = ?
                ORDER BY ap.created_at DESC
            ";

            $stmt = $pdo->prepare($query);
            $stmt->execute([$proyecto_id]);
            $ajustes = $stmt->fetchAll();

            echo json_encode([
                'success' => true,
                'ajustes' => $ajustes
            ]);
            break;

        case 'crear':
            $input = file_get_contents('php://input');
            $data = json_decode($input, true);

            if (!$data) {
                throw new Exception('Datos inválidos en la solicitud');
            }

            $proyecto_id = isset($data['proyecto_id']) ? (int)$data['proyecto_id'] : 0;
            $partida_id = isset($data['partida_id']) ? (int)$data['partida_id'] : 0;
            $monto_anterior = isset($data['monto_anterior']) ? (float)$data['monto_anterior'] : 0;
            $monto_nuevo = isset($data['monto_nuevo']) ? (float)$data['monto_nuevo'] : 0;
            $tipo = isset($data['tipo']) ? $data['tipo'] : '';
            $motivo = isset($data['motivo']) ? $data['motivo'] : '';
            $created_by = $_SESSION['user_id'];

            // Validaciones
            if (!$proyecto_id || !$partida_id) {
                throw new Exception('proyecto_id y partida_id son requeridos');
            }

            if (!in_array($tipo, ['Aumento', 'Disminución', 'Reasignación'])) {
                throw new Exception('Tipo de ajuste inválido: ' . $tipo);
            }

            // Verificar que la partida existe y pertenece al proyecto
            $check_query = "SELECT id FROM partidas WHERE id = ? AND proyecto_id = ? LIMIT 1";
            $check_stmt = $pdo->prepare($check_query);
            $check_stmt->execute([$partida_id, $proyecto_id]);
            
            if ($check_stmt->rowCount() === 0) {
                throw new Exception('La partida no existe o no pertenece a este proyecto');
            }

            // Insertar ajuste
            $insert_query = "
                INSERT INTO ajustes_presupuesto 
                (proyecto_id, partida_id, monto_anterior, monto_nuevo, tipo, motivo, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            ";

            $insert_stmt = $pdo->prepare($insert_query);
            $insert_stmt->execute([
                $proyecto_id,
                $partida_id,
                $monto_anterior,
                $monto_nuevo,
                $tipo,
                $motivo,
                $created_by
            ]);

            $ajuste_id = $pdo->lastInsertId();

            echo json_encode([
                'success' => true,
                'id' => $ajuste_id,
                'message' => 'Ajuste creado exitosamente'
            ]);
            break;

        default:
            throw new Exception('Acción no válida: ' . $action);
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error de base de datos: ' . $e->getMessage()
    ]);
}
?>