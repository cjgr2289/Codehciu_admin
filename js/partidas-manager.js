// partidas-manager.js - Gestión de partidas con jerarquía (Versión Mejorada)
class PartidasManager {
    constructor(controlFlujo) {
        this.cf = controlFlujo;
        this.ultimoRefresh = null;
        this.filtrosActivos = {
            busqueda: '',
            estado: '',
            tipo: ''
        };
        this.subpartidasExpandidas = new Set(); // Para rastrear qué subpartidas están expandidas
    }

    // MÉTODO ACTUALIZADO: Cargar partidas con valores REALES del backend
    async cargarPartidas() {
        if (!this.cf.proyectoActual) return;

        try {
            // console.log('Cargando partidas con valores reales...');

            // Agregar timestamp para evitar caché
            const timestamp = Date.now();
            const response = await fetch(`api/partidas.php?action=listar&proyecto_id=${this.cf.proyectoActual.id}&_=${timestamp}`);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            if (data.success && data.partidas) {
                // console.log('Partidas cargadas del backend:', data.partidas.length);

                // Depurar valores recibidos
                this.depurarValoresPartidas(data.partidas);

                this.cf.partidasCache = data.partidas;

                // Organizar y renderizar con valores reales
                const partidasJerarquia = this.organizarJerarquiaConValoresReales(data.partidas);
                this.renderizarPartidasJerarquia(partidasJerarquia);
                this.actualizarSelectorPartidas(data.partidas);

                // Agregar botón de refresco si no existe
                this.agregarBotonRefresco();

                // Cargar partidas principales para selectores
                await this.cargarPartidasPrincipales();

                this.ultimoRefresh = new Date();
                // console.log('Partidas renderizadas con éxito');

                // Inicializar filtros después de renderizar
                setTimeout(() => {
                    this.inicializarFiltrosPartidas();
                }, 100);
            } else {
                // console.error('Error en respuesta API:', data.error);
                this.renderizarPartidas([]);
                this.actualizarSelectorPartidas([]);
            }
        } catch (error) {
            // console.error('Error cargando partidas:', error);
            this.renderizarPartidas([]);
            this.actualizarSelectorPartidas([]);
        }
    }

    // NUEVO MÉTODO: Organizar jerarquía con valores REALES del backend
    organizarJerarquiaConValoresReales(partidas) {
        const partidasMap = new Map();
        const jerarquia = [];

        // 1. Mapear todas las partidas por ID
        partidas.forEach(partida => {
            // Asegurar que los valores sean números REALES del backend
            partida.presupuesto_asignado = parseFloat(partida.presupuesto_asignado) || 0;
            partida.presupuesto_actual = parseFloat(partida.presupuesto_actual) || 0;

            // USAR VALORES REALES DEL BACKEND - CRÍTICO
            partida.total_gastado_real = parseFloat(partida.total_gastado_real) || 0;
            partida.disponible_real = parseFloat(partida.disponible_real) || 0;

            // Si el backend no proporciona estos valores, calcular de forma consistente
            if (partida.total_gastado_real === undefined || isNaN(partida.total_gastado_real) || partida.total_gastado_real < 0) {
                // Calcular basado en los valores disponibles
                partida.total_gastado_real = Math.max(0, partida.presupuesto_asignado - partida.disponible_real);
            }

            if (partida.disponible_real === undefined || isNaN(partida.disponible_real) || partida.disponible_real < 0) {
                // El disponible real es el mínimo entre asignado y actual
                partida.disponible_real = Math.min(partida.presupuesto_asignado, partida.presupuesto_actual);
            }

            // Asegurar consistencia
            if (partida.total_gastado_real + partida.disponible_real > partida.presupuesto_asignado) {
                // console.warn('Inconsistencia en partida', partida.id, 'ajustando valores...');
                partida.disponible_real = Math.max(0, partida.presupuesto_asignado - partida.total_gastado_real);
            }

            partida.subpartidas = [];
            partidasMap.set(partida.id, partida);
        });

        // 2. Organizar jerarquía
        partidas.forEach(partida => {
            if (partida.partida_padre_id) {
                const padre = partidasMap.get(parseInt(partida.partida_padre_id));
                if (padre) {
                    padre.subpartidas.push(partida);
                }
            } else {
                jerarquia.push(partida);
            }
        });

        // 3. Calcular consolidados usando valores REALES
        jerarquia.forEach(partida => {
            this.calcularConsolidadosReales(partida);
        });

        return jerarquia;
    }

    // NUEVO MÉTODO: Calcular consolidados usando valores REALES
    calcularConsolidadosReales(partida) {
        if (!partida.subpartidas || partida.subpartidas.length === 0) {
            // Si no tiene subpartidas, usar valores REALES de esta partida
            partida.total_asignado_consolidado = partida.presupuesto_asignado || 0;
            partida.total_gastado_consolidado = partida.total_gastado_real || 0;
            partida.disponible_consolidado = partida.disponible_real || 0;
            partida.presupuesto_actual_consolidado = partida.presupuesto_actual || 0;
            return;
        }

        let totalAsignado = 0;
        let totalGastado = 0;
        let totalDisponible = 0;
        let totalActual = 0;

        // Calcular sumas de subpartidas usando valores REALES
        partida.subpartidas.forEach(subpartida => {
            // Calcular recursivamente para subpartidas que puedan tener sus propias subpartidas
            this.calcularConsolidadosReales(subpartida);

            // Usar valores REALES - CRÍTICO
            const asignadoSub = parseFloat(subpartida.presupuesto_asignado) || 0;
            const gastadoSub = parseFloat(subpartida.total_gastado_real) || 0;
            const disponibleSub = parseFloat(subpartida.disponible_real) || 0;
            const actualSub = parseFloat(subpartida.presupuesto_actual) || 0;

            totalAsignado += asignadoSub;
            totalGastado += gastadoSub;
            totalDisponible += disponibleSub;
            totalActual += actualSub;
        });

        // Para partida principal, usar sumas de subpartidas
        partida.total_asignado_consolidado = totalAsignado;
        partida.total_gastado_consolidado = totalGastado;
        partida.disponible_consolidado = totalDisponible;
        partida.presupuesto_actual_consolidado = totalActual;
    }

