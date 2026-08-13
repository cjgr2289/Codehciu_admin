<?php
header('Content-Type: application/json');
require_once 'database.php';

// Permitir CORS (solo para desarrollo)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
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

// Verificar que el usuario sea administrador
if ($_SESSION['user_role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Se requiere rol de administrador.']);
    exit();
}

try {
    
    // Obtener todos los usuarios (con proyectos activos asignados)
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && !isset($_GET['id'])) {
        $stmt = $pdo->prepare("
            SELECT u.id, u.nombre, u.email, u.telefono, u.cedula, u.rol, u.Activo, u.cargo, u.departamento,
                u.fecha_vencimiento, u.debe_cambiar_password, u.fecha_creacion,
                (
                    SELECT GROUP_CONCAT(p.nombre SEPARATOR ', ')
                    FROM usuario_proyecto up
                    INNER JOIN proyectos p ON up.proyecto_id = p.id
                    WHERE up.usuario_id = u.id
                        AND up.activo = 1
                        AND p.estado = 'Activo'   -- Ajusta según tu columna de estado (p.activo = 1 si usas booleano)
                ) AS proyectos_asignados
            FROM usuarios u
            ORDER BY u.nombre ASC
        ");
        $stmt->execute();
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $users
        ]);
        exit();
    }

    // Obtener un usuario específico por ID
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['id'])) {
        $userId = intval($_GET['id']);

        $stmt = $pdo->prepare("
            SELECT id, nombre, email, telefono, cedula, rol, Activo, cargo, departamento,
                   fecha_vencimiento, TipoSangre, Alergias, Medicinas, debe_cambiar_password,
                   foto, fecha_creacion
            FROM usuarios
            WHERE id = ?
        ");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            if (!empty($user['foto'])) {
                $user['foto_base64'] = 'data:image/jpeg;base64,' . base64_encode($user['foto']);
            }
            unset($user['foto']);

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

    // Crear o actualizar usuario
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $isEdit = isset($_POST['id']);
        $userId = $isEdit ? intval($_POST['id']) : null;

        // Validar campos requeridos
        $requiredFields = ['nombre', 'email', 'telefono', 'fecha_vencimiento', 'rol', 'cargo', 'departamento', 'cedula'];
        foreach ($requiredFields as $field) {
            if (empty($_POST[$field])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => "El campo $field es requerido"]);
                exit();
            }
        }

        // Validar rol válido
        // Roles permitidos: admin, editor, contab, regular, coord, directivo, socio
        $rolesPermitidos = ['regular', 'editor', 'contab', 'admin', 'coord', 'directivo', 'socio'];
        $rolRecibido = $_POST['rol'];
        if (!in_array($rolRecibido, $rolesPermitidos)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Rol no válido: ' . $rolRecibido]);
            exit();
        }

        // Validar email único
        $email = $_POST['email'];
        $checkEmailStmt = $pdo->prepare("SELECT id FROM usuarios WHERE email = ? AND id != ?");
        $checkEmailStmt->execute([$email, $userId ?: 0]);
        if ($checkEmailStmt->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'El email ya está registrado']);
            exit();
        }

        // Validar cédula única
        $cedula = $_POST['cedula'];
        $checkCedulaStmt = $pdo->prepare("SELECT id FROM usuarios WHERE cedula = ? AND id != ?");
        $checkCedulaStmt->execute([$cedula, $userId ?: 0]);
        if ($checkCedulaStmt->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'La cédula ya está registrada']);
            exit();
        }

        if ($isEdit) {
            // Actualizar usuario existente
            $sql = "UPDATE usuarios SET 
                    nombre = ?, email = ?, telefono = ?, fecha_vencimiento = ?, 
                    rol = ?, cargo = ?, departamento = ?, cedula = ?, TipoSangre = ?, 
                    alergias = ?, medicinas = ?, Activo = ?, debe_cambiar_password = ?";
            
            $activo = isset($_POST['Activo']) && filter_var($_POST['Activo'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
            
            if (isset($_POST['debe_cambiar_password'])) {
                $debeCambiar = filter_var($_POST['debe_cambiar_password'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
            } elseif (isset($_POST['cambiar_password'])) {
                $debeCambiar = filter_var($_POST['cambiar_password'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
            } else {
                $debeCambiar = 0;
            }
            
            $params = [
                $_POST['nombre'], $_POST['email'], $_POST['telefono'], $_POST['fecha_vencimiento'],
                $_POST['rol'], $_POST['cargo'], $_POST['departamento'], $_POST['cedula'],
                $_POST['TipoSangre'] ?? '', $_POST['alergias'] ?? '', $_POST['medicinas'] ?? '',
                $activo, $debeCambiar
            ];
            
            if (!empty($_POST['password'])) {
                $sql .= ", password = ?";
                $params[] = password_hash($_POST['password'], PASSWORD_DEFAULT);
            }
            
            if (isset($_FILES['foto']) && $_FILES['foto']['error'] === UPLOAD_ERR_OK) {
                $fotoData = file_get_contents($_FILES['foto']['tmp_name']);
                $sql .= ", foto = ?";
                $params[] = $fotoData;
            }
            
            $sql .= " WHERE id = ?";
            $params[] = $userId;
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            echo json_encode(['success' => true, 'message' => 'Usuario actualizado correctamente']);
        } else {
            // Crear nuevo usuario
            if (empty($_POST['password'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'La contraseña es requerida para nuevos usuarios']);
                exit();
            }
            
            $fotoData = null;
            if (isset($_FILES['foto']) && $_FILES['foto']['error'] === UPLOAD_ERR_OK) {
                $fotoData = file_get_contents($_FILES['foto']['tmp_name']);
            }
            
            $activo_new = (isset($_POST['Activo']) && filter_var($_POST['Activo'], FILTER_VALIDATE_BOOLEAN)) ? 1 : 0;
            $debe_new = (isset($_POST['debe_cambiar_password']) && filter_var($_POST['debe_cambiar_password'], FILTER_VALIDATE_BOOLEAN)) ? 1 : 0;

            $sql = "INSERT INTO usuarios 
                    (nombre, email, password, telefono, fecha_vencimiento, rol, cargo, departamento, 
                     cedula, tipoSangre, alergias, medicinas, Activo, debe_cambiar_password, foto, fecha_creacion) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $_POST['nombre'], $_POST['email'], password_hash($_POST['password'], PASSWORD_DEFAULT),
                $_POST['telefono'], $_POST['fecha_vencimiento'], $_POST['rol'], $_POST['cargo'],
                $_POST['departamento'], $_POST['cedula'], $_POST['TipoSangre'] ?? '',
                $_POST['alergias'] ?? '', $_POST['medicinas'] ?? '', 
                $activo_new, $debe_new,
                $fotoData
            ]);
            
            echo json_encode(['success' => true, 'message' => 'Usuario creado correctamente']);
        }
        exit();
    }

    // Eliminar usuario
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $userId = isset($_GET['id']) ? intval($_GET['id']) : null;

        if (!$userId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de usuario requerido']);
            exit();
        }

        if ($userId == $_SESSION['user_id']) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No puedes eliminar tu propio usuario']);
            exit();
        }

        $stmt = $pdo->prepare("DELETE FROM usuarios WHERE id = ?");
        $stmt->execute([$userId]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Usuario eliminado correctamente']);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Usuario no encontrado']);
        }
        exit();
    }

    // Cambiar contraseña
    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['action']) || $input['action'] !== 'change_password') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Acción no válida']);
            exit();
        }

        $userId = isset($input['user_id']) ? intval($input['user_id']) : null;
        $newPassword = $input['new_password'] ?? '';

        if (!$userId || empty($newPassword)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos incompletos']);
            exit();
        }

        if ($_SESSION['user_role'] !== 'admin' && $_SESSION['user_id'] != $userId) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'No tienes permisos para cambiar esta contraseña']);
            exit();
        }

        if (strlen($newPassword) < 8) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'La contraseña debe tener al menos 8 caracteres']);
            exit();
        }

        if ($_SESSION['user_role'] !== 'admin' || $_SESSION['user_id'] == $userId) {
            $currentPassword = $input['current_password'] ?? '';

            $stmt = $pdo->prepare("SELECT password FROM usuarios WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user || !password_verify($currentPassword, $user['password'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Contraseña actual incorrecta']);
                exit();
            }
        }

        $stmt = $pdo->prepare("UPDATE usuarios SET password = ?, debe_cambiar_password = 0 WHERE id = ?");
        $stmt->execute([password_hash($newPassword, PASSWORD_DEFAULT), $userId]);

        echo json_encode(['success' => true, 'message' => 'Contraseña cambiada correctamente']);
        exit();
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);

} catch (PDOException $e) {
    error_log("Error en usuarios.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error en el servidor: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log("Error general en usuarios.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error: ' . $e->getMessage()]);
}
?>