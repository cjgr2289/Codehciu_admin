<?php
// Desactivar TODOS los errores visibles
error_reporting(0);
ini_set('display_errors', 0);

// Iniciar buffer de salida
ob_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // Incluir configuración de base de datos
    require_once 'database-test.php';
    
    class AbonosProyectoAPI {
        private $pdo;
        private $action;
        
        public function __construct($pdo) {
            $this->pdo = $pdo;
            $this->action = $_GET['action'] ?? '';
        }
        
        public function processRequest() {
            switch ($this->action) {
                case 'crear':
                    $this->crearAbono();
                    break;
                case 'listar':
                    $this->listarAbonos();
                    break;
                default:
                    $this->sendError('Acción no válida. Use: crear o listar', 400);
            }
        }

        /**
         * Crear abono de proyecto
         * Afecta: tabla transacciones + saldo_actual en bancos
         */
        private function crearAbono() {
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
                $required = ['proyecto_id', 'banco_id', 'monto', 'concepto', 'fecha_transaccion'];
                foreach ($required as $field) {
                    if (!isset($data[$field]) || $data[$field] === '') {
                        $this->sendError("El campo '$field' es requerido", 400);
                        return;
                    }
                }

                // Validar monto
                if (!is_numeric($data['monto']) || $data['monto'] <= 0) {
                    $this->sendError('El monto debe ser un número positivo', 400);
                    return;
                }

                // Validar que el proyecto existe
                $stmtProyecto = $this->pdo->prepare("SELECT id, nombre FROM proyectos WHERE id = ?");
                $stmtProyecto->execute([$data['proyecto_id']]);
                $proyecto = $stmtProyecto->fetch();

                if (!$proyecto) {
                    $this->sendError('Proyecto no encontrado', 404);
                    return;
                }

                // Obtener información de la cuenta bancaria
                $stmtBanco = $this->pdo->prepare("SELECT * FROM bancos WHERE id = ? AND activo = 1");
                $stmtBanco->execute([$data['banco_id']]);
                $banco = $stmtBanco->fetch();

                if (!$banco) {
                    $this->sendError('Cuenta bancaria no encontrada o inactiva', 404);
                    return;
                }

                // Calcular montos
                $montoOriginal = (float) $data['monto'];
                $monedaOriginal = $data['moneda'] ?? 'USD';
                $tasaCambio = isset($data['tasa_cambio']) && $data['tasa_cambio'] !== '' ? 
                              (float) $data['tasa_cambio'] : 1.0;

                // Si no hay tasa de cambio para moneda diferente a USD, usar valores por defecto
                if ($monedaOriginal !== 'USD' && (!$tasaCambio || $tasaCambio <= 0)) {
                    if ($monedaOriginal === 'BS') {
                        $tasaCambio = 36.50;
                    } elseif ($monedaOriginal === 'EUR') {
                        $tasaCambio = 0.92;
                    }
                }

                // Calcular monto en USD
                $montoUSD = $this->calcularMontoUSD($montoOriginal, $monedaOriginal, $tasaCambio);

                // Calcular monto en moneda de la cuenta
                $montoEnMonedaCuenta = $this->calcularMontoMonedaCuenta(
                    $montoOriginal, 
                    $monedaOriginal, 
                    $banco['moneda'], 
                    $tasaCambio
                );

                // Obtener usuario ID
                $usuario_id = $this->getUsuarioId();

                // Iniciar transacción
                $this->pdo->beginTransaction();

                try {
                    // 1. Insertar registro en transacciones como INGRESO
                    $query = "INSERT INTO transacciones 
                             (proyecto_id, banco_id, tipo, monto, moneda, tasa_cambio, 
                              concepto, numero_documento, beneficiario, fecha_transaccion, 
                              descripcion, status, metodo_pago, created_by, created_at) 
                             VALUES (:proyecto_id, :banco_id, 'Ingreso', :monto, :moneda, :tasa, 
                                     :concepto, :referencia, :beneficiario, :fecha, 
                                     :descripcion, 'Completado', 'Transferencia', :usuario_id, NOW())";

                    $stmt = $this->pdo->prepare($query);

                    $params = [
                        ':proyecto_id' => $data['proyecto_id'],
                        ':banco_id' => $data['banco_id'],
                        ':monto' => $montoOriginal,
                        ':moneda' => $monedaOriginal,
                        ':tasa' => $tasaCambio,
                        ':concepto' => $data['concepto'],
                        ':referencia' => $data['numero_documento'] ?? null,
                        ':beneficiario' => $data['beneficiario'] ?? null,
                        ':fecha' => $data['fecha_transaccion'],
                        ':descripcion' => $data['descripcion'] ?? null,
                        ':usuario_id' => $usuario_id
                    ];

                    if (!$stmt->execute($params)) {
                        throw new Exception("Error al registrar transacción");
                    }

                    $transaccionId = $this->pdo->lastInsertId();

                    // 2. Actualizar saldo de la cuenta bancaria (SUMA)
                    $nuevoSaldo = (float) $banco['saldo_actual'] + $montoEnMonedaCuenta;

                    $queryUpdate = "UPDATE bancos SET saldo_actual = :saldo, updated_at = NOW() WHERE id = :id";
                    $stmtUpdate = $this->pdo->prepare($queryUpdate);
                    $stmtUpdate->execute([
                        ':saldo' => $nuevoSaldo,
                        ':id' => $data['banco_id']
                    ]);

                    // Confirmar transacción
                    $this->pdo->commit();

                    $this->sendSuccess([
                        'message' => 'Abono registrado correctamente',
                        'transaccion_id' => $transaccionId,
                        'datos' => [
                            'proyecto' => $proyecto['nombre'],
                            'cuenta_bancaria' => $banco['nombre'] . ' - ' . $banco['numero_cuenta'],
                            'monto_original' => $montoOriginal,
                            'moneda_original' => $monedaOriginal,
                            'monto_usd' => $montoUSD,
                            'tasa_cambio' => $tasaCambio,
                            'saldo_anterior' => $banco['saldo_actual'],
                            'saldo_nuevo' => $nuevoSaldo,
                            'moneda_cuenta' => $banco['moneda']
                        ]
                    ]);

                } catch (Exception $e) {
                    $this->pdo->rollBack();
                    throw $e;
                }

            } catch (Exception $e) {
                $this->sendError('Error en el servidor: ' . $e->getMessage(), 500);
            }
        }

        /**
         * Listar abonos de un proyecto
         */
        private function listarAbonos() {
            try {
                $proyecto_id = $_GET['proyecto_id'] ?? null;
                $limite = $_GET['limit'] ?? 50;

                if (!$proyecto_id) {
                    $this->sendError('proyecto_id es requerido', 400);
                    return;
                }

                $query = "SELECT t.*, b.nombre as banco_nombre, b.numero_cuenta, p.nombre as proyecto_nombre
                         FROM transacciones t
                         JOIN bancos b ON t.banco_id = b.id
                         JOIN proyectos p ON t.proyecto_id = p.id
                         WHERE t.proyecto_id = ? AND t.tipo = 'Ingreso'
                         ORDER BY t.fecha_transaccion DESC, t.id DESC
                         LIMIT ?";

                $stmt = $this->pdo->prepare($query);
                $stmt->execute([$proyecto_id, (int)$limite]);
                $abonos = $stmt->fetchAll();

                $this->sendSuccess([
                    'message' => 'Abonos obtenidos correctamente',
                    'abonos' => $abonos,
                    'total' => count($abonos)
                ]);

            } catch (Exception $e) {
                $this->sendError('Error al listar abonos: ' . $e->getMessage(), 500);
            }
        }

        private function calcularMontoUSD($monto, $moneda, $tasaCambio) {
            switch (strtoupper($moneda)) {
                case 'USD':
                    return $monto;
                case 'BS':
                    return $tasaCambio > 0 ? $monto / $tasaCambio : $monto;
                case 'EUR':
                    return $tasaCambio > 0 ? $monto * $tasaCambio : $monto;
                default:
                    return $monto;
            }
        }

        private function calcularMontoMonedaCuenta($monto, $monedaOriginal, $monedaCuenta, $tasaCambio) {
            // Si son la misma moneda, no hay conversión
            if (strtoupper($monedaOriginal) === strtoupper($monedaCuenta)) {
                return $monto;
            }

            // Convertir a USD primero
            $montoUSD = $this->calcularMontoUSD($monto, $monedaOriginal, $tasaCambio);

            // Convertir de USD a moneda de cuenta
            switch (strtoupper($monedaCuenta)) {
                case 'USD':
                    return $montoUSD;
                case 'BS':
                    return $montoUSD * $tasaCambio;
                case 'EUR':
                    return $tasaCambio > 0 ? $montoUSD / $tasaCambio : $montoUSD;
                default:
                    return $montoUSD;
            }
        }

        private function getUsuarioId() {
            // Para desarrollo, usar ID 1 (admin)
            // En producción, obtener de la sesión
            return 1;
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
    $api = new AbonosProyectoAPI($pdo);
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
