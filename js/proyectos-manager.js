// proyectos-manager.js - Gestión de proyectos
class ProyectosManager {
    constructor(controlFlujo) {
        this.cf = controlFlujo;
        this.proyectosAsignadosIds = []; // NUEVO: IDs de proyectos asignados al usuario (para directivo)
    }

    async cargarProyectos() {
        try {
            const response = await fetch('api/proyectos.php?action=listar');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            // console.log('Datos de proyectos:', data);

            if (data.success && data.proyectos) {
                this.cf.proyectosCache = data.proyectos;

                // NUEVO: Si el usuario es directivo, cargar sus proyectos asignados
                let userRole = '';
                let userId = null;
                try {
                    const userData = localStorage.getItem('user');
                    if (userData) {
                        const user = JSON.parse(userData);
                        userRole = user.role ? user.role.toLowerCase() : '';
                        userId = user.id;
                    }
                } catch (e) { console.error('Error obteniendo usuario:', e); }

                if (userRole === 'directivo' && userId) {
                    try {
                        const resp = await fetch(`./api/get_proyectos_usuario.php?usuario_id=${userId}`);
                        const dataAsig = await resp.json();
                        if (dataAsig.success) {
                            this.proyectosAsignadosIds = dataAsig.proyectos.map(p => p.id);
                        }
                    } catch (e) { console.error('Error cargando proyectos asignados:', e); }
                } else {
                    this.proyectosAsignadosIds = [];
                }

                // Separar proyectos activos y completados
                const proyectosActivos = data.proyectos.filter(p => p.estado === 'Activo');
                const proyectosCompletados = data.proyectos.filter(p => p.estado === 'Completado');

                this.renderizarProyectos('proyectos-abiertos', proyectosActivos, 'Activos');
                this.renderizarProyectos('proyectos-cerrados', proyectosCompletados, 'Completados');

                this.actualizarContadores(proyectosActivos.length, proyectosCompletados.length);
            } else {
                this.cf.ui.mostrarError(data.error || 'Error al cargar proyectos');
                this.renderizarProyectos('proyectos-abiertos', [], 'Activos');
                this.renderizarProyectos('proyectos-cerrados', [], 'Completados');
            }
        } catch (error) {
            console.error('Error cargando proyectos:', error);
            this.cf.ui.mostrarError('No se pudieron cargar los proyectos');
            this.renderizarProyectos('proyectos-abiertos', [], 'Activos');
            this.renderizarProyectos('proyectos-cerrados', [], 'Completados');
        }
    }

    actualizarContadores(abiertos, cerrados) {
        const contadorAbiertos = document.getElementById('contador-abiertos');
        const contadorCerrados = document.getElementById('contador-cerrados');

        if (contadorAbiertos) contadorAbiertos.textContent = abiertos;
        if (contadorCerrados) contadorCerrados.textContent = cerrados;
    }

