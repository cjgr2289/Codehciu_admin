<?php
// Desactivar TODOS los errores visibles
error_reporting(0);
ini_set('display_errors', 0);

// Iniciar buffer de salida
ob_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // Incluir configuración de base de datos
    require_once 'database-test.php';
    
    class CuentasBancariasAPI {
        private $pdo;
        private $action;
        
        public function __construct($pdo) {
            $this->pdo = $pdo;
            $this->action = $_GET['action'] ?? '';
        }
        
        public function processRequest() {
            switch ($this->action) {
                case 'listar':
                    $this->listarCuentas();
                    break;
                case 'obtener':
                    $this->obtenerCuenta();
                    break;
                case 'crear':
                    $this->crearCuenta();
                    break;
                case 'actualizar':
                    $this->actualizarCuenta();
                    break;
                case 'desactivar':
                    $this->desactivarCuenta();
                    break;
                default:
                    $this->sendError('Acción no válida', 400);
            }
        }
        
        /**
         * Listar todas las cuentas bancarias activas
         */
        private function listarCuentas() {
            try {
                $query = "SELECT * FROM bancos WHERE activo = 1 ORDER BY nombre ASC";
                $stmt = $this->pdo->prepare($query);
                $stmt->execute();
                $cuentas = $stmt->fetchAll();
                
                $this->sendSuccess([
                    'message' => 'Cuentas obtenidas correctamente',
                    'cuentas' => $cuentas,
                    'total' => count($cuentas)
                ]);
            } catch (Exception $e) {
                $this->sendError('Error al listar cuentas: ' . $e->getMessage(), 500);
            }
        }
        
        /**
         * Obtener una cuenta específica
         */
        private function obtenerCuenta() {
            try {
                $id = $_GET['id'] ?? null;
                
                if (!$id) {
                    $this->sendError('ID de cuenta no especificado', 400);
                    return;
                }
                
                $query = "SELECT * FROM bancos WHERE id = ?";
                $stmt = $this->pdo->prepare($query);
                $stmt->execute([$id]);
                $cuenta = $stmt->fetch();
                
                if (!$cuenta) {
                    $this->sendError('Cuenta no encontrada', 404);
                    return;
                }
                
                $this->sendSuccess([
                    'message' => 'Cuenta obtenida correctamente',
                    'cuenta' => $cuenta
                ]);
            } catch (Exception $e) {
                $this->sendError('Error al obtener cuenta: ' . $e->getMessage(), 500);
            }
        }
        
        /**
         * Crear nueva cuenta bancaria
         */
        private function crearCuenta() {
            try {
                $input = file_get_contents('php://input');
                if (empty($input)) {
                    $this->sendError('No se recibieron datos', 400);
                    return;
                }
                
                $data = json_decode($input, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $this->sendError('JSON inválido: ' . json_last_error_msg(), 400);
                    return;
                }
                
                // Validar campos requeridos
                $required = ['nombre', 'pais', 'numero_cuenta', 'tipo_cuenta', 'representante', 'moneda', 'saldo_inicial'];
                foreach ($required as $field) {
                    if (!isset($data[$field]) || $data[$field] === '') {
                        $this->sendError("El campo '$field' es requerido", 400);
                        return;
                    }
                }
                
                // Validar que el número de cuenta sea único
                $queryCheck = "SELECT id FROM bancos WHERE numero_cuenta = ?";
                $stmtCheck = $this->pdo->prepare($queryCheck);
                $stmtCheck->execute([$data['numero_cuenta']]);
                if ($stmtCheck->fetch()) {
                    $this->sendError('El número de cuenta ya existe', 400);
                    return;
                }
                
                // Validar moneda
                $monedasValidas = ['USD', 'BS', 'EUR'];
                if (!in_array($data['moneda'], $monedasValidas)) {
                    $this->sendError('Moneda no válida. Use: USD, BS, EUR', 400);
                    return;
                }
                
                // Validar saldo inicial
                if (!is_numeric($data['saldo_inicial']) || $data['saldo_inicial'] < 0) {
                    $this->sendError('Saldo inicial debe ser un número no negativo', 400);
                    return;
                }
                
                $saldoInicial = (float) $data['saldo_inicial'];
                
                // Insertar cuenta
                $query = "INSERT INTO bancos 
                         (nombre, pais, numero_cuenta, tipo_cuenta, representante, 
                          email_representante, telefono_representante, moneda, 
                          saldo_inicial, saldo_actual, activo, created_at, updated_at) 
                         VALUES (:nombre, :pais, :numero_cuenta, :tipo_cuenta, :representante, 
                                 :email, :telefono, :moneda, :saldo_inicial, :saldo_actual, 
                                 1, NOW(), NOW())";
                
                $stmt = $this->pdo->prepare($query);
                
                $params = [
                    ':nombre' => $data['nombre'],
                    ':pais' => $data['pais'],
                    ':numero_cuenta' => $data['numero_cuenta'],
                    ':tipo_cuenta' => $data['tipo_cuenta'],
                    ':representante' => $data['representante'],
                    ':email' => $data['email_representante'] ?? null,
                    ':telefono' => $data['telefono_representante'] ?? null,
                    ':moneda' => $data['moneda'],
                    ':saldo_inicial' => $saldoInicial,
                    ':saldo_actual' => $saldoInicial
                ];
                
                if (!$stmt->execute($params)) {
                    throw new Exception("Error al insertar cuenta");
                }
                
                $cuentaId = $this->pdo->lastInsertId();
                
                $this->sendSuccess([
                    'message' => 'Cuenta bancaria creada correctamente',
                    'cuenta_id' => $cuentaId,
                    'datos' => [
                        'nombre' => $data['nombre'],
                        'numero_cuenta' => $data['numero_cuenta'],
                        'saldo_inicial' => $saldoInicial,
                        'moneda' => $data['moneda']
                    ]
                ]);
                
            } catch (Exception $e) {
                $this->sendError('Error al crear cuenta: ' . $e->getMessage(), 500);
            }
        }
        
        /**
         * Actualizar cuenta bancaria
         */
        private function actualizarCuenta() {
            try {
                $input = file_get_contents('php://input');
                if (empty($input)) {
                    $this->sendError('No se recibieron datos', 400);
                    return;
                }
                
                $data = json_decode($input, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $this->sendError('JSON inválido: ' . json_last_error_msg(), 400);
                    return;
                }
                
                if (!isset($data['id'])) {
                    $this->sendError('ID de cuenta no especificado', 400);
                    return;
                }
                
                // Verificar que la cuenta exista
                $queryCheck = "SELECT * FROM bancos WHERE id = ?";
                $stmtCheck = $this->pdo->prepare($queryCheck);
                $stmtCheck->execute([$data['id']]);
                $cuentaActual = $stmtCheck->fetch();
                
                if (!$cuentaActual) {
                    $this->sendError('Cuenta no encontrada', 404);
                    return;
                }
                
                // Validar moneda si se proporciona
                if (isset($data['moneda'])) {
                    $monedasValidas = ['USD', 'BS', 'EUR'];
                    if (!in_array($data['moneda'], $monedasValidas)) {
                        $this->sendError('Moneda no válida. Use: USD, BS, EUR', 400);
                        return;
                    }
                }
                
                // Validar número de cuenta único (si se proporciona y es diferente)
                if (isset($data['numero_cuenta']) && $data['numero_cuenta'] !== $cuentaActual['numero_cuenta']) {
                    $queryCheckDup = "SELECT id FROM bancos WHERE numero_cuenta = ? AND id != ?";
                    $stmtCheckDup = $this->pdo->prepare($queryCheckDup);
                    $stmtCheckDup->execute([$data['numero_cuenta'], $data['id']]);
                    if ($stmtCheckDup->fetch()) {
                        $this->sendError('El número de cuenta ya existe', 400);
                        return;
                    }
                }
                
                // Construir query dinámico
                $updates = [];
                $params = [':id' => $data['id']];
                
                $camposActualizables = ['nombre', 'pais', 'numero_cuenta', 'tipo_cuenta', 
                                       'representante', 'email_representante', 'telefono_representante', 'moneda'];
                
                foreach ($camposActualizables as $campo) {
                    if (isset($data[$campo])) {
                        $updates[] = "$campo = :$campo";
                        $params[":$campo"] = $data[$campo];
                    }
                }
                
                if (empty($updates)) {
                    $this->sendError('No hay campos para actualizar', 400);
                    return;
                }
                
                $updates[] = "updated_at = NOW()";
                
                $query = "UPDATE bancos SET " . implode(', ', $updates) . " WHERE id = :id";
                $stmt = $this->pdo->prepare($query);
                
                if (!$stmt->execute($params)) {
                    throw new Exception("Error al actualizar cuenta");
                }
                
                $this->sendSuccess([
                    'message' => 'Cuenta actualizada correctamente',
                    'cuenta_id' => $data['id']
                ]);
                
            } catch (Exception $e) {
                $this->sendError('Error al actualizar cuenta: ' . $e->getMessage(), 500);
            }
        }
        
        /**
         * Desactivar cuenta bancaria
         */
        private function desactivarCuenta() {
            try {
                $input = file_get_contents('php://input');
                if (empty($input)) {
                    $this->sendError('No se recibieron datos', 400);
                    return;
                }
                
                $data = json_decode($input, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $this->sendError('JSON inválido: ' . json_last_error_msg(), 400);
                    return;
                }
                
                if (!isset($data['id'])) {
                    $this->sendError('ID de cuenta no especificado', 400);
                    return;
                }
                
                // Verificar que la cuenta exista
                $queryCheck = "SELECT * FROM bancos WHERE id = ?";
                $stmtCheck = $this->pdo->prepare($queryCheck);
                $stmtCheck->execute([$data['id']]);
                
                if (!$stmtCheck->fetch()) {
                    $this->sendError('Cuenta no encontrada', 404);
                    return;
                }
                
                // Desactivar cuenta
                $query = "UPDATE bancos SET activo = 0, updated_at = NOW() WHERE id = ?";
                $stmt = $this->pdo->prepare($query);
                
                if (!$stmt->execute([$data['id']])) {
                    throw new Exception("Error al desactivar cuenta");
                }
                
                $this->sendSuccess([
                    'message' => 'Cuenta desactivada correctamente',
                    'cuenta_id' => $data['id']
                ]);
                
            } catch (Exception $e) {
                $this->sendError('Error al desactivar cuenta: ' . $e->getMessage(), 500);
            }
        }
        
        private function sendSuccess($data) {
            $response = array_merge(['success' => true], $data);
            $this->sendResponse(200, $response);
        }
        
        private function sendError($message, $code = 400) {
            $this->sendResponse($code, [
                'success' => false,
                'error' => $message
            ]);
        }
        
        private function sendResponse($statusCode, $data) {
            // Limpiar buffer
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            
            http_response_code($statusCode);
            echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;
        }
    }
    
    // Crear instancia y procesar
    $api = new CuentasBancariasAPI($pdo);
    $api->processRequest();
    
} catch (Exception $e) {
    // Limpiar buffer en caso de error
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error interno del servidor: ' . $e->getMessage()
    ]);
    exit;
}
