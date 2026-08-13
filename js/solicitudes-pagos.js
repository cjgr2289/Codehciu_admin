/**
 * Módulo principal de Solicitudes de Pagos
 * CODEHCIU - Sistema de Finanzas
 * Con soporte para Honorarios/Terceros
 */

const solicitudesPagos = (function () {
    // Configuración
    const config = {
        apiUrl: 'api/'
    };

    // Mapeo de roles normalizados
    const rolNormalizado = {
        'admin': 'admin',
        'administrador': 'admin',
        'contab': 'contab',
        'contador': 'contab',
        'coord': 'coord',
        'coordinador': 'coord',
        'directivo': 'directivo',
        'editor': 'editor',
        'socio': 'socio',
        'regular': 'regular'
    };

    // Estado
    let state = {
        usuarioActual: null,
        solicitudes: [],
        proyectoActual: null,
        filtros: {
            estado: '',
            fechaDesde: '',
            fechaHasta: '',
            busqueda: ''
        }
    };

    // ========== FUNCIONES AUXILIARES ==========
    function formatearFechaLocal(fechaISO) {
        if (!fechaISO) return '';
        const fechaParte = fechaISO.split('T')[0].split(' ')[0];
        const partes = fechaParte.split('-');
        if (partes.length !== 3) return fechaISO;
        const [year, month, day] = partes;
        return `${day}/${month}/${year}`;
    }

    function formatearMonto(monto, moneda = 'USD') {
        const simbolos = { USD: '$', BS: 'Bs.', EUR: '€' };
        return `${simbolos[moneda] || '$'} ${parseFloat(monto || 0).toFixed(2)}`;
    }

    function truncarTexto(texto, max) {
        return texto?.length > max ? texto.substring(0, max) + '...' : texto || '';
    }

    function tieneRol(rolesPermitidos) {
        if (!state.usuarioActual) return false;
        const rolOriginal = state.usuarioActual.role;
        const rolLower = rolOriginal.toLowerCase();
        const rolMap = rolNormalizado[rolLower] || rolLower;
        const rolesPermitidosNormalizados = rolesPermitidos.map(r => {
            const rLower = r.toLowerCase();
            return rolNormalizado[rLower] || rLower;
        });
        return rolesPermitidosNormalizados.includes(rolMap);
    }

    function mostrarError(mensaje) {
        Swal.fire({ icon: 'error', title: 'Error', text: mensaje });
    }

    // ========== FUNCIONES PRINCIPALES ==========

    function inicializar(proyectoId = null) {
        cargarUsuario();

        if (state.usuarioActual) {
            if (proyectoId) {
                state.proyectoActual = proyectoId;
            } else {
                state.proyectoActual = sessionStorage.getItem('proyecto_actual') ||
                    localStorage.getItem('proyecto_actual_pagos');
            }

            if (!state.proyectoActual) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se ha seleccionado ningún proyecto',
                    confirmButtonText: 'Volver'
                }).then(() => {
                    window.location.href = 'control-flujo.html';
                });
                return;
            }

            cargarSolicitudes();
            configurarEventos();
            actualizarUIporRol();
        }
    }

    function cargarUsuario() {
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                state.usuarioActual = JSON.parse(userData);
            } catch (error) {
                console.error('Error al cargar usuario:', error);
            }
        } else {
            window.location.href = 'index.html';
        }
    }

    // ========== CARGAR SOLICITUDES ==========

    async function cargarSolicitudes() {
        try {
            if (!state.proyectoActual) {
                console.error('❌ No hay proyecto actual');
                return;
            }

            const params = new URLSearchParams({
                action: 'listar',
                proyecto_id: state.proyectoActual
            });

            if (state.filtros.estado) params.append('estado', state.filtros.estado);
            if (state.filtros.fechaDesde) params.append('fechaDesde', state.filtros.fechaDesde);
            if (state.filtros.fechaHasta) params.append('fechaHasta', state.filtros.fechaHasta);
            if (state.filtros.busqueda) params.append('busqueda', state.filtros.busqueda);

            const url = `${config.apiUrl}solicitudes_pagos.php?${params}`;
            console.log('📡 URL:', url);

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            
            // Intentar parsear JSON
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('❌ Error parseando JSON:', e);
                console.error('❌ Respuesta:', text.substring(0, 500));
                throw new Error('La respuesta no es JSON válido. Verifica que la API no tenga errores.');
            }

            if (data.success) {
                state.solicitudes = data.solicitudes || [];
                renderizarSolicitudes();
                actualizarResumen();
            } else {
                mostrarError(data.message || 'No se pudieron cargar las solicitudes');
            }
        } catch (error) {
            console.error('❌ Error en cargarSolicitudes:', error);
            mostrarError('Error al cargar solicitudes: ' + error.message);
        }
    }

    // ========== RENDERIZAR TABLA ==========

    function renderizarSolicitudes() {
        const tbody = document.getElementById('tabla-solicitudes-pagos-body');
        if (!tbody) return;

        if (state.solicitudes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center">
                        <div class="alert alert-info mb-0">
                            <i class="fas fa-info-circle"></i> No hay solicitudes de pago para este proyecto
                            ${tieneRol(['admin', 'coord']) ? '<br><button class="btn btn-sm btn-primary mt-2" id="btn-crear-primera-solicitud-pago"><i class="fas fa-plus"></i> Crear primera solicitud</button>' : ''}
                        </div>
                    </td>
                </tr>
            `;
            const btnCrear = document.getElementById('btn-crear-primera-solicitud-pago');
            if (btnCrear) {
                btnCrear.addEventListener('click', () => {
                    if (window.solicitudesPagosModales) {
                        window.solicitudesPagosModales.mostrarNuevaSolicitud(state.proyectoActual);
                    }
                });
            }
            return;
        }

        let html = '';
        state.solicitudes.forEach(solicitud => {
            const estadoBadge = badgeEstado(solicitud.estado);
            const prioridadBadge = badgePrioridad(solicitud.prioridad);
            const honorarioBadge = solicitud.es_honorario ? '<span class="badge bg-info ms-1">Honorarios</span>' : '';

            html += `
                <tr>
                    <td><code class="small">${solicitud.codigo_solicitud}</code> ${honorarioBadge}</td>
                    <td>${formatearFechaLocal(solicitud.fecha_solicitud)}</td>
                    <td>${solicitud.solicitante_nombre || 'N/A'}</td>
                    <td>${solicitud.proyecto_nombre || 'N/A'}</td>
                    <td>${truncarTexto(solicitud.concepto, 35)}</td>
                    <td class="text-end">${formatearMonto(solicitud.monto_solicitado)}</td>
                    <td>${solicitud.beneficiario}</td>
                    <td>${prioridadBadge}</td>
                    <td>${estadoBadge}</td>
                    <td>${botonesAccion(solicitud)}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    function badgeEstado(estado) {
        const clases = {
            'Pendiente': 'badge bg-warning text-dark',
            'En_Revision': 'badge bg-info text-white',
            'Aprobada': 'badge bg-success',
            'Rechazada': 'badge bg-danger',
            'Pagada': 'badge bg-primary',
            'Cerrada': 'badge bg-secondary'
        };
        const texto = estado ? estado.replace('_', ' ') : 'Desconocido';
        return `<span class="${clases[estado] || 'badge bg-secondary'}">${texto}</span>`;
    }

    function badgePrioridad(prioridad) {
        const clases = {
            'Baja': 'badge bg-success',
            'Media': 'badge bg-warning text-dark',
            'Alta': 'badge bg-warning',
            'Urgente': 'badge bg-danger'
        };
        return `<span class="${clases[prioridad] || 'badge bg-secondary'}">${prioridad || 'Media'}</span>`;
    }

    function botonesAccion(solicitud) {
        const estado = solicitud.estado;
        let botones = '';

        botones += `<button class="btn btn-sm btn-info btn-ver-pago" data-id="${solicitud.id}" title="Ver detalles"><i class="fas fa-eye"></i></button>`;

        if (tieneRol(['admin', 'contab']) && estado === 'Pendiente') {
            botones += `<button class="btn btn-sm btn-warning btn-revisar-pago" data-id="${solicitud.id}" title="Revisar"><i class="fas fa-check-circle"></i></button>`;
        }

        if (tieneRol(['admin', 'contab']) && estado === 'Aprobada') {
            botones += `<button class="btn btn-sm btn-success btn-registrar-pago-pago" data-id="${solicitud.id}" title="Registrar pago"><i class="fas fa-money-bill-wave"></i></button>`;
        }

        if (tieneRol(['admin', 'contab']) && estado === 'Pagada') {
            botones += `<button class="btn btn-sm btn-secondary btn-cerrar-pago" data-id="${solicitud.id}" title="Cerrar solicitud"><i class="fas fa-lock"></i></button>`;
        }

        return `<div class="btn-group btn-group-sm">${botones}</div>`;
    }

    // ========== ACTUALIZAR RESUMEN ==========

    function actualizarResumen() {
        const resumen = { Pendiente: 0, En_Revision: 0, Aprobada: 0, Rechazada: 0, Pagada: 0, Cerrada: 0 };
        state.solicitudes.forEach(s => {
            if (resumen.hasOwnProperty(s.estado)) resumen[s.estado]++;
        });

        const pend = document.getElementById('resumen-pendientes-pagos');
        const rev = document.getElementById('resumen-revision-pagos');
        const aprob = document.getElementById('resumen-aprobadas-pagos');
        const pag = document.getElementById('resumen-pagadas-pagos');

        if (pend) pend.textContent = resumen.Pendiente;
        if (rev) rev.textContent = resumen.En_Revision;
        if (aprob) aprob.textContent = resumen.Aprobada;
        if (pag) pag.textContent = resumen.Pagada;
    }

    // ========== EVENTOS ==========

    function configurarEventos() {
        document.getElementById('btn-aplicar-filtros-pagos')?.addEventListener('click', aplicarFiltros);
        document.getElementById('btn-limpiar-filtros-pagos')?.addEventListener('click', limpiarFiltros);
        document.getElementById('buscador-solicitudes-pagos')?.addEventListener('keyup', e => { if (e.key === 'Enter') aplicarFiltros(); });
        document.addEventListener('click', manejarClicks);
    }

    function manejarClicks(e) {
        const target = e.target.closest('button');
        if (!target) return;
        const id = target.dataset.id;

        if (target.classList.contains('btn-ver-pago')) {
            e.preventDefault();
            verDetallesSolicitud(id);
        } else if (target.classList.contains('btn-revisar-pago')) {
            e.preventDefault();
            mostrarModalAprobacion(id);
        } else if (target.classList.contains('btn-registrar-pago-pago')) {
            e.preventDefault();
            mostrarModalPago(id);
        } else if (target.classList.contains('btn-cerrar-pago')) {
            e.preventDefault();
            mostrarModalCierre(id);
        }
    }

    function aplicarFiltros() {
        state.filtros = {
            estado: document.getElementById('filtro-estado-pagos')?.value || '',
            fechaDesde: document.getElementById('filtro-fecha-desde-pagos')?.value || '',
            fechaHasta: document.getElementById('filtro-fecha-hasta-pagos')?.value || '',
            busqueda: document.getElementById('buscador-solicitudes-pagos')?.value || ''
        };
        cargarSolicitudes();
    }

    function limpiarFiltros() {
        document.getElementById('filtro-estado-pagos').value = '';
        document.getElementById('filtro-fecha-desde-pagos').value = '';
        document.getElementById('filtro-fecha-hasta-pagos').value = '';
        document.getElementById('buscador-solicitudes-pagos').value = '';
        state.filtros = { estado: '', fechaDesde: '', fechaHasta: '', busqueda: '' };
        cargarSolicitudes();
    }

    function actualizarUIporRol() {
        const btnNueva = document.getElementById('btn-nueva-solicitud-pago');
        const puedeCrear = tieneRol(['admin', 'coord']);
        if (btnNueva) btnNueva.style.display = puedeCrear ? 'inline-block' : 'none';
    }

    // ========== FUNCIONES PARA MODALES ==========

    function verDetallesSolicitud(id) {
        if (window.solicitudesPagosModales) {
            window.solicitudesPagosModales.verDetalles(id);
        }
    }

    function mostrarModalAprobacion(id) {
        if (window.solicitudesPagosModales) {
            window.solicitudesPagosModales.mostrarAprobacion(id);
        }
    }

    function mostrarModalPago(id) {
        if (window.solicitudesPagosModales) {
            window.solicitudesPagosModales.mostrarPago(id);
        }
    }

    function mostrarModalCierre(id) {
        if (window.solicitudesPagosModales) {
            window.solicitudesPagosModales.mostrarCierre(id);
        }
    }

    // ========== API PÚBLICA ==========

    return {
        inicializar,
        cargarSolicitudes,
        tieneRol,
        getUsuarioActual: () => state.usuarioActual,
        getSolicitudes: () => state.solicitudes,
        getProyectoActual: () => state.proyectoActual,
        formatearMonto,
        formatearFecha: formatearFechaLocal
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    window.solicitudesPagos = solicitudesPagos;
});