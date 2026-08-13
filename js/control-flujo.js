// control-flujo.js - Archivo principal
class ControlFlujo {
    constructor() {
        this.proyectoActual = null;
        this.charts = {};
        this.cuentasCache = [];
        this.proyectosCache = [];
        this.partidasCache = [];
        this.usuarioActual = this.obtenerUsuarioActual(); // Nuevo: usuario actual

        // Inicializar módulos
        this.proyectos = new ProyectosManager(this);
        this.transacciones = new TransaccionesManager(this);
        this.abonos = new AbonosManager(this);
        this.cuentas = new CuentasManager(this);
        this.graficos = new GraficosManager(this);
        this.ui = new UIManager(this);
        this.partidas = new PartidasManager(this);

        // Vincular métodos del módulo de partidas
        this.partidas.mostrarModalReasignarPresupuesto = this.partidas.mostrarModalReasignarPresupuesto.bind(this.partidas);
        this.partidas.ajustarPresupuesto = this.partidas.ajustarPresupuesto.bind(this.partidas);
        this.partidas.ajustarPresupuestoSimple = this.partidas.ajustarPresupuestoSimple.bind(this.partidas);
        this.partidas.ejecutarReasignacion = this.partidas.ejecutarReasignacion.bind(this.partidas);
        this.partidas.validarMontoEnTiempoReal = this.partidas.validarMontoEnTiempoReal.bind(this.partidas);

        this.init();
    }

    async init() {
        try {
            await this.proyectos.cargarProyectos();
            await this.cuentas.cargarResumenCuentas();
            this.ui.configurarEventos();
            this.ui.configurarModales();
            this.configurarEventosGlobales();
        } catch (error) {
            console.error('Error inicializando ControlFlujo:', error);
            this.ui.mostrarError('Error al inicializar la aplicación');
        }
    }