    // MÉTODO ACTUALIZADO: Renderizar partidas con jerarquía
    renderizarPartidasJerarquia(partidasJerarquia) {
        const container = document.getElementById('lista-partidas');
        if (!container) return;

        if (!partidasJerarquia || partidasJerarquia.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> No hay partidas creadas para este proyecto.
                    <button class="btn btn-sm btn-primary ml-2" onclick="window.controlFlujo.ui.mostrarModalCrearPartida()">
                        <i class="fas fa-plus"></i> Crear Partida
                    </button>
                </div>
            `;
            return;
        }

        let html = '';
        partidasJerarquia.forEach(partida => {
            html += this.renderizarPartidaCard(partida, 0); // Nivel 0 = sin indentación
        });

        container.innerHTML = html;

        // Agregar información del último refresh
        this.mostrarInfoRefresh();
    }

    // MÉTODO ACTUALIZADO: Renderizar tarjeta de partida con valores REALES
    renderizarPartidaCard(partida, nivel) {
        const esPrincipal = partida.tipo === 'Principal';
        const tieneSubpartidas = partida.subpartidas && partida.subpartidas.length > 0;

        // DETERMINAR VALORES A MOSTRAR (USAR SIEMPRE VALORES REALES)
        let presupuestoAsignado, presupuestoActual, gastado, disponible, porcentajeGastado, porcentajeRestante;

        if (esPrincipal && tieneSubpartidas) {
            // Para partidas principales con subpartidas: usar valores consolidados
            presupuestoAsignado = partida.total_asignado_consolidado || 0;
            gastado = partida.total_gastado_consolidado || 0;
            disponible = partida.disponible_consolidado || 0;
            presupuestoActual = partida.presupuesto_actual_consolidado || 0;
        } else {
            // PARA PARTIDAS SECUNDARIAS: Usar valores REALES del backend
            presupuestoAsignado = parseFloat(partida.presupuesto_asignado) || 0;
            presupuestoActual = parseFloat(partida.presupuesto_actual) || 0;

            // CRÍTICO: Usar total_gastado_real del backend
            gastado = parseFloat(partida.total_gastado_real) || 0;

            // CRÍTICO: Usar disponible_real del backend
            disponible = parseFloat(partida.disponible_real) || 0;

            // Si los valores reales no están disponibles, calcular de forma consistente
            if (gastado === 0 && partida.total_gastado_real === undefined) {
                gastado = Math.max(0, presupuestoAsignado - disponible);
            }

            if (disponible === 0 && partida.disponible_real === undefined) {
                disponible = Math.min(presupuestoAsignado, presupuestoActual);
            }

            // Validar consistencia
            if (gastado + disponible > presupuestoAsignado) {
                // console.warn('Ajustando valores inconsistentes en partida', partida.id);
                disponible = Math.max(0, presupuestoAsignado - gastado);
            }

            // Mostrar valores en consola para depuración
            // console.log('🔍 Tarjeta Partida - Valores REALES:', {
            //     id: partida.id,
            //     codigo: partida.codigo,
            //     nombre: partida.nombre,
            //     tipo: partida.tipo,
            //     asignado: presupuestoAsignado,
            //     gastado_real: partida.total_gastado_real,
            //     gastado_mostrado: gastado,
            //     disponible_real: partida.disponible_real,
            //     disponible_mostrado: disponible,
            //     presupuesto_actual: presupuestoActual
            // });
        }

        // Asegurar valores lógicos
        gastado = Math.max(0, Math.min(gastado, presupuestoAsignado));
        disponible = Math.max(0, Math.min(disponible, presupuestoAsignado));

        // Recalcular si hay inconsistencias
        if (gastado + disponible !== presupuestoAsignado) {
            // console.warn('Corrigiendo suma en partida', partida.id, {
            //     gastado, disponible, suma: gastado + disponible, asignado: presupuestoAsignado
            // });
            disponible = Math.max(0, presupuestoAsignado - gastado);
        }

        // Calcular porcentajes
        porcentajeGastado = presupuestoAsignado > 0 ? (gastado / presupuestoAsignado) * 100 : 0;
        porcentajeRestante = 100 - porcentajeGastado;

        // Determinar clase CSS según el estado del presupuesto
        let estadoClase = '';
        let estadoFiltro = '';

        if (porcentajeRestante < 10) {
            estadoClase = 'sobrepasada';
            estadoFiltro = 'sobrepasado';
        } else if (porcentajeRestante > 50) {
            estadoClase = 'saludable';
            estadoFiltro = 'saludable';
        } else if (porcentajeRestante <= 30) {
            estadoClase = 'advertencia';
            estadoFiltro = 'peligro';
        } else {
            estadoClase = '';
            estadoFiltro = 'advertencia';
        }

        // Usar el ID real de la partida
        const partidaId = partida.id;

        let html = `
    <div class="partida-card nivel-${nivel} ${estadoClase}" 
         id="partida-${partidaId}" 
         data-tipo="${esPrincipal ? 'Principal' : 'Secundaria'}" 
         data-estado="${estadoFiltro}"
         data-codigo="${partida.codigo || ''}"
         data-nombre="${partida.nombre || ''}"
         data-nivel="${nivel}"
         data-tiene-subpartidas="${tieneSubpartidas}"
         data-partida-padre-id="${partida.partida_padre_id || ''}">
        <div class="card-header">
            <h5 class="mb-0">
                <span class="badge ${esPrincipal ? 'badge-primary' : 'badge-info'}">
                    <i class="fas ${esPrincipal ? 'fa-folder' : 'fa-file-alt'}"></i> ${partida.codigo || partida.id}
                </span>
                ${partida.nombre || 'Sin nombre'}
                ${esPrincipal && tieneSubpartidas ? `<span class="badge badge-secondary ml-2"><i class="fas fa-sitemap"></i> ${partida.subpartidas.length} subpartidas</span>` : ''}
            </h5>
            <div class="d-flex align-items-center">
                <span class="badge-nivel mr-2">Nivel ${nivel + 1}</span>
                <span class="badge ${porcentajeRestante > 30 ? 'badge-success' : porcentajeRestante > 10 ? 'badge-warning' : 'badge-danger'}">
                    ${porcentajeRestante.toFixed(1)}% restante
                </span>
            </div>
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    <p><strong><i class="fas fa-money-bill-wave"></i> Asignado:</strong> 
                       <span class="presupuesto-valor text-primary">$${presupuestoAsignado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                    <p><strong><i class="fas fa-check-circle"></i> Disponible:</strong> 
                       <span class="value-display ${disponible > 0 ? 'text-success' : 'text-danger'}">$${disponible.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                       ${!esPrincipal && partida.disponible_real !== undefined ? '' : ''}
                    </p>
                </div>
                <div class="col-md-6">
                    <p><strong><i class="fas fa-receipt"></i> Gastado:</strong> 
                       <span class="value-display ${gastado > 0 ? 'text-danger' : 'text-secondary'}">$${gastado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                       ${!esPrincipal && partida.total_gastado_real !== undefined ? '' : ''}
                    </p>
                    <p><strong><i class="fas fa-percentage"></i> Restante:</strong> 
                       <span class="value-display ${porcentajeRestante > 30 ? 'text-success' : porcentajeRestante > 10 ? 'text-warning' : 'text-danger'}">${porcentajeRestante.toFixed(1)}%</span></p>
                </div>
            </div>
            
            ${esPrincipal ? `
                <div class="alert alert-info py-2">
                    <i class="fas fa-info-circle"></i> <strong>Partida Principal</strong> - Los egresos se registran en las subpartidas
                 
                </div>
            ` : `
                <div class="alert alert-success py-2">
                    
                </div>
            `}
            
            <div class="progress" style="height: 20px;">
                <div class="progress-bar bg-success" style="width: ${porcentajeRestante || 0}%" 
                     title="Presupuesto restante: ${porcentajeRestante.toFixed(1)}%">
                    ${porcentajeRestante >= 15 ? `${porcentajeRestante.toFixed(1)}%` : ''}
                </div>
                <div class="progress-bar bg-warning" style="width: ${porcentajeGastado || 0}%" 
                     title="Presupuesto gastado: ${porcentajeGastado.toFixed(1)}%">
                    ${porcentajeGastado >= 15 ? `${porcentajeGastado.toFixed(1)}%` : ''}
                </div>
            </div>
            
            <div class="partida-actions">
                ${!esPrincipal ? `
                    <button class="btn btn-sm btn-primary btn-roles" onclick="window.controlFlujo.ui.mostrarModalRegistrarEgreso(${partida.id})">
                        <i class="fas fa-money-bill-wave"></i> Registrar Egreso
                    </button>
                ` : `
                    <button class="btn btn-sm btn-secondary btn-roles" disabled title="No se pueden registrar egresos en partidas principales">
                        <i class="fas fa-ban"></i> Sin egresos directos
                    </button>
                `}
                
                <button class="btn btn-sm btn-info" onclick="window.controlFlujo.partidas.verDetallesPartida(${partida.id})">
                    <i class="fas fa-chart-bar"></i> Ver Detalles
                </button>
                
                <button class="btn btn-sm btn-outline-primary btn-roles " onclick="window.controlFlujo.partidas.ajustarPresupuesto(${partida.id})">
                    <i class="fas fa-edit"></i> Ajustar/Reasignar
                </button>
                
                <button class="btn btn-sm btn-outline-info" onclick="window.controlFlujo.partidas.forzarRefreshPartida(${partida.id})">
                    <i class="fas fa-sync-alt"></i> Refrescar
                </button>
            </div>
            
            ${tieneSubpartidas ? `
                <button class="btn-toggle-subpartidas" onclick="window.controlFlujo.partidas.toggleSubpartidas(${partidaId})" 
                        data-partida-id="${partidaId}">
                    <i class="fas fa-chevron-down"></i> 
                    Ver Subpartidas (${partida.subpartidas.length})
                </button>
            ` : ''}
        </div>
    </div>
    
    ${tieneSubpartidas ? `
        <div class="subpartidas-externas" id="subpartidas-container-${partidaId}" style="display: none;">
            <div class="subpartidas-grid" id="subpartidas-grid-${partidaId}">
                ${partida.subpartidas.map(subpartida =>
            this.renderizarPartidaCard(subpartida, nivel + 1)
        ).join('')}
            </div>
        </div>
    ` : ''}
    `;

        return html;
    }

    // NUEVO MÉTODO: Refrescar valores de partidas
    async refrescarValoresPartidas() {
        if (!this.cf.proyectoActual) return false;

        try {
            // console.log('🔄 Refrescando valores de partidas...');

            // Mostrar indicador de carga
            this.mostrarLoading(true);

            const response = await fetch(`api/partidas.php?action=listar&proyecto_id=${this.cf.proyectoActual.id}&forzar=1&_=${Date.now()}`);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            if (data.success && data.partidas) {
                // Actualizar cache
                this.cf.partidasCache = data.partidas;

                // Re-renderizar partidas con los nuevos valores
                const partidasJerarquia = this.organizarJerarquiaConValoresReales(data.partidas);
                this.renderizarPartidasJerarquia(partidasJerarquia);

                // También actualizar selectores
                this.actualizarSelectorPartidas(data.partidas);

                this.ultimoRefresh = new Date();
                // console.log('✅ Valores de partidas actualizados correctamente');

                this.mostrarExito('Valores actualizados correctamente');
                return true;
            } else {
                // console.error('Error en respuesta de API:', data.error);
                this.mostrarError('Error al actualizar valores');
                return false;
            }
        } catch (error) {
            // console.error('Error refrescando partidas:', error);
            this.mostrarError('Error de conexión al actualizar');
            return false;
        } finally {
            this.mostrarLoading(false);
        }
    }

    // NUEVO MÉTODO: Forzar refresh de una partida específica
    async forzarRefreshPartida(partidaId) {
        try {
            // Obtener datos actualizados de esta partida específica
            const response = await fetch(`api/partidas.php?action=obtener&id=${partidaId}&_=${Date.now()}`);
            const data = await response.json();

            if (data.success && data.partida) {
                // Actualizar en el cache
                const index = this.cf.partidasCache.findIndex(p => p.id == partidaId);
                if (index !== -1) {
                    this.cf.partidasCache[index] = data.partida;

                    // Re-renderizar todas las partidas
                    const partidasJerarquia = this.organizarJerarquiaConValoresReales(this.cf.partidasCache);
                    this.renderizarPartidasJerarquia(partidasJerarquia);

                    // console.log(`✅ Partida ${partidaId} actualizada`);
                    this.mostrarExito('Partida actualizada');
                }
            }
        } catch (error) {
            // console.error('Error refrescando partida específica:', error);
        }
    }

    // MÉTODO ACTUALIZADO: Actualizar selector de partidas para egresos
    actualizarSelectorPartidas(partidas) {
        const selector = document.getElementById('partida_egreso');
        if (!selector) return;

        let html = '<option value="">Seleccionar partida...</option>';

        // Filtrar solo partidas secundarias (donde se pueden registrar egresos)
        const partidasSecundarias = partidas.filter(p => p.tipo === 'Secundaria');

        partidasSecundarias.forEach(partida => {
            // Usar valores REALES del backend
            const gastado = parseFloat(partida.total_gastado_real) || 0;
            const disponible = parseFloat(partida.disponible_real) ||
                parseFloat(partida.presupuesto_actual) || 0;
            const asignado = parseFloat(partida.presupuesto_asignado) || 0;

            const porcentajeDisponible = asignado > 0 ? (disponible / asignado) * 100 : 0;

            html += `
            <option value="${partida.id}" 
                    data-disponible="${disponible}"
                    data-porcentaje="${porcentajeDisponible}"
                    data-asignado="${asignado}"
                    data-gastado="${gastado}">
                ${partida.codigo || partida.id} - ${partida.nombre} 
                (Disponible: $${disponible.toLocaleString()} - ${porcentajeDisponible.toFixed(1)}%)
            </option>
        `;
        });

        selector.innerHTML = html;

        // Actualizar disponibilidad cuando se selecciona una partida
        selector.addEventListener('change', function () {
            const selectedOption = this.options[this.selectedIndex];
            const disponible = parseFloat(selectedOption.getAttribute('data-disponible')) || 0;
            const porcentaje = parseFloat(selectedOption.getAttribute('data-porcentaje')) || 0;
            const asignado = parseFloat(selectedOption.getAttribute('data-asignado')) || 0;
            const gastado = parseFloat(selectedOption.getAttribute('data-gastado')) || 0;

            const disponibilidadElement = document.getElementById('disponibilidad-partida');
            if (disponibilidadElement) {
                disponibilidadElement.innerHTML = `
                    <strong>Información actualizada:</strong><br>
                    • Asignado: $${asignado.toLocaleString()}<br>
                    • Gastado: $${gastado.toLocaleString()}<br>
                    • Disponible: <span class="${disponible > 0 ? 'text-success' : 'text-danger'}">$${disponible.toLocaleString()} (${porcentaje.toFixed(1)}%)</span>
                `;
            }
        });
    }

    // MÉTODO ACTUALIZADO: Crear partida con validación de jerarquía
    async crearPartida() {
        // console.log('Iniciando creación de partida...');

        if (!this.cf.proyectoActual) {
            this.cf.ui.mostrarError('No hay proyecto seleccionado. Abre un proyecto primero.');
            return;
        }

        const modalElement = document.getElementById('modal-crear-partida');
        if (!modalElement) {
            console.error('Modal modal-crear-partida no encontrado en el DOM');
            this.cf.ui.mostrarError('El formulario no se encuentra disponible. Recarga la página.');
            return;
        }

        // Buscar elementos
        const tipoPartida = modalElement.querySelector('#tipo_partida');
        const partidaPadreSelect = modalElement.querySelector('#partida_padre');
        const codigoPartida = modalElement.querySelector('#codigo_partida');
        const nombrePartida = modalElement.querySelector('#nombre_partida');
        const presupuestoAsignado = modalElement.querySelector('#presupuesto_asignado');
        const descripcionPartida = modalElement.querySelector('#descripcion_partida');
        const form = modalElement.querySelector('#form-crear-partida');
        const submitBtn = modalElement.querySelector('#btn-guardar-partida');

        // Validar que si es secundaria, tenga partida padre
        const tipo = tipoPartida?.value || 'Principal';
        const partidaPadreId = tipo === 'Secundaria' ? partidaPadreSelect?.value : null;

        if (tipo === 'Secundaria' && !partidaPadreId) {
            this.cf.ui.mostrarError('Debe seleccionar una partida principal para la subpartida');
            partidaPadreSelect?.focus();
            return;
        }

        // Validar valores
        const codigo = codigoPartida?.value?.trim() || '';
        const nombre = nombrePartida?.value?.trim() || '';
        const presupuestoStr = presupuestoAsignado?.value?.trim().replace(',', '.') || '0';
        const presupuesto = parseFloat(presupuestoStr);
        const descripcion = descripcionPartida?.value?.trim() || '';

        // Validaciones
        if (!codigo) {
            this.cf.ui.mostrarError('El código de partida es requerido');
            codigoPartida?.focus();
            return;
        }

        if (!nombre) {
            this.cf.ui.mostrarError('El nombre de la partida es requerido');
            nombrePartida?.focus();
            return;
        }

        if (isNaN(presupuesto)) {
            this.cf.ui.mostrarError('El presupuesto asignado debe ser un número válido');
            presupuestoAsignado?.focus();
            return;
        }

        if (presupuesto <= 0) {
            this.cf.ui.mostrarError('El presupuesto asignado debe ser mayor a 0');
            presupuestoAsignado?.focus();
            return;
        }

        // Si es subpartida, verificar presupuesto disponible en partida padre
        if (tipo === 'Secundaria' && partidaPadreId) {
            try {
                const response = await fetch(`api/partidas.php?action=validar-presupuesto&padre_id=${partidaPadreId}&nuevo_presupuesto=${presupuesto}`);
                const result = await response.json();

                if (!result.success) {
                    this.cf.ui.mostrarError(result.error || 'Error al validar presupuesto');
                    return;
                }

                if (!result.valido) {
                    this.cf.ui.mostrarError(`No hay suficiente presupuesto disponible en la partida principal. Disponible: $${result.disponible?.toLocaleString() || 0}`);
                    return;
                }
            } catch (error) {
                console.error('Error validando presupuesto:', error);
                this.cf.ui.mostrarError('Error al validar presupuesto disponible');
                return;
            }
        }

        // Preparar datos para enviar
        const data = {
            proyecto_id: this.cf.proyectoActual.id,
            codigo: codigo,
            nombre: nombre,
            descripcion: descripcion,
            presupuesto_asignado: presupuesto,
            tipo: tipo,
            partida_padre_id: partidaPadreId
        };

        // Mostrar loading en el botón si existe
        let originalText = '';
        if (submitBtn) {
            originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';
            submitBtn.disabled = true;
        }

        try {
            const response = await fetch('api/partidas.php?action=crear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            // Restaurar botón
            if (submitBtn) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }

            const result = await response.json();

            if (result.success) {
                this.cf.ui.mostrarExito(result.message || 'Partida creada correctamente');

                // Refrescar partidas con valores actualizados
                await this.refrescarValoresPartidas();
                await this.cf.proyectos.cargarResumenFinanciero();
                await this.cf.graficos.cargarGraficos();

                // Cerrar modal usando Bootstrap
                if (modalElement && window.bootstrap) {
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) {
                        modal.hide();
                    }
                }

                // Limpiar formulario
                if (form) {
                    form.reset();
                }

                // Restaurar valores por defecto
                if (tipoPartida) {
                    tipoPartida.value = 'Principal';
                }
                if (partidaPadreSelect) {
                    partidaPadreSelect.style.display = 'none';
                    partidaPadreSelect.value = '';
                }
            } else {
                this.cf.ui.mostrarError(result.error || 'Error al crear la partida');
            }
        } catch (error) {
            // console.error('Error en crearPartida:', error);
            this.cf.ui.mostrarError('Error de conexión al servidor: ' + error.message);

            // Restaurar botón en caso de error
            if (submitBtn) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    // NUEVO MÉTODO: Cargar partidas principales para selectores
    async cargarPartidasPrincipales() {
        if (!this.cf.proyectoActual) return;

        try {
            const response = await fetch(`api/partidas.php?action=listar-principales&proyecto_id=${this.cf.proyectoActual.id}`);
            const data = await response.json();

            if (data.success && data.partidas) {
                this.actualizarSelectorPartidasPadre(data.partidas);
            }
        } catch (error) {
            // console.error('Error cargando partidas principales:', error);
        }
    }

    // NUEVO MÉTODO: Actualizar selector de partidas padre
    actualizarSelectorPartidasPadre(partidas) {
        const selector = document.getElementById('partida_padre');
        if (!selector) return;

        let html = '<option value="">Seleccionar partida principal...</option>';
        partidas.forEach(partida => {
            const disponible = parseFloat(partida.presupuesto_actual) || 0;
            const asignado = parseFloat(partida.presupuesto_asignado) || 0;
            html += `
                <option value="${partida.id}" 
                        data-disponible="${disponible}"
                        data-presupuesto="${asignado}">
                    ${partida.codigo} - ${partida.nombre} 
                    (Presupuesto: $${asignado.toLocaleString()})
                </option>
            `;
        });

        selector.innerHTML = html;
    }

    // MÉTODO ACTUALIZADO: Ajustar presupuesto (con opción de reasignación)
    async ajustarPresupuesto(partidaId) {
        try {
            // Obtener datos de la partida
            const response = await fetch(`api/partidas.php?action=obtener&id=${partidaId}&_=${Date.now()}`);
            const data = await response.json();

            if (!data.success) {
                this.cf.ui.mostrarError(data.error || 'Error al obtener datos de la partida');
                return;
            }

            const partida = data.partida;

            // Mostrar opciones de ajuste
            const { value: opcion } = await Swal.fire({
                title: `Ajustar Presupuesto: ${partida.nombre}`,
                text: 'Seleccione el tipo de ajuste que desea realizar:',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Continuar',
                cancelButtonText: 'Cancelar',
                input: 'select',
                inputOptions: {
                    'ajuste_simple': 'Ajuste Simple (Modificar montos)',
                    'reasignacion': 'Reasignar a Otra Partida'
                },
                inputPlaceholder: 'Seleccione una opción',
                inputValidator: (value) => {
                    if (!value) {
                        return 'Debe seleccionar una opción';
                    }
                }
            });

            if (opcion === 'ajuste_simple') {
                // Ejecutar ajuste simple
                await this.ajustarPresupuestoSimple(partidaId);
            } else if (opcion === 'reasignacion') {
                // Ejecutar reasignación
                await this.mostrarModalReasignarPresupuesto(partidaId);
            }

        } catch (error) {
            console.error('Error en ajustarPresupuesto:', error);
            this.cf.ui.mostrarError('Error al procesar la solicitud');
        }
    }

    // MÉTODO PARA AJUSTE SIMPLE
    async ajustarPresupuestoSimple(partidaId) {
        try {
            // Obtener datos ACTUALIZADOS de la partida
            const response = await fetch(`api/partidas.php?action=obtener&id=${partidaId}&_=${Date.now()}`);
            const data = await response.json();

            if (!data.success) {
                this.cf.ui.mostrarError(data.error || 'Error al obtener datos de la partida');
                return;
            }

            const partida = data.partida;

            // Mostrar modal de ajuste
            const { value: formValues } = await Swal.fire({
                title: `Ajustar Presupuesto: ${partida.nombre}`,
                html: `
                <div class="text-left">
                    <div class="form-group">
                        <label for="presupuesto_actual">Presupuesto Actual</label>
                        <div class="input-group">
                            <div class="input-group-prepend">
                                <span class="input-group-text">$</span>
                            </div>
                            <input type="number" class="form-control" id="presupuesto_actual" 
                                   value="${partida.presupuesto_actual}" step="0.01" min="0">
                        </div>
                        <small class="form-text text-muted">Presupuesto disponible actual: $${partida.presupuesto_actual}</small>
                    </div>
                    <div class="form-group">
                        <label for="nuevo_presupuesto">Nuevo Presupuesto Asignado</label>
                        <div class="input-group">
                            <div class="input-group-prepend">
                                <span class="input-group-text">$</span>
                            </div>
                            <input type="number" class="form-control" id="nuevo_presupuesto" 
                                   value="${partida.presupuesto_asignado}" step="0.01" min="0">
                        </div>
                        <small class="form-text text-muted">Presupuesto asignado actual: $${partida.presupuesto_asignado}</small>
                    </div>
                    <div class="form-group">
                        <label for="justificacion">Justificación del Ajuste</label>
                        <textarea class="form-control" id="justificacion" rows="3" 
                                  placeholder="Explique por qué necesita ajustar el presupuesto..."></textarea>
                    </div>
                </div>
            `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Guardar Ajuste',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    return {
                        presupuesto_actual: parseFloat(document.getElementById('presupuesto_actual').value),
                        presupuesto_asignado: parseFloat(document.getElementById('nuevo_presupuesto').value),
                        justificacion: document.getElementById('justificacion').value
                    };
                }
            });

            if (formValues) {
                // Validar
                if (formValues.presupuesto_actual < 0 || formValues.presupuesto_asignado < 0) {
                    this.cf.ui.mostrarError('Los valores no pueden ser negativos');
                    return;
                }

                // Enviar ajuste
                const ajusteResponse = await fetch('api/partidas.php?action=ajustar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: partidaId,
                        ...formValues
                    })
                });

                const ajusteResult = await ajusteResponse.json();

                if (ajusteResult.success) {
                    this.cf.ui.mostrarExito('Presupuesto ajustado correctamente');

                    // Refrescar valores actualizados
                    await this.refrescarValoresPartidas();
                    await this.cf.proyectos.cargarResumenFinanciero();
                    await this.cf.graficos.cargarGraficos();
                } else {
                    this.cf.ui.mostrarError(ajusteResult.error || 'Error al ajustar presupuesto');
                }
            }
        } catch (error) {
            // console.error('Error en ajustarPresupuesto:', error);
            this.cf.ui.mostrarError('Error al ajustar presupuesto');
        }
    }

    // MÉTODO PARA ABRIR MODAL DE REASIGNACIÓN
    async mostrarModalReasignarPresupuesto(partidaId = null) {
        try {
            // Obtener lista de partidas del proyecto
            const partidas = await this.obtenerPartidasProyecto();

            // Obtener usuario actual
            const usuarioActual = this.cf.usuarioActual || { id: 1, nombre: 'Usuario' };

            // Crear modal de reasignación
            const { value: formValues } = await Swal.fire({
                title: '<i class="fas fa-exchange-alt"></i> Reasignar Presupuesto',
                html: `
                    <div class="reasignacion-presupuesto-form">
                        <style>
                            .reasignacion-presupuesto-form .form-group {
                                margin-bottom: 15px;
                            }
                            .reasignacion-presupuesto-form .info-box {
                                background: #f8f9fa;
                                border-radius: 6px;
                                padding: 10px;
                                margin-bottom: 10px;
                                border-left: 4px solid #007bff;
                                font-size: 0.9rem;
                            }
                            .reasignacion-presupuesto-form .valor-actual {
                                font-weight: bold;
                                color: #007bff;
                            }
                            .reasignacion-presupuesto-form .monto-input-container {
                                position: relative;
                            }
                            .reasignacion-presupuesto-form .monto-input-container:before {
                                content: "$";
                                position: absolute;
                                left: 10px;
                                top: 50%;
                                transform: translateY(-50%);
                                color: #6c757d;
                            }
                            .reasignacion-presupuesto-form .monto-input-container input {
                                padding-left: 30px;
                            }
                            .reasignacion-presupuesto-form .partida-info {
                                background: #e8f4fd;
                                padding: 8px;
                                border-radius: 4px;
                                margin-top: 5px;
                                font-size: 0.85rem;
                            }
                            .reasignacion-presupuesto-form .validacion-error {
                                color: #dc3545;
                                font-size: 0.8rem;
                                margin-top: 5px;
                                display: none;
                            }
                            .reasignacion-presupuesto-form .disponible-info {
                                background: #d4edda;
                                padding: 8px;
                                border-radius: 4px;
                                margin-top: 5px;
                                font-size: 0.85rem;
                            }
                        </style>
                        
                        <!-- Info inicial -->
                        <div class="info-box">
                            <i class="fas fa-info-circle"></i> 
                            Transferir presupuesto entre partidas del mismo proyecto.
                            El sistema validará que haya suficiente presupuesto disponible.
                        </div>
                        
                        <!-- Partida Origen -->
                        <div class="form-group">
                            <label for="partida_origen_id">
                                <i class="fas fa-sign-out-alt"></i> Partida Origen
                                <span class="text-danger">*</span>
                            </label>
                            <select class="form-control" id="partida_origen_id" required>
                                <option value="">Seleccionar partida origen...</option>
                                ${partidas.filter(p => p.tipo === 'Secundaria').map(partida => `
                                    <option value="${partida.id}" 
                                            ${partidaId == partida.id ? 'selected' : ''}
                                            data-presupuesto="${partida.presupuesto_asignado}"
                                            data-gastado="${partida.total_gastado_real || 0}">
                                        ${partida.codigo} - ${partida.nombre} 
                                        (Asignado: $${partida.presupuesto_asignado?.toLocaleString() || 0})
                                    </option>
                                `).join('')}
                            </select>
                            <div id="info_partida_origen" class="partida-info" style="display: none;">
                                Cargando información...
                            </div>
                        </div>
                        
                        <!-- Monto a Transferir -->
                        <div class="form-group">
                            <label for="monto_reasignar">
                                <i class="fas fa-money-bill-wave"></i> Monto a Transferir
                                <span class="text-danger">*</span>
                            </label>
                            <div class="monto-input-container">
                                <input type="number" 
                                       class="form-control" 
                                       id="monto_reasignar" 
                                       step="0.01" 
                                       min="0.01" 
                                       placeholder="0.00"
                                       required>
                            </div>
                            <div id="validacion_monto" class="validacion-error"></div>
                        </div>
                        
                        <!-- Partida Destino -->
                        <div class="form-group">
                            <label for="partida_destino_id">
                                <i class="fas fa-sign-in-alt"></i> Partida Destino
                                <span class="text-danger">*</span>
                            </label>
                            <select class="form-control" id="partida_destino_id" required>
                                <option value="">Seleccionar partida destino...</option>
                                ${partidas.filter(p => p.tipo === 'Secundaria' && p.id != partidaId).map(partida => `
                                    <option value="${partida.id}"
                                            data-presupuesto="${partida.presupuesto_asignado}">
                                        ${partida.codigo} - ${partida.nombre} 
                                        (Asignado: $${partida.presupuesto_asignado?.toLocaleString() || 0})
                                    </option>
                                `).join('')}
                            </select>
                            <div id="info_partida_destino" class="partida-info" style="display: none;">
                                Cargando información...
                            </div>
                        </div>
                        
                        <!-- Motivo -->
                        <div class="form-group">
                            <label for="motivo_reasignacion">
                                <i class="fas fa-clipboard"></i> Motivo de la Reasignación
                                <span class="text-danger">*</span>
                            </label>
                            <textarea class="form-control" 
                                      id="motivo_reasignacion" 
                                      rows="3" 
                                      placeholder="Describa el motivo de la transferencia de presupuesto..."
                                      required></textarea>
                        </div>
                        
                        <!-- Resumen -->
                        <div id="resumen_reasignacion" class="disponible-info" style="display: none;">
                            <i class="fas fa-calculator"></i> 
                            <strong>Resumen de la operación:</strong>
                            <div id="resumen_detalle"></div>
                        </div>
                        
                        <!-- Campos ocultos -->
                        <input type="hidden" id="proyecto_id" value="${this.cf.proyectoActual?.id}">
                        <input type="hidden" id="usuario_id" value="${usuarioActual.id}">
                    </div>
                `,
                width: '650px',
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Confirmar Transferencia',
                cancelButtonText: 'Cancelar',
                showLoaderOnConfirm: true,
                preConfirm: () => {
                    return this.validarFormularioReasignacion();
                },
                didOpen: () => {
                    this.configurarEventosReasignacion();
                }
            });

            if (formValues) {
                await this.ejecutarReasignacion(formValues);
            }

        } catch (error) {
            console.error('Error en modal de reasignación:', error);
            this.cf.ui.mostrarError('Error al abrir el formulario de reasignación');
        }
    }

    // MÉTODO PARA CONFIGURAR EVENTOS DEL MODAL DE REASIGNACIÓN
    configurarEventosReasignacion() {
        const partidaOrigenSelect = document.getElementById('partida_origen_id');
        const montoInput = document.getElementById('monto_reasignar');
        const partidaDestinoSelect = document.getElementById('partida_destino_id');

        // Evento al cambiar partida origen
        if (partidaOrigenSelect) {
            partidaOrigenSelect.addEventListener('change', async (e) => {
                await this.actualizarInfoPartidaOrigen(e.target.value);
            });

            // Cargar info inicial si hay selección
            if (partidaOrigenSelect.value) {
                this.actualizarInfoPartidaOrigen(partidaOrigenSelect.value);
            }
        }

        // Evento al cambiar monto
        if (montoInput) {
            montoInput.addEventListener('input', () => {
                this.validarMontoEnTiempoReal();
            });
        }

        // Evento al cambiar partida destino
        if (partidaDestinoSelect) {
            partidaDestinoSelect.addEventListener('change', (e) => {
                this.actualizarInfoPartidaDestino(e.target.value);
            });
        }
    }

    // MÉTODO PARA ACTUALIZAR INFO PARTIDA ORIGEN
    async actualizarInfoPartidaOrigen(partidaId) {
        const infoDiv = document.getElementById('info_partida_origen');
        const selectElement = document.getElementById('partida_origen_id');
        const selectedOption = selectElement?.options[selectElement.selectedIndex];

        if (!partidaId || !infoDiv || !selectedOption) {
            infoDiv.style.display = 'none';
            return;
        }

        try {
            // Obtener datos actualizados de la partida
            const response = await fetch(`api/partidas.php?action=obtener&id=${partidaId}&_=${Date.now()}`);
            const data = await response.json();

            if (data.success && data.partida) {
                const partida = data.partida;
                const presupuestoAsignado = parseFloat(partida.presupuesto_asignado) || 0;
                const totalGastado = parseFloat(partida.total_gastado_real) || 0;
                const disponible = presupuestoAsignado - totalGastado;

                infoDiv.innerHTML = `
                    <strong>Información actual:</strong><br>
                    • Presupuesto asignado: <span class="valor-actual">$${presupuestoAsignado.toLocaleString()}</span><br>
                    • Total gastado: <span class="text-danger fs-6 fw-semibold">$${totalGastado.toLocaleString()}</span><br>
                    • Disponible para transferir: <span class="text-success">$${disponible.toLocaleString()}</span>
                `;
                infoDiv.style.display = 'block';

                // Actualizar atributos en el select
                selectedOption.setAttribute('data-presupuesto', presupuestoAsignado);
                selectedOption.setAttribute('data-gastado', totalGastado);

            } else {
                infoDiv.innerHTML = '<span class="text-danger">Error al cargar información</span>';
                infoDiv.style.display = 'block';
            }
        } catch (error) {
            infoDiv.innerHTML = '<span class="text-danger">Error de conexión</span>';
            infoDiv.style.display = 'block';
        }
    }

    // MÉTODO PARA ACTUALIZAR INFO PARTIDA DESTINO
    actualizarInfoPartidaDestino(partidaId) {
        const infoDiv = document.getElementById('info_partida_destino');
        const selectElement = document.getElementById('partida_destino_id');
        const selectedOption = selectElement?.options[selectElement.selectedIndex];

        if (!partidaId || !infoDiv || !selectedOption) {
            infoDiv.style.display = 'none';
            return;
        }

        const presupuestoActual = parseFloat(selectedOption.getAttribute('data-presupuesto')) || 0;

        infoDiv.innerHTML = `
            <strong>Información actual:</strong><br>
            • Presupuesto asignado actual: <span class="valor-actual">$${presupuestoActual.toLocaleString()}</span>
        `;
        infoDiv.style.display = 'block';
    }

    // MÉTODO PARA VALIDAR MONTO EN TIEMPO REAL
    async validarMontoEnTiempoReal() {
        const partidaOrigenId = document.getElementById('partida_origen_id')?.value;
        const montoInput = document.getElementById('monto_reasignar');
        const validacionDiv = document.getElementById('validacion_monto');
        const resumenDiv = document.getElementById('resumen_reasignacion');
        const resumenDetalle = document.getElementById('resumen_detalle');

        if (!partidaOrigenId || !montoInput || !validacionDiv) return;

        const monto = parseFloat(montoInput.value) || 0;

        if (monto <= 0) {
            validacionDiv.style.display = 'none';
            resumenDiv.style.display = 'none';
            return;
        }

        try {
            // Validar con el servidor
            const response = await fetch('api/partidas.php?action=validar-ajuste', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partida_origen_id: partidaOrigenId,
                    monto: monto
                })
            });

            const data = await response.json();

            if (data.success) {
                if (data.valido) {
                    // Mostrar resumen
                    const origenSelect = document.getElementById('partida_origen_id');
                    const destinoSelect = document.getElementById('partida_destino_id');
                    const origenOption = origenSelect?.options[origenSelect.selectedIndex];
                    const destinoOption = destinoSelect?.options[destinoSelect.selectedIndex];

                    if (origenOption && destinoOption) {
                        const presupuestoOrigen = parseFloat(origenOption.getAttribute('data-presupuesto')) || 0;
                        const gastadoOrigen = parseFloat(origenOption.getAttribute('data-gastado')) || 0;
                        const presupuestoDestino = parseFloat(destinoOption.getAttribute('data-presupuesto')) || 0;

                        const nuevoOrigen = presupuestoOrigen - monto;
                        const nuevoDestino = presupuestoDestino + monto;
                        const disponibleDespues = nuevoOrigen - gastadoOrigen;

                        resumenDetalle.innerHTML = `
                            • Origen: $${presupuestoOrigen.toLocaleString()} → <strong>$${nuevoOrigen.toLocaleString()}</strong><br>
                            • Destino: $${presupuestoDestino.toLocaleString()} → <strong>$${nuevoDestino.toLocaleString()}</strong><br>
                            • Disponible después: <strong>$${disponibleDespues.toLocaleString()}</strong>
                        `;

                        validacionDiv.style.display = 'none';
                        resumenDiv.style.display = 'block';
                    }
                } else {
                    // Mostrar error
                    validacionDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${data.error}`;
                    validacionDiv.style.display = 'block';
                    resumenDiv.style.display = 'none';
                }
            }
        } catch (error) {
            validacionDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error de validación';
            validacionDiv.style.display = 'block';
            resumenDiv.style.display = 'none';
        }
    }

    // MÉTODO PARA VALIDAR FORMULARIO COMPLETO DE REASIGNACIÓN
    validarFormularioReasignacion() {
        const partidaOrigenId = document.getElementById('partida_origen_id')?.value;
        const partidaDestinoId = document.getElementById('partida_destino_id')?.value;
        const monto = document.getElementById('monto_reasignar')?.value;
        const motivo = document.getElementById('motivo_reasignacion')?.value;
        const proyectoId = document.getElementById('proyecto_id')?.value;
        const usuarioId = document.getElementById('usuario_id')?.value;

        // Validaciones básicas
        if (!partidaOrigenId) {
            Swal.showValidationMessage('Seleccione la partida origen');
            return false;
        }

        if (!partidaDestinoId) {
            Swal.showValidationMessage('Seleccione la partida destino');
            return false;
        }

        if (partidaOrigenId === partidaDestinoId) {
            Swal.showValidationMessage('La partida origen y destino no pueden ser la misma');
            return false;
        }

        if (!monto || parseFloat(monto) <= 0) {
            Swal.showValidationMessage('Ingrese un monto válido mayor a 0');
            return false;
        }

        if (!motivo || motivo.trim().length < 10) {
            Swal.showValidationMessage('Describa el motivo de la reasignación (mínimo 10 caracteres)');
            return false;
        }

        return {
            proyecto_id: proyectoId,
            partida_origen_id: partidaOrigenId,
            partida_destino_id: partidaDestinoId,
            monto: parseFloat(monto),
            motivo: motivo.trim(),
            usuario_id: usuarioId
        };
    }

    // MÉTODO PARA EJECUTAR REASIGNACIÓN
    async ejecutarReasignacion(data) {
        try {
            const response = await fetch('api/partidas.php?action=ajustar-presupuesto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                // Mostrar éxito
                await Swal.fire({
                    icon: 'success',
                    title: '¡Transferencia Exitosa!',
                    html: `
                        <div class="text-left">
                            <p>El presupuesto ha sido reasignado correctamente:</p>
                            <div class="alert alert-success">
                                <strong>Partida Origen:</strong> $${result.data.partida_origen.nuevo_presupuesto.toLocaleString()}<br>
                                <strong>Partida Destino:</strong> $${result.data.partida_destino.nuevo_presupuesto.toLocaleString()}
                            </div>
                            <p><i class="fas fa-check-circle text-success"></i> Registro guardado en el historial de ajustes.</p>
                        </div>
                    `,
                    confirmButtonText: 'Aceptar'
                });

                // Refrescar datos
                await this.refrescarValoresPartidas();
                await this.cf.proyectos.cargarResumenFinanciero();
                await this.cf.graficos.cargarGraficos();

            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: result.error || 'Error al reasignar presupuesto'
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error de conexión',
                text: 'No se pudo completar la operación'
            });
        }
    }

