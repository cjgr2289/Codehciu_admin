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
    // require_once '../config/database.php';
    require_once 'database-test.php';  
    // Usar la conexión PDO que ya está definida en database.php
    // $pdo ya debería estar definido
    
    class TransaccionesBancoAPI {
        private $pdo;
        private $action;
        
        public function __construct($pdo) {
            $this->pdo = $pdo;
            $this->action = $_GET['action'] ?? '';
        }
        
        public function processRequest() {
            switch ($this->action) {
                case 'crear':
                    $this->crearTransaccion();
                    break;
                case 'listar':
                    $this->listarTransacciones();
                    break;
                default:
                    $this->sendError('Acción no válida. Use: crear o listar', 400);
            }
        }

        /**
         * Crear transacción (ingreso, egreso o transferencia)
         */
        private function crearTransaccion() {
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
                
                // Validar tipo de transacción
                $tipo = $data['tipo'] ?? null;
                if (!in_array($tipo, ['ingreso', 'egreso', 'transferencia'])) {
                    $this->sendError('Tipo de transacción no válido', 400);
                    return;
                }
                
                // Ejecutar según tipo
                if ($tipo === 'ingreso') {
                    $this->registrarIngreso($data);
                } elseif ($tipo === 'egreso') {
                    $this->registrarEgreso($data);
                } else {
                    $this->registrarTransferencia($data);
                }
                
            } catch (Exception $e) {
                $this->sendError('Error: ' . $e->getMessage(), 500);
            }
        }

        /**
         * Listar transacciones
         */
        private function listarTransacciones() {
            try {
                $limite = $_GET['limit'] ?? 100;
                
                $query = "SELECT tb.*, b.nombre as nombre_banco, b.numero_cuenta 
                         FROM transacciones_banco tb 
                         JOIN bancos b ON tb.cuenta_bancaria_id = b.id 
                         ORDER BY tb.fecha_transaccion DESC, tb.fecha_registro DESC 
                         LIMIT ?";
                
                $stmt = $this->pdo->prepare($query);
                $stmt->execute([(int)$limite]);
                $transacciones = $stmt->fetchAll();
                
                $this->sendSuccess([
                    'message' => 'Transacciones obtenidas correctamente',
                    'transacciones' => $transacciones,
                    'total' => count($transacciones)
                ]);
            } catch (Exception $e) {
                $this->sendError('Error al listar transacciones: ' . $e->getMessage(), 500);
            }
        }
        
        private function registrarIngreso($data) {
            try {
                // Normalizar nombre de campo - aceptar tanto cuenta_origen_id como cuenta_bancaria_id
                $cuentaId = $data['cuenta_origen_id'] ?? $data['cuenta_bancaria_id'] ?? null;
                
                // Validar campos requeridos
                if (!$cuentaId) {
                    $this->sendError('El campo cuenta_origen_id es requerido', 400);
                    return;
                }
                
                $required = ['monto', 'concepto', 'titular', 'fecha_transaccion'];
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
                
                // Obtener información de la cuenta
                $cuenta = $this->obtenerCuentaBancaria($cuentaId);
                if (!$cuenta) {
                    $this->sendError('Cuenta bancaria no encontrada', 404);
                    return;
                }
                
                // Validar que la cuenta esté activa
                if (!$cuenta['activo']) {
                    $this->sendError('La cuenta bancaria está inactiva', 400);
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
                    $cuenta['moneda'], 
                    $tasaCambio
                );
                
                // Obtener usuario ID (para desarrollo, usar 1)
                $usuario_id = $this->getUsuarioId();
                
                // Iniciar transacción
                $this->pdo->beginTransaction();
                
                try {
                    // 1. Insertar registro en transacciones_banco
                    $query = "INSERT INTO transacciones_banco 
                             (tipo, cuenta_bancaria_id, monto, moneda, tasa_cambio, monto_dolares, 
                              concepto, referencia, titular, documento_identidad, fecha_transaccion, 
                              descripcion, usuario_id) 
                             VALUES ('ingreso', :cuenta_id, :monto, :moneda, :tasa, :monto_usd, 
                                     :concepto, :referencia, :titular, :documento, :fecha, 
                                     :descripcion, :usuario_id)";
                    
                    $stmt = $this->pdo->prepare($query);
                    
                    $params = [
                        ':cuenta_id' => $cuentaId,
                        ':monto' => $montoOriginal,
                        ':moneda' => $monedaOriginal,
                        ':tasa' => $tasaCambio,
                        ':monto_usd' => $montoUSD,
                        ':concepto' => $data['concepto'],
                        ':referencia' => $data['referencia'] ?? null,
                        ':titular' => $data['titular'],
                        ':documento' => $data['documento_identidad'] ?? null,
                        ':fecha' => $data['fecha_transaccion'],
                        ':descripcion' => $data['descripcion'] ?? null,
                        ':usuario_id' => $usuario_id
                    ];
                    
                    if (!$stmt->execute($params)) {
                        throw new Exception("Error al registrar transacción");
                    }
                    
                    $transaccionId = $this->pdo->lastInsertId();
                    
                    // 2. Actualizar saldo de la cuenta bancaria
                    $nuevoSaldo = (float) $cuenta['saldo_actual'] + $montoEnMonedaCuenta;
                    
                    $queryUpdate = "UPDATE bancos SET saldo_actual = :saldo, updated_at = NOW() WHERE id = :id";
                    $stmtUpdate = $this->pdo->prepare($queryUpdate);
                    $stmtUpdate->execute([
                        ':saldo' => $nuevoSaldo,
                        ':id' => $cuentaId
                    ]);
                    
                    // Confirmar transacción
                    $this->pdo->commit();
                    
                    $this->sendSuccess([
                        'message' => 'Ingreso registrado correctamente',
                        'transaccion_id' => $transaccionId,
                        'datos' => [
                            'cuenta_bancaria' => $cuenta['nombre'] . ' - ' . $cuenta['numero_cuenta'],
                            'monto_original' => $montoOriginal,
                            'moneda_original' => $monedaOriginal,
                            'monto_usd' => $montoUSD,
                            'tasa_cambio' => $tasaCambio,
                            'saldo_anterior' => $cuenta['saldo_actual'],
                            'saldo_nuevo' => $nuevoSaldo,
                            'moneda_cuenta' => $cuenta['moneda']
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
        
        private function registrarEgreso($data) {
            try {
                // Normalizar nombre de campo
                $cuentaId = $data['cuenta_origen_id'] ?? $data['cuenta_bancaria_id'] ?? null;
                
                if (!$cuentaId) {
                    $this->sendError('El campo cuenta_origen_id es requerido', 400);
                    return;
                }
                
                $required = ['monto', 'concepto', 'titular', 'fecha_transaccion'];
                foreach ($required as $field) {
                    if (empty($data[$field])) {
                        $this->sendError("El campo '$field' es requerido", 400);
                        return;
                    }
                }
                
                if (!is_numeric($data['monto']) || $data['monto'] <= 0) {
                    $this->sendError('El monto debe ser un número positivo', 400);
                    return;
                }
                
                $usuario_id = $this->getUsuarioId();
                
                // Obtener información de la cuenta
                $cuenta = $this->obtenerCuentaBancaria($cuentaId);
                if (!$cuenta) {
                    $this->sendError('Cuenta bancaria no encontrada', 404);
                    return;
                }
                
                if (!$cuenta['activo']) {
                    $this->sendError('La cuenta bancaria está inactiva', 400);
                    return;
                }
                
                // Calcular montos
                $montoOriginal = (float) $data['monto'];
                $monedaOriginal = $data['moneda'] ?? 'USD';
                $tasaCambio = isset($data['tasa_cambio']) && $data['tasa_cambio'] !== '' ? 
                              (float) $data['tasa_cambio'] : 1.0;
                
                if ($monedaOriginal !== 'USD' && (!$tasaCambio || $tasaCambio <= 0)) {
                    if ($monedaOriginal === 'BS') {
                        $tasaCambio = 36.50;
                    } elseif ($monedaOriginal === 'EUR') {
                        $tasaCambio = 0.92;
                    }
                }
                
                // Calcular monto en moneda de la cuenta
                $montoEnMonedaCuenta = $this->calcularMontoMonedaCuenta(
                    $montoOriginal, 
                    $monedaOriginal, 
                    $cuenta['moneda'], 
                    $tasaCambio
                );
                
                // Calcular monto en USD
                $montoUSD = $this->calcularMontoUSD($montoOriginal, $monedaOriginal, $tasaCambio);
                
                // Validar saldo suficiente
                if ($montoEnMonedaCuenta > (float) $cuenta['saldo_actual']) {
                    $this->sendError('Saldo insuficiente en la cuenta', 400);
                    return;
                }
                
                $this->pdo->beginTransaction();
                
                try {
                    // Insertar transacción
                    $query = "INSERT INTO transacciones_banco 
                             (tipo, cuenta_bancaria_id, monto, moneda, tasa_cambio, monto_dolares, 
                              concepto, referencia, titular, documento_identidad, fecha_transaccion, 
                              descripcion, usuario_id) 
                             VALUES ('egreso', :cuenta_id, :monto, :moneda, :tasa, :monto_usd, 
                                     :concepto, :referencia, :titular, :documento, :fecha, 
                                     :descripcion, :usuario_id)";
                    
                    $stmt = $this->pdo->prepare($query);
                    
                    $params = [
                        ':cuenta_id' => $cuentaId,
                        ':monto' => $montoOriginal,
                        ':moneda' => $monedaOriginal,
                        ':tasa' => $tasaCambio,
                        ':monto_usd' => $montoUSD,
                        ':concepto' => $data['concepto'],
                        ':referencia' => $data['referencia'] ?? null,
                        ':titular' => $data['titular'],
                        ':documento' => $data['documento_identidad'] ?? null,
                        ':fecha' => $data['fecha_transaccion'],
                        ':descripcion' => $data['descripcion'] ?? null,
                        ':usuario_id' => $usuario_id
                    ];
                    
                    if (!$stmt->execute($params)) {
                        throw new Exception("Error al registrar transacción");
                    }
                    
                    $transaccionId = $this->pdo->lastInsertId();
                    
                    // Actualizar saldo
                    $nuevoSaldo = (float) $cuenta['saldo_actual'] - $montoEnMonedaCuenta;
                    
                    $queryUpdate = "UPDATE bancos SET saldo_actual = :saldo, updated_at = NOW() WHERE id = :id";
                    $stmtUpdate = $this->pdo->prepare($queryUpdate);
                    $stmtUpdate->execute([
                        ':saldo' => $nuevoSaldo,
                        ':id' => $cuentaId
                    ]);
                    
                    $this->pdo->commit();
                    
                    $this->sendSuccess([
                        'message' => 'Egreso registrado correctamente',
                        'transaccion_id' => $transaccionId,
                        'datos' => [
                            'cuenta_bancaria' => $cuenta['nombre'] . ' - ' . $cuenta['numero_cuenta'],
                            'monto_original' => $montoOriginal,
                            'moneda_original' => $monedaOriginal,
                            'monto_usd' => $montoUSD,
                            'tasa_cambio' => $tasaCambio,
                            'saldo_anterior' => $cuenta['saldo_actual'],
                            'saldo_nuevo' => $nuevoSaldo,
                            'moneda_cuenta' => $cuenta['moneda']
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
        
        private function registrarTransferencia($data) {
            try {
                // Validar campos requeridos
                $required = ['cuenta_origen_id', 'cuenta_destino_id', 'monto', 'concepto', 'titular', 'fecha_transaccion'];
                foreach ($required as $field) {
                    if (empty($data[$field])) {
                        $this->sendError("El campo '$field' es requerido", 400);
                        return;
                    }
                }
                
                if ($data['cuenta_origen_id'] == $data['cuenta_destino_id']) {
                    $this->sendError('La cuenta de origen y destino no pueden ser la misma', 400);
                    return;
                }
                
                if (!is_numeric($data['monto']) || $data['monto'] <= 0) {
                    $this->sendError('El monto debe ser un número positivo', 400);
                    return;
                }
                
                $usuario_id = $this->getUsuarioId();
                
                // Obtener información de las cuentas
                $cuentaOrigen = $this->obtenerCuentaBancaria($data['cuenta_origen_id']);
                $cuentaDestino = $this->obtenerCuentaBancaria($data['cuenta_destino_id']);
                
                if (!$cuentaOrigen || !$cuentaDestino) {
                    $this->sendError('Una o ambas cuentas no existen', 404);
                    return;
                }
                
                if (!$cuentaOrigen['activo'] || !$cuentaDestino['activo']) {
                    $this->sendError('Una o ambas cuentas están inactivas', 400);
                    return;
                }
                
                // Calcular montos
                $montoOriginal = (float) $data['monto'];
                $monedaOriginal = $data['moneda'] ?? 'USD';
                $tasaCambio = isset($data['tasa_cambio']) && $data['tasa_cambio'] !== '' ? 
                              (float) $data['tasa_cambio'] : 1.0;
                
                if ($monedaOriginal !== 'USD' && (!$tasaCambio || $tasaCambio <= 0)) {
                    if ($monedaOriginal === 'BS') {
                        $tasaCambio = 36.50;
                    } elseif ($monedaOriginal === 'EUR') {
                        $tasaCambio = 0.92;
                    }
                }
                
                // Calcular monto en USD
                $montoUSD = $this->calcularMontoUSD($montoOriginal, $monedaOriginal, $tasaCambio);
                
                // Calcular montos en moneda de cada cuenta
                $montoEnMonedaOrigen = $this->calcularMontoMonedaCuenta(
                    $montoOriginal, 
                    $monedaOriginal, 
                    $cuentaOrigen['moneda'], 
                    $tasaCambio
                );
                
                $montoEnMonedaDestino = $this->calcularMontoMonedaCuenta(
                    $montoOriginal, 
                    $monedaOriginal, 
                    $cuentaDestino['moneda'], 
                    $tasaCambio
                );
                
                // Validar saldo suficiente
                if ($montoEnMonedaOrigen > (float) $cuentaOrigen['saldo_actual']) {
                    $this->sendError('Saldo insuficiente en cuenta origen', 400);
                    return;
                }
                
                $this->pdo->beginTransaction();
                
                try {
                    // 1. Registrar egreso en cuenta origen
                    $queryEgreso = "INSERT INTO transacciones_banco 
                                   (tipo, cuenta_bancaria_id, monto, moneda, tasa_cambio, monto_dolares, 
                                    concepto, referencia, titular, documento_identidad, fecha_transaccion, 
                                    descripcion, usuario_id) 
                                   VALUES ('egreso', :cuenta_origen_id, :monto, :moneda, :tasa, :monto_usd, 
                                           :concepto_egreso, :referencia, :titular, :documento, :fecha, 
                                           :descripcion, :usuario_id)";
                    
                    $conceptoEgreso = "Transferencia a " . $cuentaDestino['nombre'] . " - " . $data['concepto'];
                    
                    $stmtEgreso = $this->pdo->prepare($queryEgreso);
                    $stmtEgreso->execute([
                        ':cuenta_origen_id' => $data['cuenta_origen_id'],
                        ':monto' => $montoOriginal,
                        ':moneda' => $monedaOriginal,
                        ':tasa' => $tasaCambio,
                        ':monto_usd' => $montoUSD,
                        ':concepto_egreso' => $conceptoEgreso,
                        ':referencia' => $data['referencia'] ?? null,
                        ':titular' => $data['titular'],
                        ':documento' => $data['documento_identidad'] ?? null,
                        ':fecha' => $data['fecha_transaccion'],
                        ':descripcion' => $data['descripcion'] ?? 'Transferencia entre cuentas',
                        ':usuario_id' => $usuario_id
                    ]);
                    
                    $egresoId = $this->pdo->lastInsertId();
                    
                    // 2. Registrar ingreso en cuenta destino
                    $queryIngreso = "INSERT INTO transacciones_banco 
                                    (tipo, cuenta_bancaria_id, monto, moneda, tasa_cambio, monto_dolares, 
                                     concepto, referencia, titular, documento_identidad, fecha_transaccion, 
                                     descripcion, usuario_id) 
                                    VALUES ('ingreso', :cuenta_destino_id, :monto, :moneda, :tasa, :monto_usd, 
                                            :concepto_ingreso, :referencia, :titular, :documento, :fecha, 
                                            :descripcion, :usuario_id)";
                    
                    $conceptoIngreso = "Transferencia de " . $cuentaOrigen['nombre'] . " - " . $data['concepto'];
                    
                    $stmtIngreso = $this->pdo->prepare($queryIngreso);
                    $stmtIngreso->execute([
                        ':cuenta_destino_id' => $data['cuenta_destino_id'],
                        ':monto' => $montoOriginal,
                        ':moneda' => $monedaOriginal,
                        ':tasa' => $tasaCambio,
                        ':monto_usd' => $montoUSD,
                        ':concepto_ingreso' => $conceptoIngreso,
                        ':referencia' => $data['referencia'] ?? null,
                        ':titular' => $data['titular'],
                        ':documento' => $data['documento_identidad'] ?? null,
                        ':fecha' => $data['fecha_transaccion'],
                        ':descripcion' => $data['descripcion'] ?? 'Transferencia entre cuentas',
                        ':usuario_id' => $usuario_id
                    ]);
                    
                    $ingresoId = $this->pdo->lastInsertId();
                    
                    // 3. Actualizar saldos
                    // Cuenta origen: restar
                    $nuevoSaldoOrigen = (float) $cuentaOrigen['saldo_actual'] - $montoEnMonedaOrigen;
                    $queryUpdateOrigen = "UPDATE bancos SET saldo_actual = :saldo, updated_at = NOW() WHERE id = :id";
                    $stmtUpdateOrigen = $this->pdo->prepare($queryUpdateOrigen);
                    $stmtUpdateOrigen->execute([
                        ':saldo' => $nuevoSaldoOrigen,
                        ':id' => $data['cuenta_origen_id']
                    ]);
                    
                    // Cuenta destino: sumar
                    $nuevoSaldoDestino = (float) $cuentaDestino['saldo_actual'] + $montoEnMonedaDestino;
                    $queryUpdateDestino = "UPDATE bancos SET saldo_actual = :saldo, updated_at = NOW() WHERE id = :id";
                    $stmtUpdateDestino = $this->pdo->prepare($queryUpdateDestino);
                    $stmtUpdateDestino->execute([
                        ':saldo' => $nuevoSaldoDestino,
                        ':id' => $data['cuenta_destino_id']
                    ]);
                    
                    $this->pdo->commit();
                    
                    $this->sendSuccess([
                        'message' => 'Transferencia realizada correctamente',
                        'transaccion_ids' => [
                            'egreso_id' => $egresoId,
                            'ingreso_id' => $ingresoId
                        ],
                        'datos' => [
                            'cuenta_origen' => $cuentaOrigen['nombre'] . ' - ' . $cuentaOrigen['numero_cuenta'],
                            'cuenta_destino' => $cuentaDestino['nombre'] . ' - ' . $cuentaDestino['numero_cuenta'],
                            'monto_original' => $montoOriginal,
                            'moneda_original' => $monedaOriginal,
                            'monto_usd' => $montoUSD,
                            'tasa_cambio' => $tasaCambio,
                            'saldo_origen_anterior' => $cuentaOrigen['saldo_actual'],
                            'saldo_origen_nuevo' => $nuevoSaldoOrigen,
                            'saldo_destino_anterior' => $cuentaDestino['saldo_actual'],
                            'saldo_destino_nuevo' => $nuevoSaldoDestino
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
        
        private function obtenerCuentaBancaria($id) {
            $query = "SELECT * FROM bancos WHERE id = ?";
            $stmt = $this->pdo->prepare($query);
            $stmt->execute([$id]);
            return $stmt->fetch();
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
    
    // Verificar que la acción sea válida
    $action = $_GET['action'] ?? '';
    if (!in_array($action, ['crear', 'listar'])) {
        echo json_encode([
            'success' => false,
            'error' => 'Acción no válida. Use: crear o listar'
        ]);
        exit;
    }
    
    // Crear instancia y procesar
    $api = new TransaccionesBancoAPI($pdo);
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