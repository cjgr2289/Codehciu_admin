/**
 * Módulo de Gestión de Ajustes de Presupuesto
 */
const ajustesManager = {
    proyecto_id: null,
    ajustes: [],

    /**
     * Inicializar el módulo
     */
    init: function () {
      //  console.log('Inicializando ajustesManager...');
    },

    /**
     * Cargar ajustes del proyecto
     */
    cargarAjustes: function (proyecto_id) {
        this.proyecto_id = proyecto_id;
        const container = document.getElementById('ajustes-historial');

        if (!container) {
            console.warn('Contenedor de ajustes no encontrado');
            return;
        }

        // Mostrar cargando
        container.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
                <p class="mt-2">Cargando historial de ajustes...</p>
            </div>
        `;

        fetch(`api/ajustes-presupuesto.php?action=obtener&proyecto_id=${proyecto_id}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(text => {
                // Validar que sea JSON válido
                try {
                    const data = JSON.parse(text);
                    if (data.success) {
                        this.ajustes = data.ajustes || [];
                        this.renderizarAjustes();
                    } else {
                        container.innerHTML = `
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle"></i>
                                ${data.error || 'No hay ajustes registrados para este proyecto'}
                            </div>
                        `;
                    }
                } catch (e) {
                    console.error('Error parseando JSON:', e);
                    console.error('Respuesta recibida:', text.substring(0, 200));
                    container.innerHTML = `
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle"></i>
                            No hay ajustes de presupuesto registrados para este proyecto.
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Error cargando ajustes:', error);
                container.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        No hay ajustes de presupuesto registrados para este proyecto.
                    </div>
                `;
            });
    },

    /**
     * Renderizar la tabla de ajustes
     */
    renderizarAjustes: function () {
        const container = document.getElementById('ajustes-historial');

        if (!container) return;

        if (this.ajustes.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    No hay ajustes de presupuesto registrados para este proyecto.
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-responsive ajustes-table-container">
                <table class="table table-striped table-hover tabla-ajustes" style="font-size: 0.875rem;">
                    <thead class="table-light">
                        <tr>
                            <th class="py-2 text-center">Fecha</th>
                            <th class="py-2 text-center">Partida</th>
                            <th class="py-2 text-center">Tipo</th>
                            <th class="py-2 text-center">Monto Anterior</th>
                            <th class="py-2 text-center">Monto Nuevo</th>
                            <th class="py-2 text-center">Diferencia</th>
                            <th class="py-2 text-center">Motivo</th>
                            <th class="py-2 text-center">Registrado por</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.ajustes.forEach(ajuste => {
            const fecha = new Date(ajuste.created_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });

            const monto_anterior = parseFloat(ajuste.monto_anterior);
            const monto_nuevo = parseFloat(ajuste.monto_nuevo);
            const diferencia = monto_nuevo - monto_anterior;

            let tipoClass = '';
            let tipoColor = '';
            let tipoIcono = '';

            if (ajuste.tipo === 'Aumento') {
                tipoClass = 'bg-success-subtle border border-success-subtle';
                tipoColor = 'text-dark'; // Cambiado a texto oscuro
                tipoIcono = '<i class="fas fa-arrow-up me-1 text-success"></i>';
            } else if (ajuste.tipo === 'Disminución') {
                tipoClass = 'bg-danger-subtle border border-danger-subtle';
                tipoColor = 'text-dark'; // Cambiado a texto oscuro
                tipoIcono = '<i class="fas fa-arrow-down me-1 text-danger"></i>';
            } else {
                tipoClass = 'bg-warning-subtle border border-warning-subtle';
                tipoColor = 'text-dark'; // Cambiado a texto oscuro
                tipoIcono = '<i class="fas fa-exchange-alt me-1 text-warning"></i>';
            }

            const diferenciaMuestra = diferencia >= 0 ? `+$${diferencia.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-$${Math.abs(diferencia).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const diferenciaClass = diferencia >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold';

            html += `
                <tr class="ajuste-row align-middle">
                    <td class="text-dark text-center" style="white-space: nowrap;">
                        <span class="d-block">${fecha}</span>
                    </td>
                    <td class="text-dark">
                        <div class="fw-medium">${this.escaparHTML(ajuste.codigo)}</div>
                        <div class="text-muted small">${this.escaparHTML(ajuste.nombre)}</div>
                    </td>
                    <td class="text-center">
                        <span class="badge ${tipoClass} ${tipoColor} py-1 px-2" style="font-size: 0.75rem;">
                            ${tipoIcono}${this.escaparHTML(ajuste.tipo)}
                        </span>
                    </td>
                    <td class="text-dark text-end">
                        $${parseFloat(ajuste.monto_anterior).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td class="text-dark text-end">
                        $${parseFloat(ajuste.monto_nuevo).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td class="text-end ${diferenciaClass}">
                        ${diferenciaMuestra}
                    </td>
                    <td class="text-dark">
                        <span class="small">${this.escaparHTML(ajuste.motivo || 'Sin motivo especificado')}</span>
                    </td>
                    <td class="text-muted text-center">
                        <span class="small">${this.escaparHTML(ajuste.usuario_nombre || 'Sistema')}</span>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>

            <div class="ajustes-resumen mt-4">
                <div class="row">
                    <div class="col-md-4">
                        <div class="stat-box p-3 bg-success bg-opacity-10 border border-success border-opacity-25 rounded">
                            <h6 class="fw-semibold" style="color: var(--bs-success)">Aumentos</h6>
                            <p class="mb-0 fs-5 fw-bold text-dark">$${this.calcularTotalPorTipo('Aumento').toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <small class="text-muted">${this.contarPorTipo('Aumento')} registro(s)</small>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="stat-box p-3 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded">
                            <h6 class="fw-semibold" style="color: var(--bs-danger)">Disminuciones</h6>
                            <p class="mb-0 fs-5 fw-bold text-dark">$${Math.abs(this.calcularTotalPorTipo('Disminución')).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <small class="text-muted">${this.contarPorTipo('Disminución')} registro(s)</small>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="stat-box p-3 bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded">
                            <h6 class="fw-semibold" style="color: var(--bs-warning)">Reasignaciones</h6>
                            <p class="mb-0 fs-5 fw-bold text-dark">${this.contarPorTipo('Reasignación')}</p>
                            <small class="text-muted">registro(s)</small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    /**
     * Escapar caracteres HTML para evitar inyección
     */
    escaparHTML: function (text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Calcular total por tipo de ajuste
     */
    calcularTotalPorTipo: function (tipo) {
        return this.ajustes
            .filter(a => a.tipo === tipo)
            .reduce((sum, a) => sum + (parseFloat(a.monto_nuevo) - parseFloat(a.monto_anterior)), 0);
    },

    /**
     * Contar ajustes por tipo
     */
    contarPorTipo: function (tipo) {
        return this.ajustes.filter(a => a.tipo === tipo).length;
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    ajustesManager.init();
});