    // MÉTODO AUXILIAR: OBTENER PARTIDAS DEL PROYECTO
    async obtenerPartidasProyecto() {
        if (!this.cf.proyectoActual) return [];

        try {
            const response = await fetch(`api/partidas.php?action=listar&proyecto_id=${this.cf.proyectoActual.id}&_=${Date.now()}`);
            const data = await response.json();

            if (data.success && data.partidas) {
                return data.partidas;
            }
        } catch (error) {
            console.error('Error obteniendo partidas:', error);
        }

        return [];
    }

    // ============================================
    // MÉTODO ACTUALIZADO: verDetallesPartida con consolidación de subpartidas (usando cache)
    // ============================================
    async verDetallesPartida(partidaId) {
        try {
            // 1. Obtener la partida desde el cache local (que ya tiene la jerarquía completa)
            let partida = this.cf.partidasCache.find(p => p.id == partidaId);
            if (!partida) {
                // Fallback: si no está en cache, llamar a la API
                const response = await fetch(`api/partidas.php?action=obtener&id=${partidaId}&_=${Date.now()}`);
                const data = await response.json();
                if (!data.success) throw new Error(data.error || 'Partida no encontrada');
                partida = data.partida;
            }

            const esPrincipal = partida.tipo === 'Principal';
            let transacciones = [];
            let origenTexto = '';

            // 2. Recolectar transacciones
            if (esPrincipal && partida.subpartidas && partida.subpartidas.length > 0) {
                // Obtener IDs de todas las subpartidas (recursivo)
                const idsSubpartidas = this.obtenerIdsSubpartidasRecursivo(partida);
                // Obtener transacciones de cada subpartida en paralelo
                const promises = idsSubpartidas.map(id =>
                    fetch(`api/transacciones.php?action=listar-todas&partida_id=${id}&_=${Date.now()}`)
                        .then(res => res.json())
                        .then(data => data.success ? data.transacciones : [])
                        .catch(() => [])
                );
                const resultados = await Promise.all(promises);
                transacciones = resultados.flat();
                origenTexto = `Mostrando transacciones consolidadas de ${idsSubpartidas.length} subpartida(s)`;
            } else {
                // Partida secundaria o principal sin subpartidas
                const responseTrans = await fetch(`api/transacciones.php?action=listar-todas&partida_id=${partidaId}&_=${Date.now()}`);
                const dataTrans = await responseTrans.json();
                transacciones = dataTrans.success ? dataTrans.transacciones : [];
                origenTexto = 'Transacciones directas de esta partida';
            }

            // Ordenar por fecha descendente (más reciente primero)
            transacciones.sort((a, b) => new Date(b.fecha_transaccion) - new Date(a.fecha_transaccion));

            // 3. Obtener rol del usuario para mostrar/ocultar botón recibo
            let userRole = '';
            try {
                const userData = localStorage.getItem('user');
                if (userData) {
                    const user = JSON.parse(userData);
                    userRole = user.role ? user.role.toLowerCase() : '';
                }
            } catch (e) { console.error('Error obteniendo rol:', e); }
            const mostrarBotonRecibo = (userRole === 'admin' || userRole === 'administrador' || userRole === 'contab' || userRole === 'contador');

            // 4. Calcular estadísticas (usando valores reales de la partida)
            const asignado = parseFloat(partida.presupuesto_asignado) || 0;
            const totalGastado = parseFloat(partida.total_gastado_real) ||
                transacciones.filter(t => t.tipo === 'Egreso').reduce((sum, t) => sum + parseFloat(t.monto), 0);
            const disponible = parseFloat(partida.disponible_real) || parseFloat(partida.presupuesto_actual) || 0;
            const porcentajeGastado = asignado > 0 ? (totalGastado / asignado) * 100 : 0;
            const porcentajeDisponible = asignado > 0 ? (disponible / asignado) * 100 : 0;

            // 5. Formatear fecha
            const formatDate = (dateString) => {
                if (!dateString) return 'Sin fecha';
                const date = new Date(dateString);
                const day = String(date.getUTCDate()).padStart(2, '0');
                const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                const year = date.getUTCFullYear();
                return `${day}/${month}/${year}`;
            };

            // 6. Construir HTML con TODOS los estilos originales (para que no se deforme)
            const detallesHTML = `
            <div class="detalles-partida-container">
                <style>
                    .detalles-header {
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 8px;
                        margin-bottom: 15px;
                        border-left: 4px solid #007bff;
                    }
                    
                    .detalles-header h4 {
                        margin: 0;
                        color: #2c3e50;
                        font-size: 1.1rem;
                    }
                    
                    .detalles-header .codigo-partida {
                        background: #007bff;
                        color: white;
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 0.8rem;
                        font-weight: normal;
                    }
                    
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 15px;
                        margin-bottom: 20px;
                    }
                    
                    .stat-card {
                        background: white;
                        border: 1px solid #e0e0e0;
                        border-radius: 6px;
                        padding: 12px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    }
                    
                    .stat-card .stat-label {
                        font-size: 0.8rem;
                        color: #6c757d;
                        margin-bottom: 5px;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    
                    .stat-card .stat-value {
                        font-size: 1.2rem;
                        font-weight: bold;
                        color: #2c3e50;
                        margin: 0;
                    }
                    
                    .stat-card .stat-value.saludable { color: #28a745; }
                    .stat-card .stat-value.advertencia { color: #ffc107; }
                    .stat-card .stat-value.peligro { color: #dc3545; }
                    
                    .valor-real-badge {
                        background: #17a2b8;
                        color: white;
                        padding: 2px 6px;
                        border-radius: 10px;
                        font-size: 0.7rem;
                        margin-left: 5px;
                    }
                    
                    .transacciones-section {
                        margin-top: 20px;
                    }
                    
                    .transacciones-table {
                        width: 100%;
                        font-size: 0.8rem;
                    }
                    
                    .transacciones-table th {
                        background: #f8f9fa;
                        color: #495057;
                        font-weight: 500;
                        padding: 8px 10px;
                        text-align: center;
                        border-bottom: 2px solid #dee2e6;
                        position: sticky;
                        top: 0;
                        font-size: 0.7rem;
                    }
                    
                    .transacciones-table td {
                        padding: 6px 10px;
                        border-bottom: 1px solid #e9ecef;
                        vertical-align: middle;
                        font-size: 0.65rem;
                    }
                    
                    .transacciones-table tr:hover {
                        background: #f8f9fa;
                    }
                    
                    .monto-egreso {
                        color: #dc3545;
                        font-weight: 600;
                    }
                    
                    .monto-ingreso {
                        color: #28a745;
                        font-weight: 600;
                    }
                    
                    .transacciones-table-container {
                        max-height: 300px;
                        overflow-y: auto;
                        border: 1px solid #dee2e6;
                        border-radius: 6px;
                    }
                    
                    .no-transacciones {
                        text-align: center;
                        padding: 40px;
                        color: #6c757d;
                        background: #f8f9fa;
                        border-radius: 6px;
                        border: 2px dashed #dee2e6;
                    }
                    
                    .modal-actions {
                        display: flex;
                        gap: 10px;
                        margin-top: 20px;
                        padding-top: 15px;
                        border-top: 1px solid #e9ecef;
                    }
                    
                    .actualizacion-info {
                        text-align: center;
                        padding: 8px;
                        background: #e7f3ff;
                        border-radius: 6px;
                        margin-bottom: 15px;
                        font-size: 0.6rem;
                        color: #0c5460;
                    }
                    
                    .actualizacion-info i {
                        color: #17a2b8;
                    }
                    
                    .btn-recibo {
                        padding: 2px 8px;
                        font-size: 0.7rem;
                        background: #17a2b8;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    .btn-recibo:hover {
                        background: #138496;
                    }
                </style>
                
                <!-- Información de actualización -->
                <div class="actualizacion-info">
                    <i class="fas fa-sync-alt"></i> 
                    Valores actualizados al ${new Date().toLocaleTimeString('es-ES')}
                    <span class="valor-real-badge">Datos Reales</span>
                </div>
                
                <!-- Encabezado -->
                <div class="detalles-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <h4>
                            <span class="codigo-partida">${partida.codigo || partida.id}</span>
                            ${partida.nombre || 'Sin nombre'}
                        </h4>
                        <span class="badge ${porcentajeDisponible > 30 ? 'badge-success' : porcentajeDisponible > 10 ? 'badge-warning' : 'badge-danger'}">
                            ${porcentajeDisponible.toFixed(1)}% disponible
                        </span>
                    </div>
                    ${partida.descripcion ? `<p class="mt-2 mb-0 text-muted">${partida.descripcion}</p>` : ''}
                </div>
                
                <!-- Estadísticas -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label"><i class="fas fa-money-bill-wave"></i> Presupuesto Asignado</div>
                        <p class="stat-value">$${asignado.toLocaleString()}</p>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label"><i class="fas fa-check-circle"></i> Disponible <span class="valor-real-badge">BD</span></div>
                        <p class="stat-value ${disponible >= 0 ? 'saludable' : 'peligro'}">$${disponible.toLocaleString()}</p>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label"><i class="fas fa-receipt"></i> Total Gastado <span class="valor-real-badge">BD</span></div>
                        <p class="stat-value ${totalGastado > asignado * 0.8 ? 'peligro' : totalGastado > asignado * 0.5 ? 'advertencia' : 'saludable'}">$${totalGastado.toLocaleString()}</p>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label"><i class="fas fa-percentage"></i> % Gastado</div>
                        <p class="stat-value">${porcentajeGastado.toFixed(1)}%</p>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label"><i class="fas fa-percentage"></i> % Disponible</div>
                        <p class="stat-value ${porcentajeDisponible > 30 ? 'saludable' : porcentajeDisponible > 10 ? 'advertencia' : 'peligro'}">${porcentajeDisponible.toFixed(1)}%</p>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label"><i class="fas fa-database"></i> Última Actualización</div>
                        <p class="stat-value" style="font-size: 0.9rem;">${new Date().toLocaleTimeString('es-ES')}</p>
                    </div>
                </div>
                
                <!-- Barra de progreso -->
                <div class="progress mb-4" style="height: 25px;">
                    <div class="progress-bar bg-success" style="width: ${porcentajeDisponible}%" title="Disponible: ${porcentajeDisponible.toFixed(1)}%">
                        ${porcentajeDisponible >= 10 ? `${porcentajeDisponible.toFixed(1)}%` : ''}
                    </div>
                    <div class="progress-bar bg-warning" style="width: ${porcentajeGastado}%" title="Gastado: ${porcentajeGastado.toFixed(1)}%">
                        ${porcentajeGastado >= 10 ? `${porcentajeGastado.toFixed(1)}%` : ''}
                    </div>
                </div>
                
                <!-- Tabla de transacciones -->
                <div class="transacciones-section">
                    <h5>
                        <i class="fas fa-receipt"></i>
                        Transacciones (${transacciones.length})
                        <small class="text-muted">- ${origenTexto}</small>
                    </h5>
                    
                    ${transacciones.length > 0 ? `
                        <div class="transacciones-table-container">
                            <table class="transacciones-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Concepto</th>
                                        <th>Monto (USD)</th>
                                        <th>Moneda Pago</th>
                                        <th>Tasa Cambio</th>
                                        <th>Equivalente</th>
                                        <th>Beneficiario</th>
                                        <th>Referencia</th>
                                        ${mostrarBotonRecibo ? '<th>Acciones</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${transacciones.map(trans => {
                const montoUSD = parseFloat(trans.monto) || 0;
                const tasa = parseFloat(trans.tasa_cambio) || 1;
                const moneda = trans.moneda || 'USD';
                let equivalente = montoUSD;
                let tasaMostrar = '1.0000';
                if (moneda !== 'USD' && tasa > 0) {
                    equivalente = montoUSD * tasa;
                    tasaMostrar = tasa.toFixed(4);
                }
                let simboloMoneda = '$';
                if (moneda === 'BS') simboloMoneda = 'Bs.';
                if (moneda === 'EUR') simboloMoneda = '€';
                return `
                                            <tr data-transaccion-id="${trans.id}">
                                                <td>${formatDate(trans.fecha_transaccion)}</td>
                                                <td>${trans.concepto || 'Sin concepto'}</td>
                                                <td class="${trans.tipo === 'Egreso' ? 'monto-egreso' : 'monto-ingreso'}">
                                                    <strong>$${montoUSD.toFixed(2)}</strong>
                                                </td>
                                                <td>
                                                    <span class="badge ${moneda === 'USD' ? 'badge-success text-dark' : moneda === 'BS' ? 'badge-info text-dark' : 'badge-warning text-dark'}">
                                                        ${moneda}
                                                    </span>
                                                </td>
                                                <td><span class="tasa-cambio">${tasaMostrar}</span></td>
                                                <td>
                                                    ${moneda !== 'USD' ?
                        `<span class="${trans.tipo === 'Egreso' ? 'monto-egreso' : 'monto-ingreso'}">
                                                            ${simboloMoneda}${equivalente.toFixed(2)}
                                                        </span>` :
                        '<span class="text-muted">-</span>'
                    }
                                                </td>
                                                <td>${trans.beneficiario || 'N/A'}</td>
                                                <td>${trans.numero_documento || 'N/A'}</td>
                                                ${mostrarBotonRecibo ? `
                                                    <td>
                                                        <button class="btn-recibo" data-id="${trans.id}">
                                                            <i class="fas fa-receipt"></i> Recibo
                                                        </button>
                                                    </td>
                                                ` : ''}
                                            </table>
                                        `;
            }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="no-transacciones">
                            <i class="fas fa-file-invoice-dollar"></i>
                            <p class="mb-0">No hay transacciones registradas para esta partida o sus subpartidas.</p>
                        </div>
                    `}
                </div>
                
                <!-- Acciones -->
                <div class="modal-actions">
                    ${partida.tipo !== 'Principal' ? `
                        <button class="btn btn-primary btn-roles" onclick="window.controlFlujo.ui.mostrarModalRegistrarEgreso(${partidaId})">
                            <i class="fas fa-money-bill-wave"></i> Registrar Egreso
                        </button>
                    ` : `
                        <button class="btn btn-secondary" disabled title="No se pueden registrar egresos en partidas principales">
                            <i class="fas fa-ban"></i> Solo subpartidas permiten egresos
                        </button>
                    `}
                    <button class="btn btn-info btn-roles" onclick="window.controlFlujo.partidas.ajustarPresupuesto(${partidaId})">
                        <i class="fas fa-edit"></i> Ajustar/Reasignar
                    </button>
                    <button class="btn btn-outline-info" onclick="window.controlFlujo.partidas.refrescarValoresPartidas()">
                        <i class="fas fa-sync-alt"></i> Actualizar
                    </button>
                    <button class="btn btn-outline-secondary" onclick="Swal.close()">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                </div>
            </div>
            `;

            // Mostrar modal
            await Swal.fire({
                title: `<i class="fas fa-chart-bar"></i> Detalles de Partida`,
                html: detallesHTML,
                width: '1000px',
                customClass: {
                    popup: 'detalles-partida-modal',
                    container: 'detalles-container'
                },
                showConfirmButton: false,
                showCloseButton: true,
                scrollbarPadding: false,
                didOpen: () => {
                    if (mostrarBotonRecibo) {
                        document.querySelectorAll('.btn-recibo').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const transaccionId = btn.getAttribute('data-id');
                                if (transaccionId) this.generarReciboTransaccion(transaccionId);
                            });
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Error en verDetallesPartida:', error);
            this.cf.ui.mostrarError('Error al cargar detalles de la partida');
        }
    }

    // Método auxiliar para obtener IDs de subpartidas recursivamente
    obtenerIdsSubpartidasRecursivo(partida) {
        let ids = [];
        if (!partida.subpartidas || partida.subpartidas.length === 0) return ids;
        for (const sub of partida.subpartidas) {
            ids.push(sub.id);
            if (sub.subpartidas && sub.subpartidas.length > 0) {
                ids = ids.concat(this.obtenerIdsSubpartidasRecursivo(sub));
            }
        }
        return ids;
    }

    // ============================================
    // MÉTODO ACTUALIZADO: verDetallesPartida con consolidación de subpartidas
    // ============================================
    async verDetallesPartida(partidaId) {
        try {
            // Obtener datos actualizados de la partida (desde el cache para tener el árbol)
            let partida = this.cf.partidasCache.find(p => p.id == partidaId);
            if (!partida) {
                // Si no está en cache, obtener por API
                const response = await fetch(`api/partidas.php?action=obtener&id=${partidaId}&_=${Date.now()}`);
                const data = await response.json();
                if (!data.success) throw new Error(data.error);
                partida = data.partida;
            }

            const esPrincipal = partida.tipo === 'Principal';

            // ---------- 1. Obtener transacciones ----------
            let transacciones = [];
            let origenTexto = '';

            if (esPrincipal && partida.subpartidas && partida.subpartidas.length > 0) {
                // Recolectar IDs de todas las subpartidas (recursivo)
                const idsSubpartidas = this.obtenerIdsSubpartidasRecursivo(partida);
                // Obtener transacciones de cada subpartida (paralelo)
                const promises = idsSubpartidas.map(id =>
                    fetch(`api/transacciones.php?action=listar-todas&partida_id=${id}&_=${Date.now()}`)
                        .then(res => res.json())
                        .then(data => data.success ? data.transacciones : [])
                        .catch(() => [])
                );
                const resultados = await Promise.all(promises);
                transacciones = resultados.flat();
                origenTexto = `Mostrando transacciones consolidadas de ${idsSubpartidas.length} subpartida(s)`;
            } else {
                // Partida secundaria o principal sin subpartidas
                const response = await fetch(`api/transacciones.php?action=listar-todas&partida_id=${partidaId}&_=${Date.now()}`);
                const data = await response.json();
                transacciones = data.success ? data.transacciones : [];
                origenTexto = 'Transacciones directas de esta partida';
            }

            // Ordenar por fecha descendente (más reciente primero)
            transacciones.sort((a, b) => new Date(b.fecha_transaccion) - new Date(a.fecha_transaccion));

            // Obtener rol del usuario para mostrar botón recibo
            let userRole = '';
            try {
                const userData = localStorage.getItem('user');
                if (userData) {
                    const user = JSON.parse(userData);
                    userRole = user.role ? user.role.toLowerCase() : '';
                }
            } catch (e) { console.error('Error obteniendo rol:', e); }
            const mostrarBotonRecibo = (userRole === 'admin' || userRole === 'administrador' || userRole === 'contab' || userRole === 'contador');

            // Calcular estadísticas reales
            const totalGastado = parseFloat(partida.total_gastado_real) ||
                transacciones.filter(t => t.tipo === 'Egreso').reduce((sum, t) => sum + parseFloat(t.monto), 0);
            const disponible = parseFloat(partida.disponible_real) || parseFloat(partida.presupuesto_actual) || 0;
            const asignado = parseFloat(partida.presupuesto_asignado) || 0;
            const porcentajeGastado = asignado > 0 ? (totalGastado / asignado) * 100 : 0;
            const porcentajeDisponible = asignado > 0 ? (disponible / asignado) * 100 : 0;

            // Formateador de fecha UTC
            const formatDate = (dateString) => {
                if (!dateString) return 'Sin fecha';
                const date = new Date(dateString);
                const day = String(date.getUTCDate()).padStart(2, '0');
                const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                const year = date.getUTCFullYear();
                return `${day}/${month}/${year}`;
            };

            // ---------- 2. Construir HTML del modal (con estilos completos) ----------
            const modalHTML = `
        <div class="detalles-partida-container" style="font-family: Arial, sans-serif;">
            <style>
                /* Estilos para el modal de detalles */
                .detalles-header { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #007bff; }
                .detalles-header h4 { margin: 0; color: #2c3e50; font-size: 1.1rem; }
                .codigo-partida { background: #007bff; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; }
                .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
                .stat-card { background: white; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                .stat-label { font-size: 0.75rem; color: #6c757d; margin-bottom: 5px; display: flex; align-items: center; gap: 5px; }
                .stat-value { font-size: 1.1rem; font-weight: bold; margin: 0; }
                .stat-value.saludable { color: #28a745; }
                .stat-value.advertencia { color: #ffc107; }
                .stat-value.peligro { color: #dc3545; }
                .valor-real-badge { background: #17a2b8; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.65rem; margin-left: 5px; }
                .actualizacion-info { text-align: center; padding: 6px; background: #e7f3ff; border-radius: 6px; margin-bottom: 15px; font-size: 0.7rem; color: #0c5460; }
                .transacciones-section { margin-top: 20px; }
                .transacciones-table-container { max-height: 350px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 6px; }
                .transacciones-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
                .transacciones-table th { background: #f8f9fa; padding: 8px 6px; text-align: center; border-bottom: 2px solid #dee2e6; position: sticky; top: 0; font-weight: 600; }
                .transacciones-table td { padding: 6px; border-bottom: 1px solid #e9ecef; vertical-align: middle; }
                .monto-egreso { color: #dc3545; font-weight: 600; }
                .monto-ingreso { color: #28a745; font-weight: 600; }
                .badge { display: inline-block; padding: 2px 6px; font-size: 0.7rem; border-radius: 10px; }
                .badge-success { background: #d4edda; color: #155724; }
                .badge-info { background: #d1ecf1; color: #0c5460; }
                .badge-warning { background: #fff3cd; color: #856404; }
                .btn-recibo { background: #17a2b8; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 0.7rem; cursor: pointer; }
                .btn-recibo:hover { background: #138496; }
                .no-transacciones { text-align: center; padding: 30px; color: #6c757d; background: #f8f9fa; border-radius: 6px; border: 2px dashed #dee2e6; }
                .modal-actions { display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e9ecef; }
                .progress { height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 15px 0; display: flex; }
                .progress-bar { text-align: center; color: white; line-height: 20px; font-size: 0.7rem; }
                .bg-success { background-color: #28a745; }
                .bg-warning { background-color: #ffc107; color: #212529; }
            </style>

            <div class="actualizacion-info">
                <i class="fas fa-sync-alt"></i> Valores actualizados al ${new Date().toLocaleTimeString('es-ES')}
                <span class="valor-real-badge">Datos Reales</span>
            </div>

            <div class="detalles-header">
                <div class="d-flex justify-content-between align-items-center">
                    <h4><span class="codigo-partida">${partida.codigo || partida.id}</span> ${partida.nombre || 'Sin nombre'}</h4>
                    <span class="badge ${porcentajeDisponible > 30 ? 'badge-success' : porcentajeDisponible > 10 ? 'badge-warning' : 'badge-danger'}" style="background: ${porcentajeDisponible > 30 ? '#d4edda' : porcentajeDisponible > 10 ? '#fff3cd' : '#f8d7da'}; color: ${porcentajeDisponible > 30 ? '#155724' : porcentajeDisponible > 10 ? '#856404' : '#721c24'};">${porcentajeDisponible.toFixed(1)}% disponible</span>
                </div>
                ${partida.descripcion ? `<p class="mt-2 mb-0 text-muted" style="font-size:0.85rem;">${partida.descripcion}</p>` : ''}
            </div>

            <div class="stats-grid">
                <div class="stat-card"><div class="stat-label"><i class="fas fa-money-bill-wave"></i> Asignado</div><p class="stat-value">$${asignado.toLocaleString()}</p></div>
                <div class="stat-card"><div class="stat-label"><i class="fas fa-check-circle"></i> Disponible <span class="valor-real-badge">BD</span></div><p class="stat-value ${disponible >= 0 ? 'saludable' : 'peligro'}">$${disponible.toLocaleString()}</p></div>
                <div class="stat-card"><div class="stat-label"><i class="fas fa-receipt"></i> Gastado <span class="valor-real-badge">BD</span></div><p class="stat-value ${totalGastado > asignado * 0.8 ? 'peligro' : totalGastado > asignado * 0.5 ? 'advertencia' : 'saludable'}">$${totalGastado.toLocaleString()}</p></div>
                <div class="stat-card"><div class="stat-label"><i class="fas fa-percentage"></i> % Gastado</div><p class="stat-value">${porcentajeGastado.toFixed(1)}%</p></div>
                <div class="stat-card"><div class="stat-label"><i class="fas fa-percentage"></i> % Disponible</div><p class="stat-value ${porcentajeDisponible > 30 ? 'saludable' : porcentajeDisponible > 10 ? 'advertencia' : 'peligro'}">${porcentajeDisponible.toFixed(1)}%</p></div>
                <div class="stat-card"><div class="stat-label"><i class="fas fa-database"></i> Actualización</div><p class="stat-value" style="font-size:0.85rem;">${new Date().toLocaleTimeString('es-ES')}</p></div>
            </div>

            <div class="progress">
                <div class="progress-bar bg-success" style="width: ${porcentajeDisponible}%">${porcentajeDisponible >= 10 ? porcentajeDisponible.toFixed(1) + '%' : ''}</div>
                <div class="progress-bar bg-warning" style="width: ${porcentajeGastado}%">${porcentajeGastado >= 10 ? porcentajeGastado.toFixed(1) + '%' : ''}</div>
            </div>

            <div class="transacciones-section">
                <h5 style="margin-bottom: 10px;"><i class="fas fa-receipt"></i> Transacciones (${transacciones.length}) <small style="font-size:0.7rem;">- ${origenTexto}</small></h5>
                ${transacciones.length > 0 ? `
                <div class="transacciones-table-container">
                    <table class="transacciones-table">
                        <thead>
                            <tr><th>Fecha</th><th>Concepto</th><th>Monto (USD)</th><th>Moneda</th><th>Tasa</th><th>Equivalente</th><th>Beneficiario</th><th>Referencia</th>${mostrarBotonRecibo ? '<th>Acciones</th>' : ''}</tr>
                        </thead>
                        <tbody>
                            ${transacciones.map(trans => {
                const montoUSD = parseFloat(trans.monto) || 0;
                const tasa = parseFloat(trans.tasa_cambio) || 1;
                const moneda = trans.moneda || 'USD';
                let equivalente = montoUSD;
                let tasaMostrar = '1.0000';
                if (moneda !== 'USD' && tasa > 0) {
                    equivalente = montoUSD * tasa;
                    tasaMostrar = tasa.toFixed(4);
                }
                let simboloMoneda = moneda === 'USD' ? '$' : (moneda === 'BS' ? 'Bs.' : '€');
                return `
                                    <tr>
                                        <td>${formatDate(trans.fecha_transaccion)}</td>
                                        <td>${trans.concepto || 'Sin concepto'}</td>
                                        <td class="${trans.tipo === 'Egreso' ? 'monto-egreso' : 'monto-ingreso'}"><strong>$${montoUSD.toFixed(2)}</strong></td>
                                        <td><span class="badge ${moneda === 'USD' ? 'badge-success' : moneda === 'BS' ? 'badge-info' : 'badge-warning'}">${moneda}</span></td>
                                        <td>${tasaMostrar}</td>
                                        <td>${moneda !== 'USD' ? `<span class="${trans.tipo === 'Egreso' ? 'monto-egreso' : 'monto-ingreso'}">${simboloMoneda}${equivalente.toFixed(2)}</span>` : '-'}</td>
                                        <td>${trans.beneficiario || 'N/A'}</td>
                                        <td>${trans.numero_documento || 'N/A'}</td>
                                        ${mostrarBotonRecibo ? `<td><button class="btn-recibo" data-id="${trans.id}"><i class="fas fa-receipt"></i> Recibo</button></td>` : ''}
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
                ` : `
                <div class="no-transacciones">
                    <i class="fas fa-file-invoice-dollar"></i>
                    <p>No hay transacciones registradas para esta partida o sus subpartidas.</p>
                </div>
                `}
            </div>

            <div class="modal-actions">
                ${mostrarBotonRecibo ? (
                                !esPrincipal ? `
                        <button class="btn btn-primary btn-sm" onclick="window.controlFlujo.ui.mostrarModalRegistrarEgreso(${partidaId})">
                            <i class="fas fa-money-bill-wave"></i> Registrar Egreso
                        </button>
                    ` : `
                        <button class="btn btn-secondary btn-sm" disabled>
                            <i class="fas fa-ban"></i> Sin egresos directos
                        </button>
                    `
                            ) : ''}
                ${mostrarBotonRecibo ? `
                    <button class="btn btn-info btn-sm" onclick="window.controlFlujo.partidas.ajustarPresupuesto(${partidaId})">
                        <i class="fas fa-edit"></i> Ajustar/Reasignar
                    </button>
                ` : ''}
                <button class="btn btn-outline-secondary btn-sm" onclick="Swal.close()">
                    <i class="fas fa-times"></i> Cerrar
                </button>
            </div>
        </div>
        `;

            await Swal.fire({
                title: `<i class="fas fa-chart-bar"></i> Detalles de Partida`,
                html: modalHTML,
                width: '1100px',
                showConfirmButton: false,
                showCloseButton: true,
                didOpen: () => {
                    if (mostrarBotonRecibo) {
                        document.querySelectorAll('.btn-recibo').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const transId = btn.getAttribute('data-id');
                                if (transId) this.generarReciboTransaccion(transId);
                            });
                        });
                    }
                }
            });

        } catch (error) {
            console.error('Error en verDetallesPartida:', error);
            this.cf.ui.mostrarError('Error al cargar detalles de la partida');
        }
    }

    // Método auxiliar para obtener recursivamente IDs de todas las subpartidas
    obtenerIdsSubpartidasRecursivo(partida) {
        let ids = [];
        if (!partida.subpartidas || partida.subpartidas.length === 0) return ids;
        for (const sub of partida.subpartidas) {
            ids.push(sub.id);
            if (sub.subpartidas && sub.subpartidas.length > 0) {
                ids = ids.concat(this.obtenerIdsSubpartidasRecursivo(sub));
            }
        }
        return ids;
    }

    // ============================================
    // MÉTODO PARA GENERAR RECIBO DE TRANSACCIÓN
    // ============================================
    async generarReciboTransaccion(transaccionId) {
        try {
            // Obtener datos de la transacción desde el backend
            const response = await fetch(`api/transacciones.php?action=obtener&id=${transaccionId}&_=${Date.now()}`);
            const data = await response.json();

            if (!data.success || !data.transaccion) {
                this.cf.ui.mostrarError('No se pudo obtener los datos de la transacción');
                return;
            }

            const trans = data.transaccion;

            // Formatear fecha
            const fechaObj = new Date(trans.fecha_transaccion);
            const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            // Determinar tipo (Egreso/Ingreso) y estilos
            const esEgreso = trans.tipo === 'Egreso';
            const tipoTexto = esEgreso ? 'EGRESO / GASTO' : 'INGRESO / ABONO';
            const colorTitulo = esEgreso ? '#dc3545' : '#28a745';
            const montoFormateado = parseFloat(trans.monto).toLocaleString('es-VE', { minimumFractionDigits: 2 });
            const tasa = parseFloat(trans.tasa_cambio) || 1;
            const moneda = trans.moneda || 'USD';
            let equivalente = parseFloat(trans.monto);
            if (moneda !== 'USD' && tasa > 0) {
                equivalente = parseFloat(trans.monto) * tasa;
            }
            const simboloMoneda = moneda === 'USD' ? '$' : (moneda === 'BS' ? 'Bs.' : '€');

            // Obtener nombre del proyecto y partida
            let proyectoNombre = 'No especificado';
            let partidaNombre = 'No especificada';
            try {
                if (trans.proyecto_id) {
                    const proyRes = await fetch(`api/proyectos.php?action=obtener&id=${trans.proyecto_id}`);
                    const proyData = await proyRes.json();
                    if (proyData.success) proyectoNombre = proyData.proyecto.nombre;
                }
                if (trans.partida_id) {
                    const partRes = await fetch(`api/partidas.php?action=obtener&id=${trans.partida_id}`);
                    const partData = await partRes.json();
                    if (partData.success) partidaNombre = partData.partida.nombre;
                }
            } catch (e) { console.warn('Error obteniendo nombres', e); }

            // HTML del recibo
            const reciboHTML = `
            <div id="recibo-print" style="font-family: 'Courier New', monospace; max-width: 400px; margin: 0 auto; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <div style="text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 10px; margin-bottom: 15px;">
                    <h2 style="margin: 0; color: ${colorTitulo};">CODEHCIU</h2>
                    <p style="margin: 5px 0 0; font-size: 12px;">Comprobante de ${trans.tipo}</p>
                </div>
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong>N° Recibo:</strong> <span>${trans.id}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong>Fecha:</strong> <span>${fechaFormateada}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong>Tipo:</strong> <span style="color: ${colorTitulo};">${tipoTexto}</span>
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>Concepto:</strong> <span>${trans.concepto || 'Sin concepto'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>Monto en USD:</strong> <span style="font-weight: bold;">$${montoFormateado}</span>
                    </div>
                    ${moneda !== 'USD' ? `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <strong>Moneda de Pago:</strong> <span>${moneda}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <strong>Tasa Cambio:</strong> <span>${tasa.toFixed(4)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <strong>Monto Pagado:</strong> <span>${simboloMoneda}${equivalente.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>Beneficiario:</strong> <span>${trans.beneficiario || 'N/A'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>Documento/Referencia:</strong> <span>${trans.numero_documento || 'N/A'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>Método de Pago:</strong> <span>${trans.metodo_pago || 'No especificado'}</span>
                    </div>
                </div>
                <div style="background: #e9ecef; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong>Proyecto:</strong> <span>${proyectoNombre}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <strong>Partida:</strong> <span>${partidaNombre}</span>
                    </div>
                </div>
                <div style="text-align: center; border-top: 2px dashed #ccc; padding-top: 12px; margin-top: 10px; font-size: 10px; color: #6c757d;">
                    Este comprobante es generado por el Sistema de Finanzas CODEHCIU<br>
                    Gracias por su confianza.
                </div>
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <button id="imprimir-recibo" class="btn btn-primary"><i class="fas fa-print"></i> Imprimir / Guardar PDF</button>
            </div>
        `;

            // Mostrar modal con el recibo
            await Swal.fire({
                title: 'Comprobante de Transacción',
                html: reciboHTML,
                width: '500px',
                showConfirmButton: false,
                showCloseButton: true,
                didOpen: () => {
                    const imprimirBtn = document.getElementById('imprimir-recibo');
                    if (imprimirBtn) {
                        imprimirBtn.addEventListener('click', () => {
                            const contenido = document.getElementById('recibo-print').cloneNode(true);
                            const ventana = window.open('', '_blank');
                            ventana.document.write(`
                            <html>
                                <head><title>Recibo CODEHCIU</title></head>
                                <body style="margin:0; padding:20px;">${contenido.outerHTML}</body>
                            </html>
                        `);
                            ventana.document.close();
                            ventana.print();
                            ventana.close();
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Error generando recibo:', error);
            this.cf.ui.mostrarError('Error al generar el recibo');
        }
    }

    // ============================================
    // MÉTODOS AUXILIARES EXISTENTES (sin cambios)
    // ============================================

    mostrarModalCrearPartida() {
        if (this.cf.ui && this.cf.ui.mostrarModalCrearPartida) {
            this.cf.ui.mostrarModalCrearPartida();
        } else {
            const modal = document.getElementById('modal-crear-partida');
            if (modal && window.bootstrap) {
                const bsModal = new bootstrap.Modal(modal);
                bsModal.show();
            }
        }
    }

    toggleSubpartidas(partidaId) {
        const container = document.getElementById(`subpartidas-container-${partidaId}`);
        const btn = document.querySelector(`button[data-partida-id="${partidaId}"]`);

        if (container && btn) {
            if (container.style.display === 'none' || container.classList.contains('oculto')) {
                container.style.display = 'block';
                container.classList.remove('oculto');
                btn.innerHTML = `
                    <i class="fas fa-chevron-up"></i> 
                    Ocultar Subpartidas
                `;
                this.subpartidasExpandidas.add(partidaId);
            } else {
                container.style.display = 'none';
                container.classList.add('oculto');
                btn.innerHTML = `
                    <i class="fas fa-chevron-down"></i> 
                    Ver Subpartidas
                `;
                this.subpartidasExpandidas.delete(partidaId);
            }
        }
    }

    expandirSubpartidas(partidaId) {
        const container = document.getElementById(`subpartidas-container-${partidaId}`);
        const btn = document.querySelector(`button[data-partida-id="${partidaId}"]`);

        if (container && btn) {
            container.style.display = 'block';
            container.classList.remove('oculto');
            btn.innerHTML = `
                <i class="fas fa-chevron-up"></i> 
                Ocultar Subpartidas
            `;
            this.subpartidasExpandidas.add(partidaId);
        }
    }

    colapsarSubpartidas(partidaId) {
        const container = document.getElementById(`subpartidas-container-${partidaId}`);
        const btn = document.querySelector(`button[data-partida-id="${partidaId}"]`);

        if (container && btn) {
            container.style.display = 'none';
            container.classList.add('oculto');
            btn.innerHTML = `
                <i class="fas fa-chevron-down"></i> 
                Ver Subpartidas
            `;
            this.subpartidasExpandidas.delete(partidaId);
        }
    }

    depurarValoresPartidas(partidas) {
        // Método de depuración (puede dejarse vacío o comentado)
    }

    agregarBotonRefresco() {
        const partidasContainer = document.getElementById('lista-partidas');
        if (!partidasContainer) return;
        if (document.getElementById('btn-refrescar-partidas')) return;

        const btnRefrescar = document.createElement('div');
        btnRefrescar.id = 'btn-refrescar-partidas';
        btnRefrescar.className = 'mb-2 d-flex justify-content-between align-items-center';
        btnRefrescar.style.cssText = `
            padding: 5px 10px;
            background: #f8f9fa;
            border-radius: 4px;
            border: 1px solid #e9ecef;
            font-size: 0.85rem;
        `;
        btnRefrescar.innerHTML = `
            <div class="d-flex align-items-center">
                <span class="text-muted me-2">
                    <i class="fas fa-info-circle me-1"></i> 
                    <span id="info-refresh-time">
                        ${this.ultimoRefresh ? this.ultimoRefresh.toLocaleTimeString('es-ES') : 'No actualizado'}
                    </span>
                </span>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-info py-1 px-2" id="btn-refrescar-accion" 
                        style="font-size: 0.8rem; min-height: 28px;">
                    <i class="fas fa-sync-alt me-1"></i> Actualizar
                </button>
            </div>
        `;
        partidasContainer.parentNode.insertBefore(btnRefrescar, partidasContainer);
        document.getElementById('btn-refrescar-accion').onclick = async () => {
            const btn = document.getElementById('btn-refrescar-accion');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;
            await this.refrescarValoresPartidas();
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            if (document.getElementById('info-refresh-time')) {
                document.getElementById('info-refresh-time').textContent = new Date().toLocaleTimeString('es-ES');
            }
        };
    }

    mostrarInfoRefresh() {
        if (document.getElementById('info-refresh-time') && this.ultimoRefresh) {
            document.getElementById('info-refresh-time').textContent = this.ultimoRefresh.toLocaleTimeString('es-ES');
        }
    }

    mostrarLoading(mostrar) {
        const btn = document.getElementById('btn-refrescar-accion');
        if (btn) {
            if (mostrar) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
                btn.disabled = true;
            } else {
                btn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar Valores';
                btn.disabled = false;
            }
        }
    }

    mostrarExito(mensaje) {
        if (this.cf && this.cf.ui && this.cf.ui.mostrarExito) {
            this.cf.ui.mostrarExito(mensaje);
        } else {
            Swal.fire({ icon: 'success', title: 'Éxito', text: mensaje, timer: 2000, showConfirmButton: false });
        }
    }

    mostrarError(mensaje) {
        if (this.cf && this.cf.ui && this.cf.ui.mostrarError) {
            this.cf.ui.mostrarError(mensaje);
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: mensaje });
        }
    }

    renderizarPartidas(partidas) {
        const container = document.getElementById('lista-partidas');
        if (!container) return;
        container.style.cssText = `margin-top: 5px; padding-top: 0;`;
        if (!partidas || partidas.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> No hay partidas creadas para este proyecto.
                    <button class="btn btn-sm btn-primary ml-2" onclick="window.controlFlujo.ui.mostrarModalCrearPartida()">
                        <i class="fas fa-plus"></i> Crear Partida
                    </button>
                </div>
            `;
            return;
        }
        const partidasJerarquia = this.organizarJerarquiaConValoresReales(partidas);
        this.renderizarPartidasJerarquia(partidasJerarquia);
    }

    manejarCambioTipoPartida() {
        const tipoPartida = document.getElementById('tipo_partida');
        const partidaPadreContainer = document.getElementById('partida_padre_container');
        if (tipoPartida && partidaPadreContainer) {
            tipoPartida.addEventListener('change', function () {
                if (this.value === 'Secundaria') {
                    partidaPadreContainer.style.display = 'block';
                } else {
                    partidaPadreContainer.style.display = 'none';
                    const partidaPadreSelect = document.getElementById('partida_padre');
                    if (partidaPadreSelect) partidaPadreSelect.value = '';
                }
            });
        }
    }

    inicializarFiltrosPartidas() {
        const buscador = document.getElementById('buscador-partidas');
        const filtroEstado = document.getElementById('filtro-estado-partidas');
        const filtroTipo = document.getElementById('filtro-tipo-partidas');
        this.filtrosElementos = { buscador, estado: filtroEstado, tipo: filtroTipo };
        if (buscador) buscador.addEventListener('input', () => this.aplicarFiltros());
        if (filtroEstado) filtroEstado.addEventListener('change', () => this.aplicarFiltros());
        if (filtroTipo) filtroTipo.addEventListener('change', () => this.aplicarFiltros());
        this.agregarBotonLimpiarFiltros();
    }

    aplicarFiltros() {
        const terminoBusqueda = document.getElementById('buscador-partidas')?.value.toLowerCase() || '';
        const estadoSeleccionado = document.getElementById('filtro-estado-partidas')?.value || '';
        const tipoSeleccionado = document.getElementById('filtro-tipo-partidas')?.value || '';
        this.filtrosActivos = { busqueda: terminoBusqueda, estado: estadoSeleccionado, tipo: tipoSeleccionado };
        const hayFiltrosActivos = terminoBusqueda || estadoSeleccionado || tipoSeleccionado;
        const partidasCards = document.querySelectorAll('.partida-card[data-nivel="0"]');
        partidasCards.forEach(card => {
            let mostrar = true;
            if (mostrar && terminoBusqueda) {
                const textoCard = card.textContent.toLowerCase();
                const codigo = card.getAttribute('data-codigo') || '';
                const nombre = card.getAttribute('data-nombre') || '';
                if (!textoCard.includes(terminoBusqueda) && !codigo.toLowerCase().includes(terminoBusqueda) && !nombre.toLowerCase().includes(terminoBusqueda)) mostrar = false;
            }
            if (mostrar && tipoSeleccionado) {
                const tipoPartida = card.getAttribute('data-tipo') || '';
                if (tipoSeleccionado !== tipoPartida) mostrar = false;
            }
            if (mostrar && estadoSeleccionado) {
                const estadoPartida = card.getAttribute('data-estado') || '';
                let estadoFiltrado = estadoSeleccionado;
                if (estadoSeleccionado === 'peligro') estadoFiltrado = 'advertencia';
                if (estadoFiltrado !== estadoPartida) mostrar = false;
            }
            card.style.display = mostrar ? 'block' : 'none';
            const partidaId = card.id.replace('partida-', '');
            const tieneSubpartidas = card.getAttribute('data-tiene-subpartidas') === 'true';
            if (tieneSubpartidas) {
                const subpartidasContainer = document.getElementById(`subpartidas-container-${partidaId}`);
                if (subpartidasContainer) {
                    const subpartidasCards = subpartidasContainer.querySelectorAll('.partida-card');
                    let algunaSubpartidaVisible = false;
                    subpartidasCards.forEach(subCard => {
                        let mostrarSubpartida = true;
                        if (terminoBusqueda) {
                            const textoSubCard = subCard.textContent.toLowerCase();
                            const codigoSub = subCard.getAttribute('data-codigo') || '';
                            const nombreSub = subCard.getAttribute('data-nombre') || '';
                            if (!textoSubCard.includes(terminoBusqueda) && !codigoSub.toLowerCase().includes(terminoBusqueda) && !nombreSub.toLowerCase().includes(terminoBusqueda)) mostrarSubpartida = false;
                        }
                        if (mostrarSubpartida && tipoSeleccionado) {
                            const tipoSubpartida = subCard.getAttribute('data-tipo') || '';
                            if (tipoSeleccionado !== tipoSubpartida) mostrarSubpartida = false;
                        }
                        if (mostrarSubpartida && estadoSeleccionado) {
                            const estadoSubpartida = subCard.getAttribute('data-estado') || '';
                            let estadoFiltrado = estadoSeleccionado;
                            if (estadoSeleccionado === 'peligro') estadoFiltrado = 'advertencia';
                            if (estadoFiltrado !== estadoSubpartida) mostrarSubpartida = false;
                        }
                        subCard.style.display = mostrarSubpartida ? 'block' : 'none';
                        if (mostrarSubpartida) algunaSubpartidaVisible = true;
                    });
                    if (hayFiltrosActivos) {
                        if (!this.subpartidasExpandidas.has(partidaId)) this.expandirSubpartidas(partidaId);
                        if (algunaSubpartidaVisible) {
                            subpartidasContainer.style.display = 'block';
                            const btnToggle = document.querySelector(`button[data-partida-id="${partidaId}"]`);
                            if (btnToggle) btnToggle.innerHTML = `<i class="fas fa-chevron-up"></i> Ocultar Subpartidas`;
                        } else if (mostrar) {
                            subpartidasContainer.style.display = 'block';
                        }
                    } else {
                        if (this.subpartidasExpandidas.has(partidaId)) {
                            subpartidasContainer.style.display = 'block';
                        } else {
                            subpartidasContainer.style.display = 'none';
                        }
                        subpartidasCards.forEach(subCard => { subCard.style.display = 'block'; });
                    }
                }
            }
        });
        this.actualizarContadorPartidasVisibles();
    }

    agregarBotonLimpiarFiltros() {
        const filtrosContainer = document.querySelector('.card-body.p-3');
        if (!filtrosContainer || document.getElementById('btn-limpiar-filtros')) return;
        const btnLimpiar = document.createElement('button');
        btnLimpiar.id = 'btn-limpiar-filtros';
        btnLimpiar.className = 'btn btn-sm btn-outline-secondary mt-2';
        btnLimpiar.innerHTML = '<i class="fas fa-times"></i> Limpiar Filtros';
        btnLimpiar.onclick = () => this.limpiarFiltros();
        filtrosContainer.appendChild(btnLimpiar);
    }

    limpiarFiltros() {
        if (this.filtrosElementos.buscador) this.filtrosElementos.buscador.value = '';
        if (this.filtrosElementos.estado) this.filtrosElementos.estado.value = '';
        if (this.filtrosElementos.tipo) this.filtrosElementos.tipo.value = '';
        this.filtrosActivos = { busqueda: '', estado: '', tipo: '' };
        const partidasPrincipales = document.querySelectorAll('.partida-card[data-nivel="0"]');
        partidasPrincipales.forEach(card => { card.style.display = 'block'; });
        const todasLasPartidas = document.querySelectorAll('.partida-card');
        todasLasPartidas.forEach(card => { card.style.display = 'block'; });
        const contenedoresSubpartidas = document.querySelectorAll('.subpartidas-externas');
        contenedoresSubpartidas.forEach(container => {
            const partidaId = container.id.replace('subpartidas-container-', '');
            if (this.subpartidasExpandidas.has(parseInt(partidaId))) {
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }
        });
        this.actualizarContadorPartidasVisibles();
    }

    actualizarContadorPartidasVisibles() {
        const partidasVisibles = document.querySelectorAll('.partida-card[style*="block"]').length;
        const totalPartidas = document.querySelectorAll('.partida-card').length;
        let contadorElement = document.getElementById('contador-filtros');
        if (!contadorElement) {
            const filtrosContainer = document.querySelector('.card-header.bg-light');
            if (filtrosContainer) {
                contadorElement = document.createElement('div');
                contadorElement.id = 'contador-filtros';
                contadorElement.className = 'text-muted small mt-1';
                filtrosContainer.appendChild(contadorElement);
            }
        }
        if (contadorElement) contadorElement.textContent = `Mostrando ${partidasVisibles} de ${totalPartidas} partidas`;
    }

    expandirTodasSubpartidas() {
        const partidasConSubpartidas = document.querySelectorAll('.partida-card[data-tiene-subpartidas="true"]');
        partidasConSubpartidas.forEach(card => {
            const partidaId = card.id.replace('partida-', '');
            this.expandirSubpartidas(partidaId);
        });
    }

    colapsarTodasSubpartidas() {
        const partidasConSubpartidas = document.querySelectorAll('.partida-card[data-tiene-subpartidas="true"]');
        partidasConSubpartidas.forEach(card => {
            const partidaId = card.id.replace('partida-', '');
            this.colapsarSubpartidas(partidaId);
        });
    }
}