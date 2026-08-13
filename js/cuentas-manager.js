// cuentas-manager.js - Gestión de cuentas bancarias
class CuentasManager {
    constructor(controlFlujo) {
        this.cf = controlFlujo;
    }

    async cargarResumenCuentas() {
        try {
            const response = await fetch('api/bancos.php?action=listar');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
          //  console.log('Datos de cuentas:', data);

            if (data.success) {
                this.cf.cuentasCache = data.cuentas || [];
                this.renderizarResumenCuentas(this.cf.cuentasCache);
                this.actualizarSelectoresBancos(this.cf.cuentasCache);
            } else {
                console.error('Error en respuesta:', data.error);
                this.mostrarDatosEjemploCuentas();
            }
        } catch (error) {
            console.error('Error cargando cuentas:', error);
            this.mostrarDatosEjemploCuentas();
        }
    }

    renderizarResumenCuentas(cuentas) {
        const container = document.getElementById('resumen-cuentas');
        if (!container) {
            console.error('Contenedor resumen-cuentas no encontrado');
            return;
        }

        if (!cuentas || cuentas.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> No hay cuentas bancarias registradas.
                    <button class="btn btn-sm btn-primary ml-2" onclick="window.controlFlujo.cuentas.mostrarModalCrearCuenta()">
                        <i class="fas fa-plus"></i> Crear Cuenta
                    </button>
                </div>
            `;
            return;
        }

        let html = '<div class="row">';
        let totalUSD = 0;
        let totalBS = 0;
        let totalEUR = 0;

        cuentas.forEach(cuenta => {
            const saldo = parseFloat(cuenta.saldo_actual || cuenta.saldo_inicial || 0);
            const moneda = cuenta.moneda || 'USD';

            if (moneda === 'USD') totalUSD += saldo;
            if (moneda === 'BS') totalBS += saldo;
            if (moneda === 'EUR') totalEUR += saldo;

            html += `
                <div class="col-md-4 mb-3">
                    <div class="card cuenta-card ${saldo > 0 ? 'border-success' : 'border-warning'} h-100">
                        <div class="card-header d-flex justify-content-between align-items-center py-2">
                            <h6 class="mb-0">
                                <i class="fas fa-university mr-2"></i>${cuenta.nombre || 'Sin nombre'}
                            </h6>
                            <span class="badge ${moneda === 'USD' ? 'badge-success' : moneda === 'BS' ? 'badge-info' : 'badge-warning'}">
                                ${moneda}
                            </span>
                        </div>
                        <div class="card-body py-3">
                            <p class="mb-1"><small><i class="fas fa-credit-card mr-1"></i>${cuenta.numero_cuenta || 'N/A'}</small></p>
                            <p class="mb-1"><small><i class="fas fa-globe-americas mr-1"></i>${cuenta.pais || 'No especificado'}</small></p>
                            <p class="mb-1"><small><i class="fas fa-user-tie mr-1"></i>${cuenta.representante || 'No especificado'}</small></p>
                            <p class="saldo mt-2 mb-0">
                                <strong><i class="fas fa-wallet mr-1"></i>Saldo: ${this.cf.formatearMoneda(saldo, moneda)}</strong>
                            </p>
                        </div>
                        <div class="card-footer py-2">
                            <small class="text-muted">
                                <i class="fas fa-calendar mr-1"></i>${this.cf.formatearFecha(cuenta.created_at)}
                            </small>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';

        if (cuentas.length > 0) {
            html += `
                <div class="totales-cuentas mt-4">
                    <h5><i class="fas fa-chart-pie mr-2"></i>Totales por Moneda</h5>
                    <div class="row">
                        <div class="col-md-4 mb-2">
                            <div class="total-card bg-success text-white p-3 rounded">
                                <h6 class="mb-1"><i class="fas fa-dollar-sign"></i> Total USD</h6>
                                <h4 class="mb-0">${this.cf.formatearMoneda(totalUSD, 'USD')}</h4>
                            </div>
                        </div>
                        <div class="col-md-4 mb-2">
                            <div class="total-card bg-info text-white p-3 rounded">
                                <h6 class="mb-1"><i class="fas fa-bolt"></i> Total BS</h6>
                                <h4 class="mb-0">${this.cf.formatearMoneda(totalBS, 'BS')}</h4>
                            </div>
                        </div>
                        <div class="col-md-4 mb-2">
                            <div class="total-card bg-warning text-white p-3 rounded">
                                <h6 class="mb-1"><i class="fas fa-euro-sign"></i> Total EUR</h6>
                                <h4 class="mb-0">${this.cf.formatearMoneda(totalEUR, 'EUR')}</h4>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    mostrarDatosEjemploCuentas() {
        const cuentasEjemplo = [
            {
                id: 1,
                nombre: 'Banco de Venezuela',
                pais: 'Venezuela',
                numero_cuenta: '0102-1234-5678-9012',
                tipo_cuenta: 'Corriente',
                representante: 'Juan Pérez',
                saldo_actual: 50000.00,
                moneda: 'USD',
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                nombre: 'Mercantil',
                pais: 'Venezuela',
                numero_cuenta: '0105-9876-5432-1098',
                tipo_cuenta: 'Ahorro',
                representante: 'María González',
                saldo_actual: 25000.00,
                moneda: 'USD',
                created_at: new Date().toISOString()
            }
        ];

        this.cf.cuentasCache = cuentasEjemplo;
        this.renderizarResumenCuentas(cuentasEjemplo);
        this.actualizarSelectoresBancos(cuentasEjemplo);
    }

    actualizarSelectoresBancos(cuentas) {
        const selectores = ['banco_ingreso', 'banco_egreso'];

        selectores.forEach(selectorId => {
            const selector = document.getElementById(selectorId);
            if (selector) {
                let html = '<option value="">Seleccionar cuenta...</option>';
                cuentas.forEach(cuenta => {
                    const saldo = parseFloat(cuenta.saldo_actual || cuenta.saldo_inicial || 0);
                    const moneda = cuenta.moneda || 'USD';

                    html += `
                        <option value="${cuenta.id}">
                            ${cuenta.nombre} - ${cuenta.numero_cuenta} 
                            (${moneda}: ${this.cf.formatearMoneda(saldo, moneda)})
                        </option>
                    `;
                });
                selector.innerHTML = html;
            }
        });
    }

    async cargarListaCuentas() {
        try {
            const response = await fetch('api/bancos.php?action=listar');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.cf.cuentasCache = data.cuentas || [];
                this.renderizarListaCuentas(this.cf.cuentasCache);
            } else {
                this.renderizarListaCuentas([]);
            }
        } catch (error) {
            console.error('Error cargando lista de cuentas:', error);
            this.renderizarListaCuentas([]);
        }
    }

    renderizarListaCuentas(cuentas) {
        const container = document.getElementById('tabla-cuentas');
        if (!container) return;

        if (!cuentas || cuentas.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle"></i> No hay cuentas registradas.
                            <button class="btn btn-sm btn-primary ml-2" onclick="window.controlFlujo.cuentas.mostrarModalCrearCuenta()">
                                <i class="fas fa-plus"></i> Crear Cuenta
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        cuentas.forEach(cuenta => {
            const saldo = parseFloat(cuenta.saldo_actual || cuenta.saldo_inicial || 0);
            const moneda = cuenta.moneda || 'USD';

            html += `
                <tr>
                    <td>
                        <strong>${cuenta.nombre}</strong><br>
                        <small class="text-muted">${cuenta.pais || ''}</small>
                    </td>
                    <td>
                        ${cuenta.numero_cuenta}<br>
                        <small class="text-muted">${cuenta.tipo_cuenta || ''}</small>
                    </td>
                    <td>
                        <span class="badge ${moneda === 'USD' ? 'badge-success' : moneda === 'BS' ? 'badge-info' : 'badge-warning'}">
                            ${moneda}
                        </span>
                    </td>
                    <td>
                        <strong class="${saldo >= 0 ? 'text-success' : 'text-danger'}">
                            ${this.cf.formatearMoneda(saldo, moneda)}
                        </strong><br>
                        <small class="text-muted">
                            <i class="fas fa-user-tie"></i> ${cuenta.representante || 'No especificado'}
                        </small>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-warning" onclick="window.controlFlujo.cuentas.editarCuenta(${cuenta.id})" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger" onclick="window.controlFlujo.cuentas.eliminarCuenta(${cuenta.id})" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = html;
    }

    async cargarCuentasParaModal(tipo) {
        try {
           // console.log(`Cargando cuentas para modal de ${tipo}...`);

            // URL CORREGIDA: Usar la misma que en cargarResumenCuentas
            const response = await fetch('api/bancos.php?action=listar');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
           // console.log('Datos de cuentas cargadas:', data);

            if (data.success) {
                this.cf.cuentasCache = data.cuentas || [];
                this.renderizarCuentasParaSeleccion(this.cf.cuentasCache, tipo);
                return this.cf.cuentasCache;
            } else {
                console.error('Error en respuesta de cuentas:', data.error);
                this.cf.ui.mostrarError('No se pudieron cargar las cuentas bancarias');
                return [];
            }
        } catch (error) {
            console.error('Error cargando cuentas para modal:', error);
            this.cf.ui.mostrarError('Error al cargar cuentas bancarias');
            return [];
        }
    }

    renderizarCuentasParaSeleccion(cuentas, tipoModal) {
      //  console.log(`Renderizando cuentas para modal ${tipoModal}:`, cuentas);

        // Determinar qué selectores actualizar basado en el tipo de modal
        let selectoresIds = [];

        switch (tipoModal) {
            case 'ingreso':
            case 'egreso':
                selectoresIds = ['cuenta_origen'];
                break;
            case 'transferencia':
                selectoresIds = ['cuenta_origen', 'cuenta_destino'];
                break;
            default:
                selectoresIds = ['cuenta_origen'];
        }

        selectoresIds.forEach(selectorId => {
            const selector = document.getElementById(selectorId);
            if (selector) {
                let html = '<option value="">Seleccionar cuenta...</option>';

                cuentas.forEach(cuenta => {
                    const saldo = parseFloat(cuenta.saldo_actual || cuenta.saldo_inicial || 0);
                    const moneda = cuenta.moneda || 'USD';

                    html += `
                        <option value="${cuenta.id}" 
                                data-moneda="${moneda}" 
                                data-saldo="${saldo}"
                                data-tasa-default="${moneda === 'BS' ? '36.50' : moneda === 'EUR' ? '1.08' : '1.00'}">
                            ${cuenta.nombre} - ${cuenta.numero_cuenta} 
                            (${moneda}: ${this.cf.formatearMoneda(saldo, moneda)})
                        </option>
                    `;
                });

                selector.innerHTML = html;
                
                // **CORRECCIÓN: Configurar evento para actualizar tasa cuando cambia cuenta**
                selector.addEventListener('change', function() {
                    const selectedOption = this.options[this.selectedIndex];
                    if (selectedOption.value) {
                        const monedaCuenta = selectedOption.getAttribute('data-moneda');
                        const monedaSelect = document.getElementById('moneda_transaccion');
                        const tasaInput = document.getElementById('tasa_cambio');
                        
                        // Si la moneda de la transacción es diferente a la de la cuenta,
                        // establecer tasa por defecto
                        if (monedaSelect && tasaInput && monedaSelect.value !== monedaCuenta) {
                            const tasaDefault = selectedOption.getAttribute('data-tasa-default') || '1.00';
                            if (!tasaInput.value || tasaInput.value === '1.00') {
                                tasaInput.value = tasaDefault;
                            }
                        }
                    }
                });
                
              //  console.log(`Selector ${selectorId} actualizado con ${cuentas.length} cuentas`);
            } else {
              //  console.warn(`Selector ${selectorId} no encontrado en el DOM`);
            }
        });
    }

    async editarCuenta(id) {
        try {
            const response = await fetch(`api/bancos.php?action=obtener&id=${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.cuenta) {
                this.cargarDatosEdicionCuenta(data.cuenta);

                // Asegurar que la pestaña "Crear Cuenta" esté activa antes de mostrar
                try {
                    const tabButton = document.querySelector('#cuentaTabs button[data-bs-target="#crear-cuenta"]');
                    if (tabButton && window.bootstrap && window.bootstrap.Tab) {
                        const tab = new bootstrap.Tab(tabButton);
                        tab.show();
                    } else if (tabButton) {
                        // Fallback: manipular clases
                        document.querySelectorAll('#cuentaTabs .nav-link').forEach(el => el.classList.remove('active'));
                        tabButton.classList.add('active');
                        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('show','active'));
                        const pane = document.querySelector('#crear-cuenta');
                        if (pane) pane.classList.add('show','active');
                    }
                } catch (e) {
                    console.warn('No se pudo activar la pestaña crear-cuenta:', e);
                }

                // Mostrar modal y enfocar el primer campo disponible
                this.cf.ui.mostrarModalCrearCuenta();
                setTimeout(() => {
                    const first = document.getElementById('nombre_banco') || document.getElementById('numero_cuenta') || document.getElementById('representante_banco');
                    if (first) first.focus();
                }, 150);
            } else {
                this.cf.ui.mostrarError(data.error || 'Error al cargar datos de la cuenta');
            }
        } catch (error) {
            console.error('Error cargando cuenta:', error);
            this.cf.ui.mostrarError('No se pudieron cargar los datos de la cuenta');
        }
    }

    cargarDatosEdicionCuenta(cuenta) {
        const modalTitle = document.querySelector('#modal-crear-cuenta .modal-title');
        if (modalTitle) {
            modalTitle.innerHTML = `<i class="fas fa-edit"></i> Editar Cuenta Bancaria`;
        }

        const guardarBtn = document.getElementById('btn-guardar-cuenta');
        if (guardarBtn) {
            guardarBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Cuenta';
            guardarBtn.dataset.mode = 'editar';
            guardarBtn.dataset.id = cuenta.id;
        }

        const setIfExists = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };

        setIfExists('nombre_banco', cuenta.nombre || '');
        setIfExists('pais_banco', cuenta.pais || '');
        setIfExists('numero_cuenta', cuenta.numero_cuenta || '');
        setIfExists('tipo_cuenta', cuenta.tipo_cuenta || '');
        setIfExists('representante_banco', cuenta.representante || '');
        setIfExists('email_representante', cuenta.email_representante || '');
        setIfExists('telefono_representante', cuenta.telefono_representante || '');
        setIfExists('moneda_banco', cuenta.moneda || 'USD');

        const saldoInput = document.getElementById('saldo_inicial');
        if (saldoInput) {
            const saldoActual = parseFloat(cuenta.saldo_actual || cuenta.saldo_inicial || 0);
            saldoInput.value = saldoActual;
            saldoInput.readOnly = true;
            saldoInput.title = 'El saldo no se puede editar directamente';

            const parent = saldoInput.parentElement;
            if (parent) {
                const saldoHelp = parent.querySelector('.form-text');
                if (saldoHelp) {
                    saldoHelp.textContent = `Saldo actual: ${this.cf.formatearMoneda(saldoActual, cuenta.moneda)} (No editable)`;
                    saldoHelp.className = 'form-text text-info';
                }
            }
        }
    }

    async eliminarCuenta(id) {
        try {
            const result = await Swal.fire({
                title: '¿Eliminar cuenta?',
                text: '¿Estás seguro de que deseas eliminar esta cuenta bancaria? Esta acción no se puede deshacer.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                const response = await fetch('api/bancos.php?action=eliminar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ id })
                });

                const data = await response.json();

                if (data.success) {
                    this.cf.ui.mostrarExito(data.message || 'Cuenta eliminada correctamente');

                    await this.cargarListaCuentas();
                    await this.cargarResumenCuentas();
                } else {
                    this.cf.ui.mostrarError(data.error || 'Error al eliminar la cuenta');
                }
            }
        } catch (error) {
            console.error('Error eliminando cuenta:', error);
            this.cf.ui.mostrarError('Error al eliminar la cuenta');
        }
    }

    async crearCuentaBancaria() {
        const form = document.getElementById('form-crear-cuenta');
        if (!form) {
            this.cf.ui.mostrarError('Formulario no encontrado');
            return;
        }

        const guardarBtn = document.getElementById('btn-guardar-cuenta');
        const isEditing = guardarBtn?.dataset?.mode === 'editar';
        const cuentaId = guardarBtn?.dataset?.id;

        const data = {
            nombre: document.getElementById('nombre_banco')?.value || '',
            pais: document.getElementById('pais_banco')?.value || '',
            numero_cuenta: document.getElementById('numero_cuenta')?.value || '',
            tipo_cuenta: document.getElementById('tipo_cuenta')?.value || '',
            representante: document.getElementById('representante_banco')?.value || '',
            email_representante: document.getElementById('email_representante')?.value || '',
            telefono_representante: document.getElementById('telefono_representante')?.value || '',
            moneda: document.getElementById('moneda_banco')?.value || 'USD'
        };

        if (!isEditing) {
            data.saldo_inicial = parseFloat(document.getElementById('saldo_inicial')?.value || 0);
        } else {
            data.id = cuentaId;
        }

        if (!data.nombre.trim()) {
            this.cf.ui.mostrarError('El nombre del banco es requerido');
            document.getElementById('nombre_banco')?.focus();
            return;
        }

        if (!data.numero_cuenta.trim()) {
            this.cf.ui.mostrarError('El número de cuenta es requerido');
            document.getElementById('numero_cuenta')?.focus();
            return;
        }

        if (!data.representante.trim()) {
            this.cf.ui.mostrarError('El nombre del representante es requerido');
            document.getElementById('representante_banco')?.focus();
            return;
        }

        if (!isEditing && isNaN(data.saldo_inicial)) {
            this.cf.ui.mostrarError('El saldo inicial debe ser un número válido');
            document.getElementById('saldo_inicial')?.focus();
            return;
        }

        const action = isEditing ? 'editar' : 'crear';
        const loadingText = isEditing ? 'Actualizando...' : 'Creando...';
        const successMessage = isEditing ? 'Cuenta actualizada correctamente' : 'Cuenta bancaria creada correctamente';

        const originalText = guardarBtn?.innerHTML;
        if (guardarBtn) {
            guardarBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
            guardarBtn.disabled = true;
        }

        try {
            const response = await fetch(`api/bancos.php?action=${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (guardarBtn) {
                guardarBtn.innerHTML = originalText;
                guardarBtn.disabled = false;
            }

            const result = await response.json();

            if (result.success) {
                this.cf.ui.mostrarExito(result.message || successMessage);

                await this.cargarResumenCuentas();
                await this.cargarListaCuentas();

                if (!isEditing && form) {
                    form.reset();
                }

                if (isEditing && guardarBtn) {
                    delete guardarBtn.dataset.mode;
                    delete guardarBtn.dataset.id;

                    const modalTitle = document.querySelector('#modal-crear-cuenta .modal-title');
                    if (modalTitle) {
                        modalTitle.innerHTML = `<i class="fas fa-university"></i> Gestión de Cuentas Bancarias`;
                    }

                    guardarBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Cuenta';

                    const saldoInput = document.getElementById('saldo_inicial');
                    if (saldoInput) {
                        saldoInput.readOnly = false;
                        saldoInput.value = '0';
                        saldoInput.title = '';

                        const saldoHelp = saldoInput.parentElement.querySelector('.form-text');
                        if (saldoHelp) {
                            saldoHelp.textContent = 'Saldo inicial de la cuenta';
                            saldoHelp.className = 'form-text';
                        }
                    }
                }

                const listaTab = document.getElementById('lista-cuentas-tab');
                if (listaTab && window.bootstrap) {
                    const tab = new bootstrap.Tab(listaTab);
                    tab.show();
                }
            } else {
                this.cf.ui.mostrarError(result.error || `Error al ${isEditing ? 'actualizar' : 'crear'} la cuenta bancaria`);
            }
        } catch (error) {
            console.error('Error:', error);
            this.cf.ui.mostrarError('Error de conexión al servidor: ' + error.message);

            if (guardarBtn) {
                guardarBtn.innerHTML = originalText;
                guardarBtn.disabled = false;
            }
        }
    }

    mostrarModalCrearCuenta() {
        this.cf.ui.mostrarModalCrearCuenta();
    }
}