    renderizarProyectos(containerId, proyectos, tipo) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Contenedor ${containerId} no encontrado`);
            return;
        }

        // Obtener información del usuario del localStorage
        const userData = localStorage.getItem('user');
        let userRole = '';
        let userId = null;
        if (userData) {
            try {
                const user = JSON.parse(userData);
                userRole = user.role ? user.role.toLowerCase() : '';
                userId = user.id;
            } catch (error) {
                console.error('Error parsing user data:', error);
            }
        }

        // Roles que NO pueden ver los botones de cerrar/reabrir
        const rolesRestringidos = ['coord', 'coordinador', 'socio', 'directivo'];
        const mostrarBotonesAccion = !rolesRestringidos.includes(userRole);

        if (proyectos.length === 0) {
            let mensaje = '';
            if (userRole === 'coord' || userRole === 'coordinador') {
                mensaje = 'No tienes proyectos asignados como Coordinador. Contacta al administrador.';
            } else if (userRole === 'socio') {
                mensaje = 'No tienes proyectos asignados como Socio. Contacta al administrador.';
            } else {
                mensaje = 'No hay proyectos disponibles.';
            }
            container.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i> ${mensaje}
                    </div>
                </td>
            </tr>
        `;
            return;
        }

        let html = '';
        proyectos.forEach(proyecto => {
            const fechaInicio = proyecto.fecha_inicio ?
                new Date(proyecto.fecha_inicio).toLocaleDateString() : 'No definida';
            const fechaFin = proyecto.fecha_fin ?
                new Date(proyecto.fecha_fin).toLocaleDateString() : 'No definida';

            // Calcular disponibilidad de tiempo
            let diasTotales = 0;
            let diasTranscurridos = 0;
            let diasRestantes = 0;
            let porcentajeTiempo = 0;

            if (proyecto.fecha_inicio && proyecto.fecha_fin) {
                const hoy = new Date();
                const inicioProyecto = new Date(proyecto.fecha_inicio);
                const finProyecto = new Date(proyecto.fecha_fin);
                diasTotales = Math.ceil((finProyecto - inicioProyecto) / (1000 * 60 * 60 * 24));
                diasTranscurridos = Math.ceil((hoy - inicioProyecto) / (1000 * 60 * 60 * 24));
                diasRestantes = Math.max(0, diasTotales - diasTranscurridos);
                porcentajeTiempo = diasTotales > 0 ? Math.min(100, Math.max(0, (diasTranscurridos / diasTotales) * 100)) : 0;
            }

            // Calcular presupuesto disponible
            const presupuestoTotal = parseFloat(proyecto.presupuesto) || 0;
            const porcentajePresupuesto = 0; // Temporal - debería venir del backend
            const presupuestoDisponible = (presupuestoTotal * porcentajePresupuesto) / 100;

            // ========== NUEVA LÓGICA DE BOTONES ==========
            let botonesHTML = '';

            // Botón Abrir (siempre visible para proyectos que el usuario puede ver)
            botonesHTML += `<button class="btn btn-sm btn-primary" onclick="window.controlFlujo.proyectos.abrirProyecto(${proyecto.id})">
                                <i class="fas fa-folder-open"></i> Abrir
                            </button>`;

            // Botón Generar Reporte (visible para todos)
            botonesHTML += `<button class="btn btn-sm btn-info" onclick="window.controlFlujo.generarReporte(${proyecto.id})">
                                <i class="fas fa-file-download"></i> Reporte
                            </button>`;

            // Botón Solicitudes de Compras
            if (userRole === 'coord' || userRole === 'coordinador') {
                botonesHTML += `<button class="btn btn-sm btn-warning" onclick="window.controlFlujo.irSolicitudesCompras(${proyecto.id})">
                                    <i class="fas fa-shopping-cart"></i> Compras
                                </button>`;
            } else if (userRole === 'directivo' && this.proyectosAsignadosIds.includes(proyecto.id)) {
                botonesHTML += `<button class="btn btn-sm btn-warning" onclick="window.controlFlujo.irSolicitudesCompras(${proyecto.id})">
                                    <i class="fas fa-shopping-cart"></i> Compras
                                </button>`;
            }

            // Botones de cerrar/reabrir solo para roles permitidos
            if (mostrarBotonesAccion) {
                if (proyecto.estado === 'Activo') {
                    botonesHTML += `<button class="btn btn-sm btn-warning" onclick="window.controlFlujo.proyectos.cerrarProyecto(${proyecto.id})">
                                        <i class="fas fa-lock"></i>
                                    </button>`;
                } else if (proyecto.estado === 'Completado') {
                    botonesHTML += `<button class="btn btn-sm btn-success" onclick="window.controlFlujo.proyectos.reabrirProyecto(${proyecto.id})">
                                        <i class="fas fa-unlock"></i>
                                    </button>`;
                }
            } else {
                // Para roles restringidos, mostrar mensaje informativo (opcional)
                if (proyecto.estado === 'Activo') {
                    // No se agrega nada adicional
                } else if (proyecto.estado === 'Completado') {
                    // No se agrega nada adicional
                }
            }

            html += `
            <tr class="proyecto-row ${tipo === 'Completados' ? 'table-secondary' : ''}">
                <td>
                    <strong>${proyecto.id}</strong>
                    ${tipo === 'Completados' ? '<br><small class="text-muted"><i class="fas fa-lock"></i> Completado</small>' : ''}
                </td>
                <td>${proyecto.nombre}</td>
                <td>${fechaInicio}</td>
                <td>${fechaFin}</td>
                <td>
                    <span class="badge ${proyecto.estado === 'Activo' ? 'badge-success' :
                    proyecto.estado === 'Completado' ? 'badge-secondary' :
                        proyecto.estado === 'Pausado' ? 'badge-warning' : 'badge-danger'}">
                        <i class="fas ${proyecto.estado === 'Activo' ? 'fa-unlock' : 'fa-lock'}"></i> 
                        <span class="badge-text-dark">${proyecto.estado}</span>
                    </span>
                    ${tipo === 'Completados' ? '<br><small class="text-muted">Finalizado</small>' : ''}
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="flex-grow-1 mr-2">
                            <div class="progress" style="height: 20px;">
                                <div class="progress-bar ${this.cf.getProgressColor(porcentajeTiempo)}" 
                                     style="width: ${porcentajeTiempo}%">
                                    ${porcentajeTiempo.toFixed(1)}%
                                </div>
                            </div>
                            <div class="d-flex justify-content-between mt-1">
                                <small class="text-muted">${diasTranscurridos}d</small>
                                <small class="text-muted">${diasRestantes}d restantes</small>
                            </div>
                        </div>
                        <div class="ml-2 text-center">
                            <small class="d-block text-muted">Presupuesto</small>
                            <span class="badge badge-presupuesto-oscuro">
                                $${presupuestoTotal.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="btn-group">
                        ${botonesHTML}
                    </div>
                </td>
            </tr>
        `;
        });

        container.innerHTML = html;
    }

    async abrirProyecto(id) {
        try {
            const response = await fetch(`api/proyectos.php?action=obtener&id=${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.proyecto) {
                this.cf.proyectoActual = data.proyecto;
                this.mostrarDashboardProyecto();
                await this.cargarDashboardData();
            } else {
                this.cf.ui.mostrarError(data.error || 'Error al abrir el proyecto');
            }
        } catch (error) {
            console.error('Error abriendo proyecto:', error);
            this.cf.ui.mostrarError('No se pudo abrir el proyecto');
        }
    }

    mostrarDashboardProyecto() {
        const listaProyectos = document.getElementById('lista-proyectos');
        const dashboard = document.getElementById('dashboard-proyecto');

        if (listaProyectos) listaProyectos.style.display = 'none';
        if (dashboard) {
            dashboard.style.display = 'block';

            if (this.cf.proyectoActual) {
                const tituloDashboard = document.getElementById('titulo-dashboard');
                if (tituloDashboard) {
                    tituloDashboard.textContent = `Dashboard - ${this.cf.proyectoActual.nombre} (ID: ${this.cf.proyectoActual.id})`;
                }

                // Actualizar ID del proyecto en formularios
                const ingresoProyectoId = document.getElementById('ingreso_proyecto_id');
                const egresoProyectoId = document.getElementById('egreso_proyecto_id');

                if (ingresoProyectoId) ingresoProyectoId.value = this.cf.proyectoActual.id;
                if (egresoProyectoId) egresoProyectoId.value = this.cf.proyectoActual.id;
            }
        }
    }

    async cargarDashboardData() {
        if (!this.cf.proyectoActual) return;

        try {
            await this.cargarResumenFinanciero();
            await this.cf.partidas.cargarPartidas();
            await this.cf.graficos.cargarGraficos();

            // Cargar historial de ajustes de presupuesto
            if (typeof ajustesManager !== 'undefined') {
                ajustesManager.cargarAjustes(this.cf.proyectoActual.id);
            }
        } catch (error) {
            console.error('Error cargando dashboard:', error);
            this.cf.ui.mostrarError('Error al cargar datos del dashboard');
        }
    }

    async cargarResumenFinanciero() {
        if (!this.cf.proyectoActual) return;

        try {
            const response = await fetch(`api/proyectos.php?action=resumen&id=${this.cf.proyectoActual.id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.resumen) {
                this.actualizarResumenUI(data.resumen);
            } else {
                this.cf.ui.mostrarError(data.error || 'Error al cargar resumen financiero');
            }
        } catch (error) {
            console.error('Error cargando resumen:', error);
        }
    }

    actualizarResumenUI(resumen) {
        // Calcular nuevos valores
        const presupuestoTotal = parseFloat(resumen.presupuesto_total) || 0;
        const totalIngresos = parseFloat(resumen.total_ingresos) || 0;
        const totalEgresos = parseFloat(resumen.total_egresos) || 0;

        // NUEVO CÁLCULO: Saldo por Cobrar = Presupuesto Total - Abonos Recibidos
        let saldoPorCobrar = presupuestoTotal - totalIngresos;
        if (saldoPorCobrar < 0) saldoPorCobrar = 0;
        let porcentajeSaldoPorCobrar = presupuestoTotal > 0 ? (saldoPorCobrar / presupuestoTotal) * 100 : 0;
        if (saldoPorCobrar === 0) porcentajeSaldoPorCobrar = 0;

        // NUEVO CÁLCULO: PSC Cost = 7% del Presupuesto Total
        const pscCost = presupuestoTotal * 0.07; // 7% del presupuesto

        // NUEVO CÁLCULO: Valor Integral (Presupuesto Total + PSC Cost)
        const valorIntegral = presupuestoTotal + pscCost;
        const porcentajePSC = 7; // Siempre será 7% del presupuesto total

        // Cálculos existentes...
        const saldoNeto = totalIngresos - totalEgresos;
        const porcentajeSaldoNeto = totalIngresos > 0 ? (saldoNeto / totalIngresos) * 100 : 0;
        const disponibleRestante = presupuestoTotal - totalEgresos;
        const porcentajeDisponible = presupuestoTotal > 0 ? (disponibleRestante / presupuestoTotal) * 100 : 0;
        const porcentajeGastosVsAbonos = totalIngresos > 0 ? (totalEgresos / totalIngresos) * 100 : 0;
        let porcentajeIngresos = presupuestoTotal > 0 ? (totalIngresos / presupuestoTotal) * 100 : 0;
        porcentajeIngresos = Math.min(porcentajeIngresos, 100); // Cap at 100%
        const porcentajeEgresos = presupuestoTotal > 0 ? (totalEgresos / presupuestoTotal) * 100 : 0;

        // Actualizar elementos en el DOM con la NUEVA ESTRUCTURA
        const elementos = {
            // MODIFICADO: Presupuesto total ahora muestra valor integral + desglose
            'presupuesto-total': `
            <div class="badge bg-success">${this.cf.formatearMoneda(valorIntegral, 'USD')} (100%)</div>
            <div class="resumen-desglose">
                <small class="text-muted">
                    <span class="badge bg-success"> ${this.cf.formatearMoneda(presupuestoTotal, 'USD')} (93%)</span>
                </small>
            </div>
        `,
            'abonos-recibidos': `${this.cf.formatearMoneda(totalIngresos, 'USD')} (${porcentajeIngresos.toFixed(1)}%)`,
            'gastos-realizados': `${this.cf.formatearMoneda(totalEgresos, 'USD')} (${porcentajeEgresos.toFixed(1)}%)`,
            'gastos-vs-abonos': `${this.cf.formatearMoneda(totalEgresos, 'USD')} (${porcentajeGastosVsAbonos.toFixed(1)}%)`,
            'disponible-restante': `${this.cf.formatearMoneda(disponibleRestante, 'USD')} (${porcentajeDisponible.toFixed(1)}%)`,
            'saldo-neto': `${this.cf.formatearMoneda(saldoNeto, 'USD')} (${porcentajeSaldoNeto.toFixed(1)}%)`,
            // NUEVOS ELEMENTOS AGREGADOS:
            'cxc': `${this.cf.formatearMoneda(saldoPorCobrar, 'USD')} (${porcentajeSaldoPorCobrar.toFixed(1)}%)`,
            'psc': `${this.cf.formatearMoneda(pscCost, 'USD')} (${porcentajePSC.toFixed(1)}%)`
        };

        Object.keys(elementos).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                // Para el presupuesto total, necesitamos HTML
                if (id === 'presupuesto-total') {
                    element.innerHTML = elementos[id];
                } else {
                    element.textContent = elementos[id];
                }
            }
        });

        // Actualizar barras de progreso con los nuevos valores
        this.actualizarBarrasProgreso({
            porcentaje_ingresos: porcentajeIngresos,
            porcentaje_egresos: porcentajeEgresos,
            porcentaje_disponible: porcentajeDisponible,
            porcentaje_saldo_neto: porcentajeSaldoNeto,
            porcentaje_gastos_vs_abonos: porcentajeGastosVsAbonos,
            // NUEVAS BARRAS AGREGADAS:
            porcentaje_cxc: porcentajeSaldoPorCobrar
        });
    }

    actualizarBarrasProgreso(resumen) {
        const barras = {
            'progreso-ingresos': resumen.porcentaje_ingresos || 0,
            'progreso-egresos': resumen.porcentaje_egresos || 0,
            'progreso-disponible': resumen.porcentaje_disponible || 0,
            'progreso-gastos-vs-abonos': resumen.porcentaje_gastos_vs_abonos || 0,
            // NUEVA BARRA: Saldo por Cobrar
            'progreso-cxc': resumen.porcentaje_cxc || 0
        };

        // Agregar barra de saldo neto si existe el elemento
        if (resumen.porcentaje_saldo_neto) {
            barras['progreso-saldo-neto'] = resumen.porcentaje_saldo_neto;
        }

        Object.keys(barras).forEach(id => {
            const barra = document.getElementById(id);
            if (barra) {
                const width = Math.min(100, Math.max(0, barras[id]));
                barra.style.width = `${width}%`;
                barra.textContent = `${width.toFixed(1)}%`;

                // COLORES ESPECIALES PARA LA NUEVA BARRA DE "GASTOS VS ABONOS"
                if (id === 'progreso-gastos-vs-abonos') {
                    if (width >= 100) {
                        barra.className = 'progress-bar bg-danger';
                    } else if (width >= 80) {
                        barra.className = 'progress-bar bg-warning';
                    } else if (width >= 60) {
                        barra.className = 'progress-bar bg-info';
                    } else {
                        barra.className = 'progress-bar bg-success';
                    }
                }
                // COLORES PARA LA BARRA DE SALDO POR COBRAR
                else if (id === 'progreso-cxc') {
                    if (width >= 50) {
                        barra.className = 'progress-bar bg-warning'; // Mucho por cobrar
                    } else if (width >= 30) {
                        barra.className = 'progress-bar bg-info'; // Moderado por cobrar
                    } else if (width > 0) {
                        barra.className = 'progress-bar bg-success'; // Poco por cobrar
                    } else {
                        barra.className = 'progress-bar bg-secondary'; // Todo cobrado
                    }
                }
            }
        });
    }

    async crearProyecto() {
        try {
            const modalElement = document.getElementById('modal-crear-proyecto');
            if (modalElement && window.bootstrap) {
                const modal = new bootstrap.Modal(modalElement);
                modal.show();
            }
        } catch (error) {
            console.error('Error mostrando modal:', error);
            this.cf.ui.mostrarError('No se pudo abrir el formulario');
        }
    }

    async guardarProyecto() {
        const form = document.getElementById('form-crear-proyecto');
        if (!form) {
            this.cf.ui.mostrarError('Formulario no encontrado');
            return;
        }

        const data = {
            nombre: document.getElementById('nombre')?.value || '',
            descripcion: document.getElementById('descripcion')?.value || '',
            cliente: document.getElementById('cliente')?.value || '',
            fecha_inicio: document.getElementById('fecha_inicio')?.value || '',
            fecha_fin: document.getElementById('fecha_fin')?.value || '',
            presupuesto: parseFloat(document.getElementById('presupuesto')?.value || 0)
        };

        // Validaciones
        if (!data.nombre.trim()) {
            this.cf.ui.mostrarError('El nombre del proyecto es requerido');
            document.getElementById('nombre')?.focus();
            return;
        }

        if (!data.fecha_inicio) {
            this.cf.ui.mostrarError('La fecha de inicio es requerida');
            document.getElementById('fecha_inicio')?.focus();
            return;
        }

        if (!data.fecha_fin) {
            this.cf.ui.mostrarError('La fecha de fin es requerida');
            document.getElementById('fecha_fin')?.focus();
            return;
        }

        if (isNaN(data.presupuesto) || data.presupuesto <= 0) {
            this.cf.ui.mostrarError('El presupuesto debe ser un número mayor a 0');
            document.getElementById('presupuesto')?.focus();
            return;
        }

        const fechaInicio = new Date(data.fecha_inicio);
        const fechaFin = new Date(data.fecha_fin);

        if (fechaFin < fechaInicio) {
            this.cf.ui.mostrarError('La fecha de fin debe ser mayor o igual a la fecha de inicio');
            document.getElementById('fecha_fin')?.focus();
            return;
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        if (fechaInicio < hoy) {
            const confirmar = await Swal.fire({
                title: 'Fecha de inicio en el pasado',
                text: 'La fecha de inicio seleccionada es anterior a hoy. ¿Desea continuar?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, continuar',
                cancelButtonText: 'Cancelar'
            });

            if (!confirmar.isConfirmed) {
                return;
            }
        }

        // Mostrar loading
        const submitBtn = document.getElementById('btn-guardar-proyecto');
        const originalText = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';
            submitBtn.disabled = true;
        }

        try {
            const response = await fetch('api/proyectos.php?action=crear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (submitBtn) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }

            const result = await response.json();

            if (result.success) {
                this.cf.ui.mostrarExito(result.message || 'Proyecto creado correctamente');

                await this.cargarProyectos();

                const modalElement = document.getElementById('modal-crear-proyecto');
                if (modalElement && window.bootstrap) {
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) modal.hide();
                }

                if (form) form.reset();
            } else {
                this.cf.ui.mostrarError(result.error || 'Error al crear el proyecto');
            }
        } catch (error) {
            console.error('Error:', error);
            this.cf.ui.mostrarError('Error de conexión al servidor: ' + error.message);

            if (submitBtn) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    async cerrarProyecto(id) {
        if (await this.cf.ui.confirmarAccion('¿Está seguro de cerrar este proyecto? No se podrán hacer más registros hasta que se reabra.')) {
            try {
                const response = await fetch('api/proyectos.php?action=cerrar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                const result = await response.json();

                if (result.success) {
                    this.cf.ui.mostrarExito('Proyecto cerrado correctamente');
                    await this.cargarProyectos();
                } else {
                    this.cf.ui.mostrarError(result.error);
                }
            } catch (error) {
                this.cf.ui.mostrarError('Error al cerrar proyecto');
            }
        }
    }

    async reabrirProyecto(id) {
        if (await this.cf.ui.confirmarAccion('¿Está seguro de reabrir este proyecto?')) {
            try {
                const response = await fetch('api/proyectos.php?action=reabrir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                const result = await response.json();

                if (result.success) {
                    this.cf.ui.mostrarExito('Proyecto reabierto correctamente');
                    await this.cargarProyectos();
                } else {
                    this.cf.ui.mostrarError(result.error);
                }
            } catch (error) {
                this.cf.ui.mostrarError('Error al reabrir proyecto');
            }
        }
    }
}