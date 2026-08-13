/**
 * Módulo principal de Solicitudes de Compras
 * CODEHCIU - Sistema de Finanzas
 * Siguiendo el Manual de Codificación Documental CODEHCIU
 * Con soporte para Servicios y Compras
 */

const solicitudesCompras = (function () {
    // Configuración
    const config = {
        apiUrl: 'api/',
        roles: {
            admin: ['admin', 'administrador'],
            coord: ['coord', 'coordinador'],
            contab: ['contab', 'contador'],
            directivo: ['directivo']
        }
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

    // Estado de la aplicación
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

    // ========== FUNCIÓN AUXILIAR PARA FORMATEAR FECHAS SIN ZONA HORARIA ==========
    /**
     * Formatea una fecha en formato ISO (YYYY-MM-DD) a string DD/MM/YYYY
     * Sin usar Date() para evitar problemas de zona horaria (Venezuela UTC-4)
     */
    function formatearFechaLocal(fechaISO) {
        if (!fechaISO) return '';

        // Extraer solo la parte de la fecha (YYYY-MM-DD)
        const fechaParte = fechaISO.split('T')[0].split(' ')[0];
        const partes = fechaParte.split('-');

        if (partes.length !== 3) return fechaISO;

        const year = partes[0];
        const month = partes[1];
        const day = partes[2];

        return `${day}/${month}/${year}`;
    }

    // ========== FUNCIONES PRINCIPALES ==========

    function inicializar(proyectoId = null) {
        cargarUsuario();

        if (state.usuarioActual) {
            if (proyectoId) {
                state.proyectoActual = proyectoId;
            } else {
                state.proyectoActual = sessionStorage.getItem('proyecto_actual') ||
                    localStorage.getItem('proyecto_actual_solicitudes');
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

            const url = `${config.apiUrl}solicitudes_compras.php?${params}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

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
        const tbody = document.getElementById('tabla-solicitudes-body');
        if (!tbody) return;

        if (state.solicitudes.length === 0) {
            tbody.innerHTML = `
                 <tr>
                    <td colspan="10" class="text-center">
                        <div class="alert alert-info mb-0">
                            <i class="fas fa-info-circle"></i> No hay solicitudes para este proyecto
                            <br>
                            <strong>Proyecto ID: ${state.proyectoActual}</strong>
                            <br>
                            <small class="text-muted">
                                Las solicitudes se codifican según Manual CODEHCIU: CMP-CGE-SOL-AÑO-XXXXXX (6 dígitos)
                            </small>
                            ${tieneRol(['admin', 'coord']) ? '<br><button class="btn btn-sm btn-primary mt-2" id="btn-crear-primera-solicitud"><i class="fas fa-plus"></i> Crear primera solicitud</button>' : ''}
                        </div>
                    </table>
                  </tr>
            `;

            const btnCrear = document.getElementById('btn-crear-primera-solicitud');
            if (btnCrear) {
                btnCrear.addEventListener('click', () => {
                    if (window.solicitudesModales) {
                        window.solicitudesModales.mostrarNuevaSolicitud(state.proyectoActual);
                    }
                });
            }
            return;
        }

        let html = '';
        state.solicitudes.forEach(solicitud => {
            const tipoBadge = solicitud.tipo_solicitud === 'servicio'
                ? '<span class="badge bg-info">Servicio</span>'
                : '<span class="badge bg-primary">Compra</span>';

            const ocBadge = solicitud.codigo_oc
                ? `<span class="badge bg-secondary ms-1" title="Orden de Compra">OC</span>`
                : '';

            const codigoFormateado = `
                <code class="small" style="font-size: 11px; background: #f8f9fa; padding: 2px 4px; border-radius: 3px;">
                    ${solicitud.codigo_solicitud}
                </code>
                ${ocBadge}
            `;

            html += `
                <tr>
                    <td><strong>${codigoFormateado}</strong></td>
                    <td>${formatearFechaLocal(solicitud.fecha_solicitud)}</td>
                    <td>${solicitud.solicitante_nombre || 'N/A'}</td>
                    <td>${solicitud.proyecto_nombre || 'N/A'}</td>
                    <td>${truncarTexto(solicitud.descripcion, 40)}</td>
                    <td class="text-end">${formatearMonto(solicitud.monto_estimado, solicitud.moneda)}</td>
                    <td>${tipoBadge}</td>
                    <td>${badgePrioridad(solicitud.prioridad)}</td>
                    <td>${badgeEstado(solicitud.estado)}</td>
                    <td>${botonesAccion(solicitud)}</td>
                 </tr>
            `;
        });
        tbody.innerHTML = html;
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

    // ========== BOTONES DE ACCIÓN ==========

    function botonesAccion(solicitud) {
        const estado = solicitud.estado;
        const tipo = solicitud.tipo_solicitud;
        const tieneOC = solicitud.codigo_oc;
        let botones = '';

        botones += `<button class="btn btn-sm btn-info btn-ver-solicitud" data-id="${solicitud.id}" title="Ver detalles"><i class="fas fa-eye"></i></button>`;

        if (tieneRol(['admin', 'contab']) && estado === 'Pendiente') {
            botones += `<button class="btn btn-sm btn-warning btn-revisar-solicitud" data-id="${solicitud.id}" title="Revisar"><i class="fas fa-check-circle"></i></button>`;
        }

        if (tieneRol(['admin', 'directivo']) && estado === 'Aprobada') {
            botones += `<button class="btn btn-sm btn-success btn-registrar-pago" data-id="${solicitud.id}" title="Registrar pago"><i class="fas fa-money-bill-wave"></i></button>`;
        }

        if (tieneOC && (estado === 'Aprobada' || estado === 'Pagada' || estado === 'Cerrada')) {
            botones += `<button class="btn btn-sm btn-dark btn-ver-oc" data-id="${solicitud.id}" title="Ver Orden de Compra"><i class="fas fa-file-alt"></i></button>`;
        }

        if (tieneRol(['admin', 'contab']) && estado === 'Pagada') {
            botones += `<button class="btn btn-sm btn-secondary btn-cerrar-solicitud" data-id="${solicitud.id}" title="Cerrar solicitud"><i class="fas fa-lock"></i></button>`;
        }

        return `<div class="btn-group btn-group-sm">${botones}</div>`;
    }

    // ========== ACTUALIZAR RESUMEN ==========

    function actualizarResumen() {
        const resumen = { Pendiente: 0, En_Revision: 0, Aprobada: 0, Rechazada: 0, Pagada: 0, Cerrada: 0 };
        state.solicitudes.forEach(s => {
            if (resumen.hasOwnProperty(s.estado)) resumen[s.estado]++;
        });

        const pend = document.getElementById('resumen-pendientes');
        const rev = document.getElementById('resumen-revision');
        const aprob = document.getElementById('resumen-aprobadas');
        const pag = document.getElementById('resumen-pagadas');

        if (pend) pend.textContent = resumen.Pendiente;
        if (rev) rev.textContent = resumen.En_Revision;
        if (aprob) aprob.textContent = resumen.Aprobada;
        if (pag) pag.textContent = resumen.Pagada;
    }

    // ========== EVENTOS ==========

    function configurarEventos() {
        document.getElementById('btn-aplicar-filtros')?.addEventListener('click', aplicarFiltros);
        document.getElementById('btn-limpiar-filtros')?.addEventListener('click', limpiarFiltros);
        document.getElementById('buscador-solicitudes')?.addEventListener('keyup', e => { if (e.key === 'Enter') aplicarFiltros(); });
        document.addEventListener('click', manejarClicks);

        document.getElementById('btn-gestionar-proveedores')?.addEventListener('click', () => {
            if (window.solicitudesModales) {
                window.solicitudesModales.mostrarModalProveedores();
            }
        });
    }

    function manejarClicks(e) {
        const target = e.target.closest('button');
        if (!target) return;
        const id = target.dataset.id;

        if (target.classList.contains('btn-ver-solicitud')) {
            e.preventDefault();
            verDetallesSolicitud(id);
        } else if (target.classList.contains('btn-revisar-solicitud')) {
            e.preventDefault();
            mostrarModalAprobacion(id);
        } else if (target.classList.contains('btn-registrar-pago')) {
            e.preventDefault();
            mostrarModalPago(id);
        } else if (target.classList.contains('btn-cerrar-solicitud')) {
            e.preventDefault();
            mostrarModalCierre(id);
        } else if (target.classList.contains('btn-ver-oc')) {
            e.preventDefault();
            if (window.solicitudesModales && window.solicitudesModales.mostrarReporteOC) {
                window.solicitudesModales.mostrarReporteOC(id);
            } else {
                console.error('❌ mostrarReporteOC no disponible');
                Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el reporte' });
            }
        }
    }

    function aplicarFiltros() {
        state.filtros = {
            estado: document.getElementById('filtro-estado')?.value || '',
            fechaDesde: document.getElementById('filtro-fecha-desde')?.value || '',
            fechaHasta: document.getElementById('filtro-fecha-hasta')?.value || '',
            busqueda: document.getElementById('buscador-solicitudes')?.value || ''
        };
        cargarSolicitudes();
    }

    function limpiarFiltros() {
        document.getElementById('filtro-estado').value = '';
        document.getElementById('filtro-fecha-desde').value = '';
        document.getElementById('filtro-fecha-hasta').value = '';
        document.getElementById('buscador-solicitudes').value = '';
        state.filtros = { estado: '', fechaDesde: '', fechaHasta: '', busqueda: '' };
        cargarSolicitudes();
    }

    function actualizarUIporRol() {
        const btnNueva = document.getElementById('btn-nueva-solicitud');
        const btnProveedores = document.getElementById('btn-gestionar-proveedores');
        const puedeCrear = tieneRol(['admin', 'coord']);
        const puedeGestionar = tieneRol(['admin', 'contab']);

        if (btnNueva) btnNueva.style.display = puedeCrear ? 'inline-block' : 'none';
        if (btnProveedores) btnProveedores.style.display = puedeGestionar ? 'inline-block' : 'none';
    }

    // ========== FUNCIONES AUXILIARES ==========

    function formatearMonto(monto, moneda = 'USD') {
        const simbolos = { USD: '$', BS: 'Bs.', EUR: '€' };
        return `${simbolos[moneda] || '$'} ${parseFloat(monto || 0).toFixed(2)}`;
    }

    function truncarTexto(texto, max) {
        return texto?.length > max ? texto.substring(0, max) + '...' : texto || '';
    }

    function mostrarError(mensaje) {
        Swal.fire({ icon: 'error', title: 'Error', text: mensaje });
    }

    // ========== FUNCIONES PARA MODALES ==========

    function verDetallesSolicitud(id) {
        if (window.solicitudesModales) {
            window.solicitudesModales.verDetalles(id);
        }
    }

    function mostrarModalAprobacion(id) {
        if (window.solicitudesModales) {
            window.solicitudesModales.mostrarAprobacion(id);
        }
    }

    function mostrarModalPago(id) {
        if (window.solicitudesModales) {
            window.solicitudesModales.mostrarPago(id);
        }
    }

    function mostrarModalCierre(id) {
        if (window.solicitudesModales) {
            window.solicitudesModales.mostrarCierre(id);
        }
    }

    function mostrarReporteOC(id) {
        if (window.solicitudesModales) {
            window.solicitudesModales.mostrarReporteOC(id);
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
        formatearFecha: formatearFechaLocal  // <-- Exportamos la nueva función
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    window.solicitudesCompras = solicitudesCompras;
});