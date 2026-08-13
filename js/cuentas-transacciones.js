/**
 * Módulo de Transacciones de Cuentas Bancarias
 * Gestiona ingresos, egresos y transferencias de cuentas bancarias
 * Independiente del control de flujo de partidas
 */

const cuentasTransacciones = {
    // Estado actual
    cuentas: [],
    transacciones: [],
    
    /**
     * Inicializar módulo
     */
    init() {
        this.cargarCuentas();
        this.setupEventListeners();
    },

    /**
     * Cargar todas las cuentas bancarias
     */
    cargarCuentas() {
        fetch('api/cuentas-bancarias.php?action=listar')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.cuentas) {
                    this.cuentas = data.cuentas;
                    this.actualizarSelectsCuentas();
                    this.actualizarTablaCuentas();
                } else {
                    console.error('Error cargando cuentas:', data.error);
                }
            })
            .catch(error => console.error('Error:', error));
    },

    /**
     * Actualizar todos los select de cuentas
     */
    actualizarSelectsCuentas() {
        const selectIds = [
            'banco_ingreso',
            'banco_egreso',
            'cuenta_origen',
            'cuenta_destino'
        ];

        selectIds.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                this.llenarSelectCuentas(select);
            }
        });
    },

    /**
     * Llenar un select con las cuentas disponibles
     */
    llenarSelectCuentas(select, filtroMoneda = null) {
        let html = '<option value="">Seleccionar cuenta...</option>';
        
        this.cuentas.forEach(cuenta => {
            if (filtroMoneda && cuenta.moneda !== filtroMoneda) return;
            if (!cuenta.activo) return;
            
            html += `<option value="${cuenta.id}" 
                             data-moneda="${cuenta.moneda}"
                             data-saldo="${cuenta.saldo_actual}"
                             data-banco="${cuenta.nombre}">
                        ${cuenta.nombre} - ${cuenta.numero_cuenta} (${cuenta.moneda}) - Saldo: $${parseFloat(cuenta.saldo_actual).toLocaleString()}
                    </option>`;
        });
        
        select.innerHTML = html;
    },

    /**
     * Actualizar tabla de cuentas bancarias
     */
    actualizarTablaCuentas() {
        const tbody = document.getElementById('tabla-cuentas');
        if (!tbody) return;

        let html = '';
        this.cuentas.forEach(cuenta => {
            const saldoClase = parseFloat(cuenta.saldo_actual) < 0 ? 'text-danger' : 'text-success';
            
            html += `
                <tr>
                    <td>
                        <strong>${cuenta.nombre}</strong>
                        <br>
                        <small class="text-muted">${cuenta.pais}</small>
                    </td>
                    <td>
                        <code>${cuenta.numero_cuenta}</code>
                        <br>
                        <small>${cuenta.tipo_cuenta}</small>
                    </td>
                    <td>
                        <span class="badge bg-${cuenta.moneda === 'USD' ? 'primary' : cuenta.moneda === 'BS' ? 'warning' : 'success'}">
                            ${cuenta.moneda}
                        </span>
                    </td>
                    <td class="${saldoClase}">
                        <strong>$${parseFloat(cuenta.saldo_actual).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                        <br>
                        <small class="text-muted">Inicial: $${parseFloat(cuenta.saldo_inicial).toLocaleString()}</small>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm" role="group">
                            <button type="button" class="btn btn-success" 
                                    onclick="cuentasTransacciones.abrirModalTransaccion('ingreso', ${cuenta.id})"
                                    title="Registrar ingreso">
                                <i class="fas fa-plus-circle"></i>
                            </button>
                            <button type="button" class="btn btn-danger" 
                                    onclick="cuentasTransacciones.abrirModalTransaccion('egreso', ${cuenta.id})"
                                    title="Registrar egreso">
                                <i class="fas fa-minus-circle"></i>
                            </button>
                            <button type="button" class="btn btn-info" 
                                    onclick="cuentasTransacciones.abrirModalTransaccion('transferencia', ${cuenta.id})"
                                    title="Transferencia">
                                <i class="fas fa-exchange-alt"></i>
                            </button>
                            <button type="button" class="btn btn-warning btn-sm" 
                                    onclick="cuentasTransacciones.editarCuenta(${cuenta.id})"
                                    title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-outline-danger btn-sm" 
                                    onclick="cuentasTransacciones.desactivarCuenta(${cuenta.id})"
                                    title="Desactivar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html || '<tr><td colspan="5" class="text-center text-muted">No hay cuentas registradas</td></tr>';
    },

    /**
     * Abrir modal de transacción
     */
    abrirModalTransaccion(tipo, cuentaId = null) {
        const modal = document.getElementById('modal-transaccion-banco');
        if (!modal) {
            console.error('Modal de transacción no encontrado');
            return;
        }

        // Limpiar formulario
        this.limpiarFormularioTransaccion();

        // Establecer tipo de transacción
        document.getElementById('transaccion_tipo').value = tipo;

        // Llenar selectores según tipo
        this.configurarModalPorTipo(tipo, cuentaId);

        // Mostrar modal
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    },

    /**
     * Configurar modal según tipo de transacción
     */
    configurarModalPorTipo(tipo, cuentaId) {
        const cuentaOrigenSelect = document.getElementById('cuenta_origen');
        const cuentaDestinoGroup = document.getElementById('cuenta-destino-group');
        const beneficiarioGroup = document.getElementById('beneficiario-group');
        const modoTiulo = document.querySelector('#modal-transaccion-banco .modal-title');

        // Configurar visibilidad de campos
        if (tipo === 'transferencia') {
            cuentaDestinoGroup.style.display = 'block';
            beneficiarioGroup.style.display = 'none';
            modoTiulo.innerHTML = '<i class="fas fa-exchange-alt"></i> Transferencia Entre Cuentas';
        } else if (tipo === 'egreso') {
            cuentaDestinoGroup.style.display = 'none';
            beneficiarioGroup.style.display = 'block';
            modoTiulo.innerHTML = '<i class="fas fa-minus-circle"></i> Registrar Egreso';
        } else {
            cuentaDestinoGroup.style.display = 'none';
            beneficiarioGroup.style.display = 'none';
            modoTiulo.innerHTML = '<i class="fas fa-plus-circle"></i> Registrar Ingreso';
        }

        // Preseleccionar cuenta si se especifica
        if (cuentaId) {
            cuentaOrigenSelect.value = cuentaId;
            cuentaOrigenSelect.dispatchEvent(new Event('change'));
        } else {
            this.llenarSelectCuentas(cuentaOrigenSelect);
        }

        // Llenar select de cuentas destino para transferencias
        if (tipo === 'transferencia') {
            const cuentaDestinoSelect = document.getElementById('cuenta_destino');
            this.llenarSelectCuentas(cuentaDestinoSelect);
        }

        // Establecer fecha actual
        document.getElementById('fecha_transaccion').valueAsDate = new Date();
    },

    /**
     * Actualizar información de cuenta seleccionada
     */
    actualizarInfoCuenta(cuentaId) {
        const cuenta = this.cuentas.find(c => c.id == cuentaId);
        if (!cuenta) return;

        document.getElementById('info-moneda-cuenta').innerHTML = 
            `<i class="fas fa-coins"></i> Moneda: <strong>${cuenta.moneda}</strong>`;
        
        document.getElementById('info-saldo-cuenta').innerHTML = 
            `<i class="fas fa-wallet"></i> Saldo: <strong class="text-${parseFloat(cuenta.saldo_actual) < 0 ? 'danger' : 'success'}">$${parseFloat(cuenta.saldo_actual).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>`;

        // Actualizar símbolo de moneda
        const simbolo = this.obtenerSimboloMoneda(cuenta.moneda);
        document.getElementById('simbolo-moneda').textContent = simbolo;
        document.getElementById('moneda-transaccion').textContent = cuenta.moneda;

        // Preseleccionar moneda en el select
        document.getElementById('moneda_transaccion').value = cuenta.moneda;
        document.getElementById('moneda_transaccion').dispatchEvent(new Event('change'));
    },

    /**
     * Obtener símbolo de moneda
     */
    obtenerSimboloMoneda(moneda) {
        const simbolos = {
            'USD': '$',
            'BS': 'Bs.',
            'EUR': '€'
        };
        return simbolos[moneda] || '$';
    },

    /**
     * Guardar transacción
     */
    guardarTransaccion(event) {
        if (event) event.preventDefault();

        try {
            const tipo = document.getElementById('transaccion_tipo').value;
            const cuentaOrigen = document.getElementById('cuenta_origen').value;
            const monto = parseFloat(document.getElementById('monto_transaccion').value);
            const moneda = document.getElementById('moneda_transaccion').value;
            const concepto = document.getElementById('concepto_transaccion').value;

            // Validaciones básicas
            if (!cuentaOrigen) {
                this.mostrarError('Seleccione la cuenta origen');
                return;
            }

            if (!monto || monto <= 0) {
                this.mostrarError('Ingrese un monto válido mayor a 0');
                return;
            }

            if (!concepto) {
                this.mostrarError('Ingrese un concepto para la transacción');
                return;
            }

            // Validaciones específicas por tipo
            if (tipo === 'transferencia') {
                const cuentaDestino = document.getElementById('cuenta_destino').value;
                if (!cuentaDestino) {
                    this.mostrarError('Seleccione la cuenta destino');
                    return;
                }
                if (cuentaOrigen === cuentaDestino) {
                    this.mostrarError('No puede transferir a la misma cuenta');
                    return;
                }
            } else if (tipo === 'egreso') {
                const cuenta = this.cuentas.find(c => c.id == cuentaOrigen);
                if (cuenta && parseFloat(cuenta.saldo_actual) < monto) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Saldo insuficiente',
                        text: `Saldo disponible: $${parseFloat(cuenta.saldo_actual).toLocaleString()}`,
                        showCancelButton: true,
                        confirmButtonText: 'Continuar de todas formas',
                        cancelButtonText: 'Cancelar'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            this.procesarTransaccion(tipo, cuentaOrigen, monto, moneda, concepto);
                        }
                    });
                    return;
                }
            }

            this.procesarTransaccion(tipo, cuentaOrigen, monto, moneda, concepto);
        } catch (error) {
            console.error('Error en guardarTransaccion:', error);
            this.mostrarError('Error al procesar la transacción: ' + error.message);
        }
    },

    /**
     * Procesar transacción en el servidor
     */
    procesarTransaccion(tipo, cuentaOrigen, monto, moneda, concepto) {
        try {
            const usuario = JSON.parse(localStorage.getItem('user') || '{}');
            const cuentaDestino = document.getElementById('cuenta_destino')?.value || null;
            const tasaCambio = parseFloat(document.getElementById('tasa_cambio')?.value || 1);
            const referencia = document.getElementById('referencia_transaccion')?.value || '';
            const descripcion = document.getElementById('descripcion_transaccion')?.value || '';
            const titular = document.getElementById('titular_transaccion')?.value || '';
            const documento = document.getElementById('documento_transaccion')?.value || '';
            const beneficiario = document.getElementById('beneficiario_transaccion')?.value || null;
            const fechaTransaccion = document.getElementById('fecha_transaccion')?.value || new Date().toISOString().split('T')[0];

            // Calcular monto en dólares
            let montoDolares = monto;
            if (moneda === 'BS') {
                montoDolares = monto / tasaCambio;
            } else if (moneda === 'EUR') {
                montoDolares = monto * tasaCambio;
            }

            const datos = {
                tipo,
                cuenta_origen_id: cuentaOrigen,
                cuenta_destino_id: cuentaDestino,
                monto,
                moneda,
                tasa_cambio: tasaCambio,
                monto_dolares: montoDolares,
                concepto,
                referencia,
                descripcion,
                titular,
                documento_identidad: documento,
                beneficiario,
                fecha_transaccion: fechaTransaccion,
                usuario_id: usuario.id || 1
            };

            // Mostrar loading
            const btnGuardar = document.getElementById('btn-guardar-transaccion');
            if (!btnGuardar) {
                this.mostrarError('No se encontró el botón de guardar');
                return;
            }
            
            const textoOriginal = btnGuardar.innerHTML;
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';

            fetch('api/transacciones-banco.php?action=crear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = textoOriginal;

                    if (data.success) {
                        this.mostrarExito('Transacción registrada correctamente');
                        
                        // Cerrar modal
                        const modalElement = document.getElementById('modal-transaccion-banco');
                        const modal = bootstrap.Modal.getInstance(modalElement);
                        if (modal) {
                            modal.hide();
                        }

                        // Refrescar datos
                        this.cargarCuentas();
                        this.cargarTransacciones();
                    } else {
                        this.mostrarError(data.error || 'Error al registrar transacción');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = textoOriginal;
                    this.mostrarError('Error de conexión al servidor: ' + error.message);
                });
        } catch (error) {
            console.error('Error en procesarTransaccion:', error);
            this.mostrarError('Error al procesar: ' + error.message);
        }
    },

    /**
     * Cargar transacciones registradas
     */
    cargarTransacciones(limite = 50) {
        fetch(`api/transacciones-banco.php?action=listar&limit=${limite}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.transacciones) {
                    this.transacciones = data.transacciones;
                }
            })
            .catch(error => console.error('Error cargando transacciones:', error));
    },

    /**
     * Editar cuenta bancaria
     */
    editarCuenta(cuentaId) {
        const cuenta = this.cuentas.find(c => c.id == cuentaId);
        if (!cuenta) return;

        // Llenar formulario con datos de la cuenta
        document.getElementById('nombre_banco').value = cuenta.nombre;
        document.getElementById('pais_banco').value = cuenta.pais;
        document.getElementById('numero_cuenta').value = cuenta.numero_cuenta;
        document.getElementById('tipo_cuenta').value = cuenta.tipo_cuenta;
        document.getElementById('representante_banco').value = cuenta.representante;
        document.getElementById('email_representante').value = cuenta.email_representante;
        document.getElementById('telefono_representante').value = cuenta.telefono_representante;
        document.getElementById('moneda_banco').value = cuenta.moneda;
        document.getElementById('saldo_inicial').value = cuenta.saldo_inicial;

        // Cambiar botón a "Actualizar"
        const btnGuardar = document.getElementById('btn-guardar-cuenta');
        btnGuardar.textContent = 'Actualizar Cuenta';
        btnGuardar.classList.remove('btn-info');
        btnGuardar.classList.add('btn-warning');
        btnGuardar.onclick = () => this.actualizarCuenta(cuentaId);

        // Cambiar a pestaña de crear cuenta
        const tab = new bootstrap.Tab(document.getElementById('crear-cuenta-tab'));
        tab.show();

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modal-crear-cuenta'));
        modal.show();
    },

    /**
     * Actualizar cuenta bancaria
     */
    actualizarCuenta(cuentaId) {
        const datos = {
            id: cuentaId,
            nombre: document.getElementById('nombre_banco').value,
            pais: document.getElementById('pais_banco').value,
            numero_cuenta: document.getElementById('numero_cuenta').value,
            tipo_cuenta: document.getElementById('tipo_cuenta').value,
            representante: document.getElementById('representante_banco').value,
            email_representante: document.getElementById('email_representante').value,
            telefono_representante: document.getElementById('telefono_representante').value,
            moneda: document.getElementById('moneda_banco').value
        };

        const btnGuardar = document.getElementById('btn-guardar-cuenta');
        const textoOriginal = btnGuardar.textContent;
        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Actualizando...';

        fetch('api/cuentas-bancarias.php?action=actualizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        })
            .then(response => response.json())
            .then(data => {
                btnGuardar.disabled = false;
                btnGuardar.textContent = textoOriginal;

                if (data.success) {
                    this.mostrarExito('Cuenta actualizada correctamente');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('modal-crear-cuenta'));
                    if (modal) modal.hide();
                    this.cargarCuentas();
                } else {
                    this.mostrarError(data.error || 'Error al actualizar cuenta');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                btnGuardar.disabled = false;
                btnGuardar.textContent = textoOriginal;
                this.mostrarError('Error de conexión');
            });
    },

    /**
     * Desactivar cuenta
     */
    desactivarCuenta(cuentaId) {
        Swal.fire({
            title: '¿Desactivar cuenta?',
            text: 'Esta acción no se puede deshacer. La cuenta no aparecerá más en las transacciones.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, desactivar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                fetch('api/cuentas-bancarias.php?action=desactivar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: cuentaId })
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            this.mostrarExito('Cuenta desactivada');
                            this.cargarCuentas();
                        } else {
                            this.mostrarError(data.error || 'Error al desactivar');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        this.mostrarError('Error de conexión');
                    });
            }
        });
    },

    /**
     * Limpiar formulario de transacción
     */
    limpiarFormularioTransaccion() {
        const form = document.getElementById('form-transaccion-banco');
        if (form) form.reset();

        document.getElementById('equivalente_usd').value = '';
        document.getElementById('info-presupuesto-padre').innerHTML = '';
    },

    /**
     * Configurar eventos
     */
    setupEventListeners() {
        // Evento al cambiar cuenta origen
        const cuentaOrigenSelect = document.getElementById('cuenta_origen');
        if (cuentaOrigenSelect) {
            cuentaOrigenSelect.addEventListener('change', (e) => {
                this.actualizarInfoCuenta(e.target.value);
            });
        }

        // Evento para guardar transacción
        const formTransaccion = document.getElementById('form-transaccion-banco');
        if (formTransaccion) {
            formTransaccion.addEventListener('submit', (e) => {
                this.guardarTransaccion(e);
            });
        }

        // Evento al cambiar moneda en transacción
        const monedaSelect = document.getElementById('moneda_transaccion');
        if (monedaSelect) {
            monedaSelect.addEventListener('change', () => {
                this.actualizarUIConversion();
            });
        }

        // Evento al cambiar cuenta origen en tab de cuentas
        const cuentaOrigenTabSelect = document.getElementById('cuenta_origen');
        if (cuentaOrigenTabSelect) {
            cuentaOrigenTabSelect.addEventListener('change', (e) => {
                const cuenta = this.cuentas.find(c => c.id == e.target.value);
                if (cuenta) {
                    document.getElementById('moneda_transaccion').value = cuenta.moneda;
                    document.getElementById('moneda_transaccion').dispatchEvent(new Event('change'));
                }
            });
        }

        // Evento para boton guardar cuenta
        const btnGuardarCuenta = document.getElementById('btn-guardar-cuenta');
        if (btnGuardarCuenta) {
            btnGuardarCuenta.addEventListener('click', () => {
                this.guardarCuenta();
            });
        }

        // Eventos para botones de transacciones en tab de cuentas
        const btnIngresoTab = document.getElementById('btn-transaccion-ingreso');
        const btnEgresoTab = document.getElementById('btn-transaccion-egreso');
        const btnTransferenciaTab = document.getElementById('btn-transaccion-transferencia');

        if (btnIngresoTab) {
            btnIngresoTab.addEventListener('click', () => {
                this.abrirModalTransaccion('ingreso');
            });
        }

        if (btnEgresoTab) {
            btnEgresoTab.addEventListener('click', () => {
                this.abrirModalTransaccion('egreso');
            });
        }

        if (btnTransferenciaTab) {
            btnTransferenciaTab.addEventListener('click', () => {
                this.abrirModalTransaccion('transferencia');
            });
        }
    },

    /**
     * Actualizar UI para conversión de moneda
     */
    actualizarUIConversion() {
        const monedaSelect = document.getElementById('moneda_transaccion');
        const tasaCambioGroup = document.getElementById('tasa-cambio-group');
        const equivalenteGroup = document.getElementById('equivalente-usd-group');
        const tasaCambioInput = document.getElementById('tasa_cambio');
        const moneda = monedaSelect.value;

        if (moneda !== 'USD') {
            tasaCambioGroup.style.display = 'block';
            equivalenteGroup.style.display = 'block';

            if (!tasaCambioInput.value || tasaCambioInput.value === '0') {
                if (moneda === 'BS') {
                    tasaCambioInput.value = '36.50';
                } else if (moneda === 'EUR') {
                    tasaCambioInput.value = '0.92';
                }
            }
        } else {
            tasaCambioGroup.style.display = 'none';
            equivalenteGroup.style.display = 'none';
        }
    },

    /**
     * Guardar nueva cuenta bancaria
     */
    guardarCuenta() {
        const datos = {
            nombre: document.getElementById('nombre_banco').value,
            pais: document.getElementById('pais_banco').value,
            numero_cuenta: document.getElementById('numero_cuenta').value,
            tipo_cuenta: document.getElementById('tipo_cuenta').value,
            representante: document.getElementById('representante_banco').value,
            email_representante: document.getElementById('email_representante').value,
            telefono_representante: document.getElementById('telefono_representante').value,
            moneda: document.getElementById('moneda_banco').value,
            saldo_inicial: parseFloat(document.getElementById('saldo_inicial').value)
        };

        // Validaciones
        if (!datos.nombre || !datos.numero_cuenta || !datos.representante) {
            this.mostrarError('Completa todos los campos obligatorios');
            return;
        }

        if (isNaN(datos.saldo_inicial)) {
            this.mostrarError('Ingresa un saldo inicial válido');
            return;
        }

        const btnGuardar = document.getElementById('btn-guardar-cuenta');
        const textoOriginal = btnGuardar.textContent;
        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Guardando...';

        fetch('api/cuentas-bancarias.php?action=crear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        })
            .then(response => response.json())
            .then(data => {
                btnGuardar.disabled = false;
                btnGuardar.textContent = textoOriginal;

                if (data.success) {
                    this.mostrarExito('Cuenta bancaria creada correctamente');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('modal-crear-cuenta'));
                    if (modal) modal.hide();
                    this.cargarCuentas();

                    // Resetear botón
                    btnGuardar.textContent = 'Guardar Cuenta';
                    btnGuardar.classList.remove('btn-warning');
                    btnGuardar.classList.add('btn-info');
                    btnGuardar.onclick = null;
                } else {
                    this.mostrarError(data.error || 'Error al crear cuenta');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                btnGuardar.disabled = false;
                btnGuardar.textContent = textoOriginal;
                this.mostrarError('Error de conexión');
            });
    },

    /**
     * Mostrar mensaje de error
     */
    mostrarError(mensaje) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: mensaje
        });
    },

    /**
     * Mostrar mensaje de éxito
     */
    mostrarExito(mensaje) {
        Swal.fire({
            icon: 'success',
            title: 'Éxito',
            text: mensaje,
            timer: 2000,
            showConfirmButton: false
        });
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    cuentasTransacciones.init();
});