    // NUEVO: Configurar eventos globales
    configurarEventosGlobales() {
        // Botón global para reasignación de presupuesto (si existe)
        const btnReasignarGlobal = document.getElementById('btn-reasignar-presupuesto-global');
        if (btnReasignarGlobal) {
            btnReasignarGlobal.addEventListener('click', () => {
                this.partidas.mostrarModalReasignarPresupuesto();
            });
        }

        // Botón global para ajuste simple
        const btnAjusteGlobal = document.getElementById('btn-ajuste-presupuesto-global');
        if (btnAjusteGlobal) {
            btnAjusteGlobal.addEventListener('click', () => {
                // Pedir ID de partida o mostrar lista
                Swal.fire({
                    title: 'Ajustar Presupuesto',
                    text: 'Ingrese el ID de la partida a ajustar:',
                    input: 'number',
                    inputPlaceholder: 'ID de partida',
                    showCancelButton: true,
                    confirmButtonText: 'Continuar',
                    cancelButtonText: 'Cancelar',
                    preConfirm: (partidaId) => {
                        if (!partidaId) {
                            Swal.showValidationMessage('Ingrese un ID válido');
                            return false;
                        }
                        return partidaId;
                    }
                }).then((result) => {
                    if (result.isConfirmed && result.value) {
                        this.partidas.ajustarPresupuesto(parseInt(result.value));
                    }
                });
            });
        }

        // Escuchar cambios en el proyecto actual para refrescar partidas
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-proyecto') {
                    // Refrescar partidas cuando cambia el proyecto
                    setTimeout(() => {
                        this.partidas.cargarPartidas();
                    }, 500);
                }
            });
        });

        // Observar el contenedor de proyecto si existe
        const proyectoContainer = document.getElementById('proyecto-actual-container');
        if (proyectoContainer) {
            observer.observe(proyectoContainer, { attributes: true });
        }
    }

    // NUEVO: Obtener usuario actual (simulado - implementar según tu sistema)
    obtenerUsuarioActual() {
        // Intentar obtener del localStorage o sesión
        let usuario = null;

        try {
            const usuarioData = localStorage.getItem('usuario_actual');
            if (usuarioData) {
                usuario = JSON.parse(usuarioData);
            }
        } catch (error) {
            console.warn('No se pudo obtener usuario del localStorage');
        }

        // Si no hay usuario en localStorage, usar uno por defecto
        if (!usuario) {
            usuario = {
                id: 1,
                nombre: 'Administrador',
                email: 'admin@sistema.com',
                rol: 'admin'
            };

            // Guardar para futuras sesiones
            try {
                localStorage.setItem('usuario_actual', JSON.stringify(usuario));
            } catch (error) {
                console.warn('No se pudo guardar usuario en localStorage');
            }
        }

        return usuario;
    }

    // NUEVO: Actualizar usuario actual
    actualizarUsuarioActual(usuarioData) {
        this.usuarioActual = usuarioData;

        try {
            localStorage.setItem('usuario_actual', JSON.stringify(usuarioData));
        } catch (error) {
            console.warn('No se pudo actualizar usuario en localStorage');
        }

        // Disparar evento personalizado
        const event = new CustomEvent('usuarioActualizado', { detail: usuarioData });
        document.dispatchEvent(event);
    }

    // NUEVO: Método para obtener información del usuario para operaciones
    obtenerInfoUsuario() {
        return {
            id: this.usuarioActual?.id || 1,
            nombre: this.usuarioActual?.nombre || 'Usuario',
            email: this.usuarioActual?.email || 'usuario@sistema.com',
            rol: this.usuarioActual?.rol || 'user'
        };
    }

    // NUEVO: Validar permisos de usuario
    tienePermiso(permisoRequerido) {
        const usuario = this.usuarioActual;

        if (!usuario) return false;

        // Permisos por rol (puedes expandir esto según tu sistema)
        const permisosPorRol = {
            'admin': ['crear_proyecto', 'editar_proyecto', 'eliminar_proyecto',
                'crear_partida', 'editar_partida', 'eliminar_partida',
                'registrar_egreso', 'registrar_ingreso', 'ajustar_presupuesto',
                'reasignar_presupuesto', 'ver_todo'],
            'gerente': ['crear_partida', 'editar_partida', 'registrar_egreso',
                'registrar_ingreso', 'ajustar_presupuesto', 'reasignar_presupuesto',
                'ver_todo'],
            'contador': ['registrar_egreso', 'registrar_ingreso', 'ver_todo'],
            'user': ['ver_proyectos', 'ver_partidas']
        };

        const rol = usuario.rol || 'user';
        const permisos = permisosPorRol[rol] || permisosPorRol['user'];

        return permisos.includes(permisoRequerido) || permisos.includes('ver_todo');
    }

    // NUEVO: Mostrar modal de permisos si no tiene acceso
    verificarPermiso(permisoRequerido, accion) {
        if (!this.tienePermiso(permisoRequerido)) {
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: `No tiene permisos para ${accion}. Contacte al administrador.`,
                confirmButtonText: 'Aceptar'
            });
            return false;
        }
        return true;
    }

    // Métodos de conveniencia para acceso rápido
    getProgressColor(percentage) {
        if (percentage >= 90) return 'bg-danger';
        if (percentage >= 75) return 'bg-warning';
        if (percentage >= 50) return 'bg-info';
        return 'bg-success';
    }

    formatearMoneda(monto, moneda) {
        const simbolos = {
            'USD': 'US$ ',
            'BS': 'Bs. ',
            'EUR': '€ '
        };

        const simbolo = simbolos[moneda] || '$';
        return `${simbolo}${parseFloat(monto).toLocaleString('es-VE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    formatearFecha(fechaString) {
        if (!fechaString) return 'Fecha no disponible';

        try {
            const fecha = new Date(fechaString);
            return fecha.toLocaleDateString('es-VE');
        } catch (error) {
            return fechaString;
        }
    }

    parsearMonto(valor) {
        if (!valor) return 0;

        // Reemplazar comas por puntos y quitar caracteres no numéricos
        const valorLimpio = valor.toString()
            .replace(',', '.')
            .replace(/[^\d.-]/g, '');

        const monto = parseFloat(valorLimpio);
        return isNaN(monto) ? 0 : monto;
    }

    // NUEVO: Método para formatear números con separadores de miles
    formatearNumero(numero, decimales = 2) {
        if (numero === null || numero === undefined || isNaN(numero)) {
            return '0.00';
        }

        return parseFloat(numero).toLocaleString('es-VE', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        });
    }

    // NUEVO: Método para calcular porcentaje
    calcularPorcentaje(parte, total) {
        if (!total || total === 0) return 0;
        return (parte / total) * 100;
    }

    // NUEVO: Método para obtener resumen financiero rápido
    obtenerResumenFinanciero() {
        if (!this.proyectoActual) {
            return {
                total_asignado: 0,
                total_gastado: 0,
                total_disponible: 0,
                porcentaje_gastado: 0,
                porcentaje_disponible: 100
            };
        }

        // Calcular sumas de partidas
        let totalAsignado = 0;
        let totalGastado = 0;

        this.partidasCache.forEach(partida => {
            totalAsignado += parseFloat(partida.presupuesto_asignado) || 0;
            totalGastado += parseFloat(partida.total_gastado_real) || 0;
        });

        const totalDisponible = totalAsignado - totalGastado;
        const porcentajeGastado = totalAsignado > 0 ? (totalGastado / totalAsignado) * 100 : 0;
        const porcentajeDisponible = 100 - porcentajeGastado;

        return {
            total_asignado: totalAsignado,
            total_gastado: totalGastado,
            total_disponible: totalDisponible,
            porcentaje_gastado: porcentajeGastado,
            porcentaje_disponible: porcentajeDisponible
        };
    }

    // NUEVO: Método para refrescar todos los datos
    async refrescarDatosCompletos() {
        try {
            // Mostrar loading
            this.ui.mostrarLoading(true, 'Actualizando datos...');

            // Refrescar en paralelo
            await Promise.all([
                this.proyectos.cargarProyectos(),
                this.cuentas.cargarResumenCuentas(),
                this.partidas.cargarPartidas(),
                this.graficos.cargarGraficos()
            ]);

            // Si hay proyecto actual, cargar su resumen
            if (this.proyectoActual) {
                await this.proyectos.cargarResumenFinanciero();
            }

            this.ui.mostrarLoading(false);
            this.ui.mostrarExito('Datos actualizados correctamente');

        } catch (error) {
            console.error('Error refrescando datos:', error);
            this.ui.mostrarLoading(false);
            this.ui.mostrarError('Error al actualizar datos');
        }
    }

    // NUEVO: Método para exportar datos
    exportarDatos(formato = 'excel') {
        if (!this.proyectoActual) {
            this.ui.mostrarError('No hay proyecto seleccionado');
            return;
        }

        // Preparar datos según formato
        let datos = {};

        switch (formato) {
            case 'excel':
                datos = this.prepararDatosExcel();
                break;
            case 'pdf':
                datos = this.prepararDatosPDF();
                break;
            case 'json':
                datos = this.prepararDatosJSON();
                break;
            default:
                this.ui.mostrarError('Formato no soportado');
                return;
        }

        // Aquí iría la lógica de exportación real
        console.log(`Exportando datos en formato ${formato}:`, datos);

        // Por ahora solo mostramos un mensaje
        this.ui.mostrarExito(`Datos preparados para exportación en formato ${formato.toUpperCase()}`);
    }

    // NUEVO: Preparar datos para Excel
    prepararDatosExcel() {
        const resumen = this.obtenerResumenFinanciero();
        const fecha = new Date().toISOString().split('T')[0];

        return {
            proyecto: this.proyectoActual.nombre,
            fecha_exportacion: fecha,
            resumen: resumen,
            partidas: this.partidasCache,
            transacciones_recientes: [] // Podrías agregar transacciones aquí
        };
    }

    // NUEVO: Preparar datos para PDF
    prepararDatosPDF() {
        return this.prepararDatosExcel(); // Por ahora es el mismo
    }

    // NUEVO: Preparar datos para JSON
    prepararDatosJSON() {
        return {
            proyecto: this.proyectoActual,
            resumen_financiero: this.obtenerResumenFinanciero(),
            partidas: this.partidasCache,
            metadata: {
                exportado_el: new Date().toISOString(),
                usuario: this.obtenerInfoUsuario(),
                version_sistema: '1.0.0'
            }
        };
    }

    // NUEVO: Método para buscar partidas
    buscarPartidas(termino) {
        if (!termino || !this.partidasCache.length) {
            return this.partidasCache;
        }

        const terminoLower = termino.toLowerCase();

        return this.partidasCache.filter(partida => {
            return (
                (partida.codigo && partida.codigo.toLowerCase().includes(terminoLower)) ||
                (partida.nombre && partida.nombre.toLowerCase().includes(terminoLower)) ||
                (partida.descripcion && partida.descripcion.toLowerCase().includes(terminoLower))
            );
        });
    }

    // NUEVO: Método para filtrar partidas por estado
    filtrarPartidasPorEstado(estado) {
        if (!this.partidasCache.length) return [];

        const resumen = this.obtenerResumenFinanciero();

        return this.partidasCache.filter(partida => {
            const asignado = parseFloat(partida.presupuesto_asignado) || 0;
            const gastado = parseFloat(partida.total_gastado_real) || 0;
            const porcentajeGastado = asignado > 0 ? (gastado / asignado) * 100 : 0;

            switch (estado) {
                case 'saludable':
                    return porcentajeGastado < 50;
                case 'advertencia':
                    return porcentajeGastado >= 50 && porcentajeGastado < 75;
                case 'peligro':
                    return porcentajeGastado >= 75 && porcentajeGastado < 90;
                case 'sobrepasado':
                    return porcentajeGastado >= 90 || gastado > asignado;
                default:
                    return true;
            }
        });
    }

    // ============================================
    // NUEVOS MÉTODOS PARA REPORTE Y SOLICITUDES DE COMPRAS
    // ============================================

    /**
     * Genera un reporte del proyecto especificado
     * @param {number} proyectoId - ID del proyecto
     */
    async generarReporte(proyectoId) {
        const originalProyecto = this.proyectoActual;
        try {
            const response = await fetch(`api/proyectos.php?action=obtener&id=${proyectoId}`);
            const data = await response.json();
            if (data.success) {
                this.proyectoActual = data.proyecto;
                // Mostrar el modal de reporte
                if (this.ui && typeof this.ui.mostrarModalReporte === 'function') {
                    this.ui.mostrarModalReporte();
                } else {
                    // Fallback: abrir modal manualmente
                    const modalReporte = document.getElementById('modal-generar-reporte');
                    if (modalReporte && typeof bootstrap !== 'undefined') {
                        const modal = new bootstrap.Modal(modalReporte);
                        modal.show();
                        // Actualizar el nombre del proyecto en el modal
                        const previewNombre = document.getElementById('preview-nombre-proyecto');
                        if (previewNombre) {
                            previewNombre.textContent = this.proyectoActual.nombre;
                        }
                        // Cargar datos del reporte si existe la función
                        if (typeof this.cargarDatosReporte === 'function') {
                            await this.cargarDatosReporte(proyectoId);
                        }
                    } else {
                        Swal.fire({
                            icon: 'info',
                            title: 'Reporte',
                            text: `Generando reporte para el proyecto: ${this.proyectoActual.nombre}`,
                            confirmButtonText: 'Aceptar'
                        });
                    }
                }
            } else {
                this.ui.mostrarError('No se pudo cargar el proyecto para el reporte');
            }
        } catch (error) {
            console.error('Error generando reporte:', error);
            this.ui.mostrarError('Error al generar reporte');
        } finally {
            // Restaurar el proyecto actual si había uno
            this.proyectoActual = originalProyecto;
        }
    }

    /**
     * Redirige a la página de solicitudes de compras para un proyecto
     * @param {number} proyectoId - ID del proyecto
     */
    irSolicitudesCompras(proyectoId) {
        localStorage.setItem('proyecto_actual', proyectoId);
        localStorage.setItem('proyecto_actual_solicitudes', proyectoId);
        sessionStorage.setItem('proyecto_actual', proyectoId);
        window.location.href = `solicitudes-compras.html?proyecto_id=${proyectoId}`;
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.controlFlujo = new ControlFlujo();

    // Exponer métodos globales adicionales
    window.reasignarPresupuesto = (partidaId = null) => {
        if (window.controlFlujo && window.controlFlujo.partidas) {
            window.controlFlujo.partidas.mostrarModalReasignarPresupuesto(partidaId);
        }
    };

    window.ajustarPresupuesto = (partidaId) => {
        if (window.controlFlujo && window.controlFlujo.partidas) {
            window.controlFlujo.partidas.ajustarPresupuesto(partidaId);
        }
    };

    window.refrescarPartidas = () => {
        if (window.controlFlujo && window.controlFlujo.partidas) {
            window.controlFlujo.partidas.refrescarValoresPartidas();
        }
    };

    window.verDetallesPartida = (partidaId) => {
        if (window.controlFlujo && window.controlFlujo.partidas) {
            window.controlFlujo.partidas.verDetallesPartida(partidaId);
        }
    };
});