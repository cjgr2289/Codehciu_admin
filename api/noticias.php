<?php
header('Content-Type: application/json');

// Configuración robusta de CORS - universal para localhost y hosting
$allowed_origins = [
    'http://localhost',
    'https://localhost',
    'http://127.0.0.1',
    'https://127.0.0.1',
    'https://codehciu.org',
    'http://codehciu.org'
];

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: *");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
// Incluir configuración de la base de datos

require_once 'database.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];

    // Permitir GET sin autenticación; para otros métodos requiere sesión
    $userId = null;
    if ($method !== 'GET') {
        session_start();
        if (!isset($_SESSION['user_id'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'No autorizado']);
            exit();
        }
        $userId = $_SESSION['user_id'];
    }

    // Obtener una noticia específica
    if ($method === 'GET' && isset($_GET['id'])) {
        $noticiaId = intval($_GET['id']);
        
        if ($noticiaId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de noticia inválido']);
            exit();
        }
        
        $stmt = $pdo->prepare("SELECT id, titulo, imagen_url, fecha, resumen, contenido, usuario_id, fecha_creacion FROM noticias WHERE id = ?");
        $stmt->execute([$noticiaId]);
        $noticia = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($noticia) {
            // Si hay imagen en blob, convertir a base64 para la respuesta
            if (!empty($noticia['imagen_url'])) {
                $noticia['imagen_base64'] = base64_encode($noticia['imagen_url']);
                unset($noticia['imagen_url']); // Limpiar el blob original
            }
            
            echo json_encode([
                'success' => true,
                'data' => $noticia
            ]);
        } else {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Noticia no encontrada'
            ]);
        }
        exit();
    }

    // Obtener todas las noticias
    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT id, titulo, imagen_url, fecha, resumen, contenido, usuario_id, fecha_creacion FROM noticias ORDER BY fecha DESC");
        $stmt->execute();
        $noticias = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Convertir blobs de imagen a base64 cuando existan
        foreach ($noticias as &$n) {
            if (!empty($n['imagen_url'])) {
                $n['imagen_base64'] = base64_encode($n['imagen_url']);
                unset($n['imagen_url']); // Limpiar el blob original
            }
        }
        unset($n);
        
        echo json_encode([
            'success' => true,
            'data' => $noticias
        ]);
        exit();
    }

    // Crear o actualizar noticia
    if ($method === 'POST') {
        // Verificar que es multipart/form-data para la imagen
        if (empty($_POST['titulo']) || empty($_POST['fecha']) || empty($_POST['resumen']) || empty($_POST['contenido'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Todos los campos son requeridos']);
            exit();
        }
        
        $isEdit = isset($_POST['id']) && !empty($_POST['id']);
        $noticiaId = $isEdit ? intval($_POST['id']) : null;
        
        // Manejar la imagen
        $imagenData = null;
        
        if (isset($_FILES['imagen']) && $_FILES['imagen']['error'] === UPLOAD_ERR_OK) {
            // Validar tipo de archivo
            $allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
            $fileType = $_FILES['imagen']['type'];
            
            if (!in_array($fileType, $allowedTypes)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Solo se permiten imágenes JPG, PNG o GIF']);
                exit();
            }
            
            // Validar tamaño (2MB máximo)
            if ($_FILES['imagen']['size'] > 2 * 1024 * 1024) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'La imagen no puede superar los 2MB']);
                exit();
            }
            
            // Leer el archivo y guardarlo como blob
            $imagenData = file_get_contents($_FILES['imagen']['tmp_name']);
            if ($imagenData === false) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Error al leer la imagen']);
                exit();
            }
        }
        
        if ($isEdit) {
            // Actualizar noticia existente
            if ($imagenData) {
                // Actualizar con nueva imagen
                $sql = "UPDATE noticias SET titulo = ?, imagen_url = ?, fecha = ?, resumen = ?, contenido = ?, usuario_id = ?, fecha_actualizacion = NOW() WHERE id = ?";
                $params = [$_POST['titulo'], $imagenData, $_POST['fecha'], $_POST['resumen'], $_POST['contenido'], $userId, $noticiaId];
            } else {
                // Mantener imagen existente
                $sql = "UPDATE noticias SET titulo = ?, fecha = ?, resumen = ?, contenido = ?, usuario_id = ?, fecha_actualizacion = NOW() WHERE id = ?";
                $params = [$_POST['titulo'], $_POST['fecha'], $_POST['resumen'], $_POST['contenido'], $userId, $noticiaId];
            }
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            echo json_encode([
                'success' => true, 
                'message' => 'Noticia actualizada correctamente',
                'id' => $noticiaId
            ]);
            
        } else {
            // Crear nueva noticia
            if (!$imagenData) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'La imagen es requerida para nuevas noticias']);
                exit();
            }
            
            $sql = "INSERT INTO noticias (titulo, imagen_url, fecha, resumen, contenido, usuario_id, fecha_creacion, fecha_actualizacion) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$_POST['titulo'], $imagenData, $_POST['fecha'], $_POST['resumen'], $_POST['contenido'], $userId]);
            
            $newId = $pdo->lastInsertId();
            
            echo json_encode([
                'success' => true, 
                'message' => 'Noticia creada correctamente',
                'id' => $newId
            ]);
        }
        exit();
    }

    // Eliminar noticia
    if ($method === 'DELETE') {
        parse_str(file_get_contents('php://input'), $_DELETE);
        $noticiaId = isset($_DELETE['id']) ? intval($_DELETE['id']) : (isset($_GET['id']) ? intval($_GET['id']) : null);
        
        if (!$noticiaId || $noticiaId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de noticia requerido']);
            exit();
        }
        
        $stmt = $pdo->prepare("DELETE FROM noticias WHERE id = ?");
        $stmt->execute([$noticiaId]);
        
        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Noticia eliminada correctamente']);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Noticia no encontrada']);
        }
        exit();
    }

    // Método no soportado
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    
} catch (PDOException $e) {
    error_log("Error en noticias.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log("Error general en noticias.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor: ' . $e->getMessage()]);
}
?>