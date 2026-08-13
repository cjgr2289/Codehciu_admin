<?php
header('Content-Type: application/json');
require_once 'database.php';

// Permitir CORS (solo para desarrollo)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();

// Verificar autenticación
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado. Por favor, inicie sesión.']);
    exit();
}

try {
    // Obtener datos del usuario actual o por ID (solo admin puede ver otros usuarios)
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $requestedUserId = isset($_GET['id']) ? intval($_GET['id']) : $_SESSION['user_id'];
        
        // Si no es admin, solo puede ver sus propios datos
        if ($_SESSION['user_role'] !== 'admin' && $requestedUserId != $_SESSION['user_id']) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'No tienes permisos para ver estos datos']);
            exit();
        }
        
        $stmt = $pdo->prepare("
            SELECT id, nombre, email, telefono, cedula, rol, cargo, departamento, 
                   fecha_vencimiento, TipoSangre, Alergias, Medicinas, foto
            FROM usuarios 
            WHERE id = ?
        ");
        $stmt->execute([$requestedUserId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user) {
            // Convertir la foto blob a base64 si existe
            if (!empty($user['foto'])) {
                $user['foto_base64'] = 'data:image/jpeg;base64,' . base64_encode($user['foto']);
            }
            unset($user['foto']); // No enviar el blob directamente
            
            echo json_encode([
                'success' => true,
                'data' => $user
            ]);
        } else {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Usuario no encontrado'
            ]);
        }
        exit();
    }

    // Método no soportado
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    
} catch (PDOException $e) {
    error_log("Error en user-data.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error en el servidor: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log("Error general en user-data.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error: ' . $e->getMessage()]);
}
?>