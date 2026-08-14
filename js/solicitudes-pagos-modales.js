/**
 * Módulo de modales para Solicitudes de Pagos
 * CODEHCIU - Sistema de Finanzas
 * Con soporte para Honorarios/Terceros
 */

const solicitudesPagosModales = (function () {
    let modalInstances = {};

    // ========== FUNCIÓN AUXILIAR ==========
    function formatearFechaLocal(fechaISO, formato = 'largo') {
        if (!fechaISO) return 'No especificada';
        const fechaParte = fechaISO.split('T')[0].split(' ')[0];
        const partes = fechaParte.split('-');
        if (partes.length !== 3) return fechaISO;
        const [year, month, day] = partes;
        if (formato === 'corto') return `${day}/${month}/${year}`;
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const mesNombre = meses[parseInt(month) - 1];
        return `${parseInt(day)} de ${mesNombre} de ${year}`;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== INICIALIZACIÓN ==========
    function inicializarModales() {
        const modales = [
            'modal-nueva-solicitud-pago', 'modal-ver-solicitud-pago', 'modal-aprobar-solicitud-pago',
            'modal-registrar-pago-pago', 'modal-cerrar-solicitud-pago', 'modal-ver-comprobante-pago'
        ];
        modales.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                modalInstances[id] = new bootstrap.Modal(el);
            } else {
                console.warn(`⚠️ Modal ${id} no encontrado (se omitirá)`);
            }
        });
        configurarEventos();
    }

    function cerrarModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        }
        setTimeout(() => {
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
        }, 150);
    }

    // ========== CONFIGURAR EVENTOS ==========
    function configurarEventos() {
        document.getElementById('btn-guardar-solicitud-pago')?.addEventListener('click', guardarSolicitud);
        document.getElementById('btn-confirmar-aprobacion-pago')?.addEventListener('click', confirmarAprobacion);
        document.getElementById('btn-confirmar-pago-pago')?.addEventListener('click', confirmarPago);
        document.getElementById('btn-confirmar-cierre-pago')?.addEventListener('click', confirmarCierre);
        document.getElementById('btn-agregar-detalle-pago')?.addEventListener('click', agregarDetalle);
        document.getElementById('aprobar-decision-pago')?.addEventListener('change', toggleComentarioRechazo);

        // Evento para checkbox de honorarios
        document.getElementById('solicitud-es-honorario-pago')?.addEventListener('change', toggleTipoBeneficiario);

        // Evento para select de usuarios
        document.getElementById('solicitud-beneficiario-pago')?.addEventListener('change', cargarDatosPagoUsuario);

        const comprobanteInput = document.getElementById('pago-comprobante-pago');
        if (comprobanteInput) comprobanteInput.addEventListener('change', validarImagen);

        ['pago-banco-id-pago', 'pago-numero-transferencia-pago', 'pago-monto-pago', 'pago-beneficiario-pago'].forEach(id => {
            const campo = document.getElementById(id);
            if (campo) {
                campo.addEventListener('input', () => validarCampoPago(id));
                campo.addEventListener('change', () => validarCampoPago(id));
            }
        });

        // Evento para mostrar/ocultar tasa de cambio según moneda
        document.getElementById('cerrar-moneda-pago')?.addEventListener('change', function () {
            const container = document.getElementById('cerrar-tasa-container');
            if (container) {
                if (this.value === 'BS') {
                    container.style.display = 'block';
                    document.getElementById('cerrar-tasa-cambio-pago').required = true;
                } else {
                    container.style.display = 'block';
                    document.getElementById('cerrar-tasa-cambio-pago').required = false;
                    document.getElementById('cerrar-tasa-cambio-pago').value = '';
                }
            }
        });
    }

    // ========== VALIDACIONES ==========
    function validarImagen(event) {
        const file = event.target.files[0];
        const maxSizeMB = 50;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        let errorSpan = document.getElementById('error-imagen-pago');
        let infoSpan = document.getElementById('info-archivo-pago');
        if (!errorSpan) {
            errorSpan = document.createElement('div');
            errorSpan.id = 'error-imagen-pago';
            errorSpan.className = 'text-danger small mt-1';
            event.target.parentNode.appendChild(errorSpan);
        }
        if (!infoSpan) {
            infoSpan = document.createElement('div');
            infoSpan.id = 'info-archivo-pago';
            infoSpan.className = 'text-success small mt-1';
            event.target.parentNode.appendChild(infoSpan);
        }
        if (file) {
            if (file.size > maxSizeBytes) {
                errorSpan.innerHTML = `<i class="fas fa-exclamation-triangle"></i> El archivo pesa ${(file.size / 1024 / 1024).toFixed(2)}MB. Máximo ${maxSizeMB}MB.`;
                errorSpan.style.display = 'block';
                infoSpan.style.display = 'none';
                event.target.value = '';
                return false;
            }
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                errorSpan.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Tipo de archivo no válido. Solo se permiten: JPG, PNG, GIF, WEBP, PDF.`;
                errorSpan.style.display = 'block';
                infoSpan.style.display = 'none';
                event.target.value = '';
                return false;
            }
            infoSpan.innerHTML = `<i class="fas fa-check-circle"></i> Archivo seleccionado: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
            infoSpan.style.display = 'block';
            errorSpan.style.display = 'none';
            return true;
        } else {
            errorSpan.style.display = 'none';
            infoSpan.style.display = 'none';
            return true;
        }
    }

    function validarCampoPago(campoId) {
        const campo = document.getElementById(campoId);
        if (!campo) return true;
        const valor = campo.value.trim();
        let errorSpan = document.getElementById(`error-${campoId}`);
        if (!errorSpan) {
            errorSpan = document.createElement('div');
            errorSpan.id = `error-${campoId}`;
            errorSpan.className = 'text-danger small mt-1';
            campo.parentNode.appendChild(errorSpan);
        }
        switch (campoId) {
            case 'pago-banco-id-pago':
                if (!valor) {
                    errorSpan.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Debe seleccionar un banco';
                    errorSpan.style.display = 'block';
                    campo.style.borderColor = '#dc3545';
                    return false;
                }
                break;
            case 'pago-numero-transferencia-pago':
                if (!valor || valor.length < 5) {
                    errorSpan.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Número de transferencia requerido (mínimo 5 caracteres)';
                    errorSpan.style.display = 'block';
                    campo.style.borderColor = '#dc3545';
                    return false;
                }
                break;
            case 'pago-monto-pago':
                const monto = parseFloat(valor);
                if (!valor || isNaN(monto) || monto <= 0) {
                    errorSpan.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Monto válido mayor a 0';
                    errorSpan.style.display = 'block';
                    campo.style.borderColor = '#dc3545';
                    return false;
                }
                break;
            case 'pago-beneficiario-pago':
                if (!valor || valor.length < 3) {
                    errorSpan.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Beneficiario requerido (mínimo 3 caracteres)';
                    errorSpan.style.display = 'block';
                    campo.style.borderColor = '#dc3545';
                    return false;
                }
                break;
            default: return true;
        }
        errorSpan.style.display = 'none';
        campo.style.borderColor = '#ced4da';
        return true;
    }

    // ========== FUNCIONES PARA HONORARIOS/TERCEROS ==========

    /**
     * Carga la lista de usuarios con datos de pago
     */
    async function cargarUsuariosPago(proyectoId, soloTerceros = false) {
        const select = document.getElementById('solicitud-beneficiario-pago');
        if (!select) return;

        select.innerHTML = '<option value="">Cargando usuarios...</option>';
        select.disabled = true;

        try {
            let url = './api/obtener_usuarios_pago.php?proyecto_id=' + proyectoId;
            if (soloTerceros) url += '&solo_terceros=true';

            const response = await fetch(url);
            const data = await response.json();

            select.innerHTML = '<option value="">Seleccionar beneficiario...</option>';

            if (data.success && data.usuarios && data.usuarios.length > 0) {
                data.usuarios.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;

                    let label = user.nombre;
                    if (user.cargo) label += ` (${user.cargo})`;
                    if (user.datos_pago && user.datos_pago.es_tercero) {
                        label += ' 🏷️ Tercero';
                    }
                    if (user.datos_pago && user.datos_pago.monto_honorarios) {
                        label += ` - $${user.datos_pago.monto_honorarios.toFixed(2)}`;
                    }

                    option.textContent = label;

                    if (user.datos_pago) {
                        option.dataset.banco = user.datos_pago.banco || '';
                        option.dataset.tipoCuenta = user.datos_pago.tipo_cuenta || '';
                        option.dataset.numeroCuenta = user.datos_pago.numero_cuenta || '';
                        option.dataset.numeroCedula = user.datos_pago.numero_cedula || '';
                        option.dataset.formaPago = user.datos_pago.forma_pago || 'Transferencia';
                        option.dataset.montoHonorarios = user.datos_pago.monto_honorarios || 0;
                        option.dataset.esTercero = user.datos_pago.es_tercero ? 'true' : 'false';
                        option.dataset.tipoContrato = user.datos_pago.tipo_contrato || '';
                    }

                    select.appendChild(option);
                });
            } else {
                select.innerHTML = '<option value="">No hay usuarios disponibles</option>';
            }
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            select.innerHTML = '<option value="">Error al cargar usuarios</option>';
        } finally {
            select.disabled = false;
        }
    }

    /**
 * Carga los datos bancarios del usuario seleccionado y los detalles automáticos
 */
    function cargarDatosPagoUsuario() {
        const select = document.getElementById('solicitud-beneficiario-pago');
        const selectedOption = select.options[select.selectedIndex];

        const bancoInput = document.getElementById('solicitud-banco-pago');
        const cuentaInput = document.getElementById('solicitud-cuenta-pago');
        const documentoInput = document.getElementById('solicitud-documento-pago');
        const formaPagoInput = document.getElementById('solicitud-forma-pago-pago');
        const montoInput = document.getElementById('solicitud-monto-honorarios-pago');
        const tipoContratoInput = document.getElementById('solicitud-tipo-contrato-pago');
        const infoDiv = document.getElementById('info-datos-pago');
        const conceptoInput = document.getElementById('solicitud-concepto-pago');
        const detallesContainer = document.getElementById('detalles-container-pago');

        if (!selectedOption || !selectedOption.value) {
            // Limpiar campos
            if (bancoInput) bancoInput.value = '';
            if (cuentaInput) cuentaInput.value = '';
            if (documentoInput) documentoInput.value = '';
            if (formaPagoInput) formaPagoInput.value = 'Transferencia';
            if (montoInput) montoInput.value = '';
            if (tipoContratoInput) tipoContratoInput.value = '';
            if (infoDiv) infoDiv.textContent = 'Seleccione un usuario para ver sus datos de pago';

            // Limpiar detalles de honorarios y dejar solo uno vacío
            if (detallesContainer) {
                // Eliminar todos los detalles
                detallesContainer.innerHTML = '';
                // Agregar un detalle vacío
                agregarDetalle();
            }

            calcularTotalPago();
            return;
        }

        // Cargar datos del option
        const banco = selectedOption.dataset.banco || '';
        const numeroCuenta = selectedOption.dataset.numeroCuenta || '';
        const numeroCedula = selectedOption.dataset.numeroCedula || '';
        const formaPago = selectedOption.dataset.formaPago || 'Transferencia';
        const montoHonorarios = parseFloat(selectedOption.dataset.montoHonorarios) || 0;
        const esTercero = selectedOption.dataset.esTercero === 'true';
        const tipoContrato = selectedOption.dataset.tipoContrato || '';
        const nombreUsuario = selectedOption.text.split(' (')[0];

        // Llenar campos bancarios
        if (bancoInput) bancoInput.value = banco;
        if (cuentaInput) cuentaInput.value = numeroCuenta;
        if (documentoInput) documentoInput.value = numeroCedula;
        if (formaPagoInput) formaPagoInput.value = formaPago;

        const honorariosGroup = document.getElementById('honorarios-group');

        if (esTercero && montoHonorarios > 0) {
            if (honorariosGroup) honorariosGroup.style.display = 'block';
            if (montoInput) montoInput.value = montoHonorarios;
            if (tipoContratoInput) tipoContratoInput.value = tipoContrato || 'Honorarios';
            if (infoDiv) {
                infoDiv.innerHTML = `
                <strong>${nombreUsuario}</strong><br>
                <small>Banco: ${banco} | Cuenta: ${numeroCuenta}</small><br>
                <small>Honorarios: $${montoHonorarios.toFixed(2)}</small>
            `;
            }

            if (conceptoInput && !conceptoInput.value) {
                conceptoInput.value = `HONORARIOS - ${nombreUsuario}`;
            }

            // ✅ ELIMINAR TODOS LOS DETALLES EXISTENTES
            if (detallesContainer) {
                detallesContainer.innerHTML = '';
            }

            // ✅ CREAR UN SOLO DETALLE CON HONORARIOS
            if (detallesContainer) {
                const mesActual = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
                const mesCapitalizado = mesActual.charAt(0).toUpperCase() + mesActual.slice(1);

                const html = `
                <div class="detalle-row">
                    <div class="row g-2">
                        <div class="col-md-5">
                            <input type="text" class="form-control form-control-sm detalle-descripcion" 
                                   value="HONORARIOS - ${nombreUsuario}" required>
                        </div>
                        <div class="col-md-3">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text">$</span>
                                <input type="number" class="form-control detalle-monto" 
                                       value="${montoHonorarios.toFixed(2)}" step="0.01" 
                                       onchange="solicitudesPagosModales.calcularTotalPago()">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <input type="text" class="form-control form-control-sm detalle-periodo" 
                                   value="${mesCapitalizado}">
                        </div>
                        <div class="col-md-1">
                            <button type="button" class="btn btn-sm btn-danger" 
                                    onclick="solicitudesPagosModales.eliminarDetalle(this)">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
                detallesContainer.insertAdjacentHTML('beforeend', html);
            }

            calcularTotalPago();

        } else {
            if (honorariosGroup) honorariosGroup.style.display = 'none';
            if (montoInput) montoInput.value = '';
            if (tipoContratoInput) tipoContratoInput.value = '';
            if (infoDiv) {
                infoDiv.innerHTML = `
                <strong>${nombreUsuario}</strong><br>
                <small>Banco: ${banco} | Cuenta: ${numeroCuenta}</small>
            `;
            }

            // ✅ Si no es tercero, limpiar detalles y dejar uno vacío
            if (detallesContainer) {
                detallesContainer.innerHTML = '';
                agregarDetalle();
            }

            calcularTotalPago();
        }
    }

    /**
     * Alterna entre modo beneficiario manual o select de usuarios
     */
    function toggleTipoBeneficiario() {
        const esHonorario = document.getElementById('solicitud-es-honorario-pago').checked;
        const grupoManual = document.getElementById('beneficiario-manual-group');
        const grupoUsuarios = document.getElementById('beneficiario-usuarios-group');
        const honorariosGroup = document.getElementById('honorarios-group');
        const conceptoInput = document.getElementById('solicitud-concepto-pago');
        const beneficiarioManual = document.getElementById('solicitud-beneficiario-manual-pago');
        const detalleNota = document.getElementById('detalle-honorario-nota');
        const detallesContainer = document.getElementById('detalles-container-pago');
        const select = document.getElementById('solicitud-beneficiario-pago');

        if (esHonorario) {
            if (grupoManual) grupoManual.style.display = 'none';
            if (grupoUsuarios) grupoUsuarios.style.display = 'block';
            if (honorariosGroup) honorariosGroup.style.display = 'block';
            if (detalleNota) detalleNota.style.display = 'block';

            if (conceptoInput && !conceptoInput.value) {
                conceptoInput.placeholder = 'Ej: HONORARIOS - Nombre del consultor...';
            }
            if (beneficiarioManual) beneficiarioManual.required = false;

            // ✅ ELIMINAR EL DETALLE VACÍO POR DEFECTO
            if (detallesContainer) {
                const detalles = detallesContainer.querySelectorAll('.detalle-row');
                detalles.forEach(row => {
                    const desc = row.querySelector('.detalle-descripcion');
                    const monto = row.querySelector('.detalle-monto');
                    // Eliminar si está vacío (sin descripción o sin monto)
                    if ((!desc || !desc.value || desc.value.trim() === '') &&
                        (!monto || !monto.value || parseFloat(monto.value) === 0)) {
                        row.remove();
                    }
                });
            }

            const proyectoId = document.getElementById('solicitud-proyecto-pago').value;
            if (proyectoId) {
                cargarUsuariosPago(proyectoId, true);
            }

            if (select && select.value) {
                cargarDatosPagoUsuario();
            }

        } else {
            if (grupoManual) grupoManual.style.display = 'block';
            if (grupoUsuarios) grupoUsuarios.style.display = 'none';
            if (honorariosGroup) honorariosGroup.style.display = 'none';
            if (detalleNota) detalleNota.style.display = 'none';
            if (conceptoInput) {
                conceptoInput.placeholder = 'Ej: Pago de servicio de luz, Internet...';
                if (conceptoInput.value && conceptoInput.value.toUpperCase().includes('HONORARIOS')) {
                    conceptoInput.value = '';
                }
            }
            if (beneficiarioManual) beneficiarioManual.required = true;

            if (select) {
                select.innerHTML = '<option value="">Seleccionar usuario...</option>';
            }
            document.getElementById('solicitud-banco-pago').value = '';
            document.getElementById('solicitud-cuenta-pago').value = '';
            document.getElementById('solicitud-documento-pago').value = '';
            document.getElementById('solicitud-forma-pago-pago').value = 'Transferencia';
            document.getElementById('solicitud-monto-honorarios-pago').value = '';
            document.getElementById('solicitud-tipo-contrato-pago').value = '';
            document.getElementById('info-datos-pago').textContent = 'Seleccione un usuario para ver sus datos de pago';

            // ✅ ELIMINAR DETALLES DE HONORARIOS Y DEJAR SOLO UN DETALLE VACÍO
            if (detallesContainer) {
                // Eliminar todos los detalles existentes
                detallesContainer.innerHTML = '';
                // Agregar un detalle vacío
                agregarDetalle();
            }

            calcularTotalPago();
        }
    }

    function mostrarNuevaSolicitud(proyectoId = null) {
        const form = document.getElementById('form-nueva-solicitud-pago');
        if (form) form.reset();
        const detallesContainer = document.getElementById('detalles-container-pago');
        if (detallesContainer) detallesContainer.innerHTML = '';
        document.getElementById('total-monto-pago').textContent = '$0.00';

        document.getElementById('solicitud-es-honorario-pago').checked = false;
        document.getElementById('beneficiario-manual-group').style.display = 'block';
        document.getElementById('beneficiario-usuarios-group').style.display = 'none';
        document.getElementById('honorarios-group').style.display = 'none';
        document.getElementById('detalle-honorario-nota').style.display = 'none';
        document.getElementById('solicitud-beneficiario-pago').innerHTML = '<option value="">Seleccionar...</option>';
        document.getElementById('solicitud-beneficiario-manual-pago').required = true;
        document.getElementById('solicitud-concepto-pago').placeholder = 'Ej: Pago de servicio de luz, Internet...';

        const conceptoInput = document.getElementById('solicitud-concepto-pago');
        if (conceptoInput && conceptoInput.value && conceptoInput.value.toUpperCase().includes('HONORARIOS')) {
            conceptoInput.value = '';
        }

        const checkHonorario = document.getElementById('solicitud-es-honorario-pago');
        if (checkHonorario) {
            const newCheck = checkHonorario.cloneNode(true);
            checkHonorario.parentNode.replaceChild(newCheck, checkHonorario);
            newCheck.addEventListener('change', toggleTipoBeneficiario);
        }

        const selectUsuario = document.getElementById('solicitud-beneficiario-pago');
        if (selectUsuario) {
            const newSelect = selectUsuario.cloneNode(true);
            selectUsuario.parentNode.replaceChild(newSelect, selectUsuario);
            newSelect.addEventListener('change', cargarDatosPagoUsuario);
        }

        generarCodigoPreview(proyectoId);
        cargarProyectos(proyectoId);

        // ✅ AGREGAR UN DETALLE VACÍO POR DEFECTO (SOLO PARA MODO NORMAL)
        agregarDetalle();

        modalInstances['modal-nueva-solicitud-pago']?.show();
    }

    async function generarCodigoPreview(proyectoId) {
        proyectoId = proyectoId || null;
        try {
            var url = './api/solicitudes_pagos.php?action=generar_codigo';
            if (proyectoId) url += '&proyecto_id=' + proyectoId;
            var res = await fetch(url);
            var data = await res.json();
            var codigoSpan = document.getElementById('codigo-preview-pago');
            if (codigoSpan) {
                codigoSpan.innerHTML = `<code class="text-primary">${data.codigo}</code><br><small>Formato: PAG-CGE-PAY-PROY_ID-AÑO-XXXXXX</small>`;
            }
        } catch (error) {
            var codigoSpan = document.getElementById('codigo-preview-pago');
            if (codigoSpan) {
                codigoSpan.innerHTML = `<code class="text-muted">PAG-CGE-PAY-${new Date().getFullYear()}-XXXXXX</code>`;
            }
        }
    }

    async function cargarProyectos(seleccionarId = null) {
        const select = document.getElementById('solicitud-proyecto-pago');
        if (!select) return;
        select.innerHTML = '<option value="">Cargando...</option>';
        select.disabled = true;
        try {
            const res = await fetch('./api/proyectos.php?action=listar');
            const data = await res.json();
            select.innerHTML = '<option value="">Seleccionar proyecto...</option>';
            if (data.success && data.proyectos?.length) {
                const activos = data.proyectos.filter(p => p.estado === 'Activo' || p.estado === 'activo');
                activos.forEach(p => {
                    const selected = (seleccionarId && p.id == seleccionarId) ? 'selected' : '';
                    select.innerHTML += `<option value="${p.id}" ${selected}>${p.nombre}</option>`;
                });
                if (seleccionarId) cargarPartidas(seleccionarId);
                select.addEventListener('change', () => {
                    cargarPartidas(select.value);
                    if (document.getElementById('solicitud-es-honorario-pago').checked) {
                        cargarUsuariosPago(select.value, true);
                    }
                });
            } else {
                select.innerHTML = '<option value="">No hay proyectos activos</option>';
            }
        } catch (error) {
            select.innerHTML = '<option value="">Error al cargar proyectos</option>';
        } finally {
            select.disabled = false;
        }
    }

    async function cargarPartidas(proyectoId) {
        if (!proyectoId) return;
        const select = document.getElementById('solicitud-partida-pago');
        if (!select) return;
        select.innerHTML = '<option value="">Cargando...</option>';
        select.disabled = true;
        try {
            const res = await fetch(`./api/partidas.php?action=listar&proyecto_id=${proyectoId}`);
            const data = await res.json();
            select.innerHTML = '<option value="">Sin partida específica</option>';
            if (data.success && data.partidas?.length) {
                const secundarias = data.partidas.filter(p => p.tipo === 'Secundaria' || p.tipo === 'secundaria');
                secundarias.forEach(p => {
                    select.innerHTML += `<option value="${p.id}">${p.codigo} - ${p.nombre}</option>`;
                });
            }
        } catch (error) {
            select.innerHTML = '<option value="">Error al cargar partidas</option>';
        } finally {
            select.disabled = false;
        }
    }

    function agregarDetalle() {
        const container = document.getElementById('detalles-container-pago');
        if (!container) return;
        const html = `
            <div class="detalle-row">
                <div class="row g-2">
                    <div class="col-md-5">
                        <input type="text" class="form-control form-control-sm detalle-descripcion" placeholder="Descripción del gasto" required>
                    </div>
                    <div class="col-md-3">
                        <div class="input-group input-group-sm">
                            <span class="input-group-text">$</span>
                            <input type="number" class="form-control detalle-monto" placeholder="Monto" step="0.01" onchange="solicitudesPagosModales.calcularTotalPago()">
                        </div>
                    </div>
                    <div class="col-md-3">
                        <input type="text" class="form-control form-control-sm detalle-periodo" placeholder="Periodo (ej. Ene 2026)">
                    </div>
                    <div class="col-md-1">
                        <button type="button" class="btn btn-sm btn-danger" onclick="solicitudesPagosModales.eliminarDetalle(this)"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    }

    function eliminarDetalle(btn) {
        btn.closest('.detalle-row')?.remove();
        calcularTotalPago();
    }

    function calcularTotalPago() {
        let total = 0;
        const esHonorario = document.getElementById('solicitud-es-honorario-pago').checked;

        if (esHonorario) {
            const select = document.getElementById('solicitud-beneficiario-pago');
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption && selectedOption.dataset.montoHonorarios) {
                total = parseFloat(selectedOption.dataset.montoHonorarios) || 0;
            }
        } else {
            document.querySelectorAll('.detalle-row').forEach(row => {
                const monto = parseFloat(row.querySelector('.detalle-monto')?.value) || 0;
                total += monto;
            });
        }

        document.getElementById('total-monto-pago').textContent = `$${total.toFixed(2)}`;
        document.getElementById('solicitud-monto-total-pago').value = total;
    }

    // ========== GUARDAR SOLICITUD - OPTIMIZADO ==========
    async function guardarSolicitud() {
        const form = document.getElementById('form-nueva-solicitud-pago');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const esHonorario = document.getElementById('solicitud-es-honorario-pago').checked;
        let beneficiario = '';
        let documento_beneficiario = '';
        let cuenta_beneficiario = '';
        let banco_beneficiario = '';
        let forma_pago = document.getElementById('solicitud-forma-pago-pago').value || 'Transferencia';
        let monto_honorarios = null;
        let tipo_contrato = null;
        let usuario_beneficiario_id = null;

        if (esHonorario) {
            const select = document.getElementById('solicitud-beneficiario-pago');
            const selectedOption = select.options[select.selectedIndex];

            if (!selectedOption || !selectedOption.value) {
                Swal.fire({ icon: 'warning', title: 'Seleccione un beneficiario' });
                return;
            }

            usuario_beneficiario_id = selectedOption.value;
            beneficiario = selectedOption.text.split(' (')[0];
            documento_beneficiario = selectedOption.dataset.numeroCedula || '';
            cuenta_beneficiario = selectedOption.dataset.numeroCuenta || '';
            banco_beneficiario = selectedOption.dataset.banco || '';
            forma_pago = selectedOption.dataset.formaPago || 'Transferencia';
            monto_honorarios = parseFloat(selectedOption.dataset.montoHonorarios) || 0;
            tipo_contrato = document.getElementById('solicitud-tipo-contrato-pago').value || 'Honorarios';
        } else {
            beneficiario = document.getElementById('solicitud-beneficiario-manual-pago').value;
            documento_beneficiario = document.getElementById('solicitud-documento-pago').value;
            cuenta_beneficiario = document.getElementById('solicitud-cuenta-pago').value;
            banco_beneficiario = document.getElementById('solicitud-banco-pago').value;
            forma_pago = document.getElementById('solicitud-forma-pago-pago').value || 'Transferencia';
        }

        if (!beneficiario) {
            Swal.fire({ icon: 'warning', title: 'Beneficiario requerido' });
            return;
        }

        // ✅ RECORRER DETALLES DEL DOM - SOLO LOS VÁLIDOS
        const detalles = [];
        document.querySelectorAll('.detalle-row').forEach(row => {
            const desc = row.querySelector('.detalle-descripcion')?.value;
            const monto = row.querySelector('.detalle-monto')?.value;
            const periodo = row.querySelector('.detalle-periodo')?.value;

            if (desc && desc.trim() !== '' && monto && parseFloat(monto) > 0) {
                detalles.push({
                    descripcion: desc.trim(),
                    monto: parseFloat(monto),
                    periodo: periodo || null
                });
            }
        });

        if (detalles.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Detalles requeridos',
                text: 'Agregue al menos un detalle del pago con descripción y monto válido.'
            });
            return;
        }

        let totalSolicitado = 0;
        detalles.forEach(d => totalSolicitado += d.monto);

        if (totalSolicitado <= 0) {
            Swal.fire({ icon: 'warning', title: 'Monto inválido', text: 'El monto total debe ser mayor a 0' });
            return;
        }

        // ✅ CONSTRUIR DATA - SOLO CAMPOS NECESARIOS
        const data = {
            proyecto_id: document.getElementById('solicitud-proyecto-pago').value,
            partida_id: document.getElementById('solicitud-partida-pago').value || null,
            concepto: document.getElementById('solicitud-concepto-pago').value,
            descripcion: document.getElementById('solicitud-descripcion-pago').value || '',
            monto_solicitado: totalSolicitado,
            moneda: 'USD',
            beneficiario: beneficiario,
            documento_beneficiario: documento_beneficiario,
            cuenta_beneficiario: cuenta_beneficiario,
            banco_beneficiario: banco_beneficiario,
            forma_pago: forma_pago,
            fecha_requerida: document.getElementById('solicitud-fecha-requerida-pago').value,
            prioridad: document.getElementById('solicitud-prioridad-pago').value || 'Media',
            justificacion: document.getElementById('solicitud-justificacion-pago').value || '',
            detalles: detalles,
            es_honorario: esHonorario ? 1 : 0,
            usuario_beneficiario_id: usuario_beneficiario_id,
            monto_honorarios: monto_honorarios,
            tipo_contrato: tipo_contrato
        };

        if (!data.proyecto_id) {
            Swal.fire({ icon: 'warning', title: 'Proyecto requerido' });
            return;
        }

        if (!data.concepto) {
            Swal.fire({ icon: 'warning', title: 'Concepto requerido' });
            return;
        }

        // ✅ SPINNER ÚNICO - SIN DUPLICADOS
        const loadingSwal = Swal.fire({
            title: 'Guardando solicitud...',
            text: 'Por favor, espere un momento',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos

            const res = await fetch('./api/solicitudes_pagos.php?action=crear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const result = await res.json();

            await loadingSwal.close();

            if (result.success) {
                modalInstances['modal-nueva-solicitud-pago']?.hide();
                Swal.fire({
                    icon: 'success',
                    title: '¡Solicitud creada!',
                    text: `La solicitud ${result.codigo || ''} se ha creado exitosamente.`,
                    timer: 2500,
                    showConfirmButton: false,
                    timerProgressBar: true
                });
                if (window.solicitudesPagos) {
                    window.solicitudesPagos.cargarSolicitudes();
                }
            } else {
                throw new Error(result.message || 'Error al guardar la solicitud');
            }
        } catch (error) {
            await loadingSwal.close();
            console.error('Error al guardar:', error);

            let mensaje = error.message;
            if (error.name === 'AbortError') {
                mensaje = 'La solicitud ha tardado demasiado. Por favor, intente nuevamente.';
            }

            Swal.fire({
                icon: 'error',
                title: 'Error al guardar',
                text: mensaje,
                confirmButtonText: 'Entendido'
            });
        }
    }

    // ========== MODAL: VER DETALLES ==========
    async function verDetalles(id) {
        Swal.fire({ title: 'Cargando detalles...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const response = await fetch(`./api/obtener_detalles_pago.php?id=${id}`);
            const data = await response.json();
            Swal.close();
            if (data.success) {
                const html = generarHTMLDetalles(data.solicitud);
                document.getElementById('detalles-solicitud-pago-content').innerHTML = html;
                modalInstances['modal-ver-solicitud-pago']?.show();
            } else throw new Error(data.message);
        } catch (error) {
            Swal.close();
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    function generarHTMLDetalles(s) {
        const historial = s.historial || [];
        const detalles = s.detalles || [];

        let detallesHtml = '';
        if (detalles && detalles.length) {
            let rows = '';
            detalles.forEach(d => {
                rows += `<tr><td>${d.descripcion}</td><td>$${parseFloat(d.monto).toFixed(2)}</td><td>${d.periodo || '-'}</td></tr>`;
            });
            detallesHtml = `
                <h6 class="mt-3"><i class="fas fa-list"></i> Detalles del Pago</h6>
                <div class="table-responsive">
                    <table class="table table-sm table-bordered">
                        <thead><tr><th>Descripción</th><th>Monto</th><th>Período</th></tr></thead>
                        <tbody>${rows}</tbody>
                        <tfoot><tr style="font-weight:bold;"><td>TOTAL</td><td>$${parseFloat(s.monto_solicitado).toFixed(2)}</td><td></td></tr></tfoot>
                    </table>
                </div>
            `;
        }

        let honorariosHtml = '';
        if (s.es_honorario) {
            honorariosHtml = `
                <div class="alert alert-info mt-3">
                    <i class="fas fa-user-tie"></i> <strong>Pago de Honorarios</strong><br>
                    <small>Usuario: ${s.usuario_beneficiario_nombre || s.beneficiario}</small><br>
                    <small>Tipo de Contrato: ${s.tipo_contrato || 'No especificado'}</small><br>
                    <small>Monto: $${parseFloat(s.monto_honorarios || s.monto_solicitado).toFixed(2)}</small>
                </div>
            `;
        }

        let historialHtml = '';
        if (historial.length) {
            let histRows = '';
            historial.forEach(h => {
                const fecha = formatearFechaLocal(h.created_at, 'largo') + ' ' + (h.created_at ? h.created_at.split('T')[1]?.substring(0, 5) || '' : '');
                const estadoNuevo = h.estado_nuevo ? h.estado_nuevo.replace('_', ' ') : 'N/A';
                let badgeColor = 'bg-secondary';
                if (h.estado_nuevo === 'Pendiente') badgeColor = 'bg-warning text-dark';
                else if (h.estado_nuevo === 'En_Revision') badgeColor = 'bg-info text-white';
                else if (h.estado_nuevo === 'Aprobada') badgeColor = 'bg-success';
                else if (h.estado_nuevo === 'Rechazada') badgeColor = 'bg-danger';
                else if (h.estado_nuevo === 'Pagada') badgeColor = 'bg-primary';
                else if (h.estado_nuevo === 'Cerrada') badgeColor = 'bg-secondary';
                histRows += `<tr><td>${fecha}</td><td>${h.usuario_nombre || 'Sistema'}</td><td><span class="badge ${badgeColor}">${estadoNuevo}</span></td><td>${h.comentario || 'Sin comentario'}</td></tr>`;
            });
            historialHtml = `
                <h6 class="mt-3"><i class="fas fa-history"></i> Historial</h6>
                <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
                    <table class="table table-sm table-bordered">
                        <thead><tr><th>Fecha</th><th>Usuario</th><th>Estado</th><th>Comentario</th></tr></thead>
                        <tbody>${histRows}</tbody>
                    </table>
                </div>
            `;
        }

        const estadoBadge = {
            'Pendiente': 'badge bg-warning text-dark',
            'En_Revision': 'badge bg-info text-white',
            'Aprobada': 'badge bg-success',
            'Rechazada': 'badge bg-danger',
            'Pagada': 'badge bg-primary',
            'Cerrada': 'badge bg-secondary'
        };

        return `
            <div class="detalles-header">
                <h4>${s.codigo_solicitud}</h4>
                <p>${s.concepto}</p>
                <span class="${estadoBadge[s.estado] || 'badge bg-secondary'}">${s.estado || 'Pendiente'}</span>
            </div>
            <div class="detalles-info">
                <div class="info-grid">
                    <div><strong>Solicitante:</strong> ${s.solicitante_nombre}</div>
                    <div><strong>Fecha:</strong> ${formatearFechaLocal(s.fecha_solicitud, 'corto')}</div>
                    <div><strong>Proyecto:</strong> ${s.proyecto_nombre}</div>
                    <div><strong>Monto:</strong> $${parseFloat(s.monto_solicitado).toFixed(2)}</div>
                    <div><strong>Beneficiario:</strong> ${s.beneficiario}</div>
                    <div><strong>Prioridad:</strong> ${s.prioridad || 'Media'}</div>
                    <div><strong>Forma de Pago:</strong> ${s.forma_pago || 'Transferencia'}</div>
                    <div><strong>Fecha Requerida:</strong> ${formatearFechaLocal(s.fecha_requerida, 'corto')}</div>
                    ${s.numero_transferencia ? `<div><strong>N° Transferencia:</strong> ${s.numero_transferencia}</div>` : ''}
                    ${s.fecha_pago ? `<div><strong>Fecha Pago:</strong> ${formatearFechaLocal(s.fecha_pago, 'corto')}</div>` : ''}
                </div>
                ${honorariosHtml}
                ${detallesHtml}
                ${historialHtml}
            </div>
        `;
    }

    // ========== MODAL: APROBACIÓN ==========
    async function mostrarAprobacion(id) {
        try {
            const response = await fetch(`./api/obtener_detalles_pago.php?id=${id}&simple=1`);
            const data = await response.json();
            if (!data.success) throw new Error(data.message);
            const s = data.solicitud;

            document.getElementById('aprobar-solicitud-id-pago').value = id;
            document.getElementById('aprobar-decision-pago').value = '';
            document.getElementById('aprobar-comentario-pago').value = '';
            document.getElementById('campos-rechazo-group-pago').style.display = 'none';

            document.getElementById('info-aprobacion-pago').innerHTML = `
                <strong>Concepto:</strong> ${s.concepto}<br>
                <strong>Beneficiario:</strong> ${s.beneficiario}<br>
                <strong>Monto:</strong> $${parseFloat(s.monto_solicitado).toFixed(2)}
                ${s.es_honorario ? `<br><span class="badge bg-info">Honorarios</span>` : ''}
            `;

            const decisionSelect = document.getElementById('aprobar-decision-pago');
            if (decisionSelect._listener) decisionSelect.removeEventListener('change', decisionSelect._listener);
            const handleChange = function () {
                const val = this.value;
                const rechazoDiv = document.getElementById('campos-rechazo-group-pago');
                const comentario = document.getElementById('aprobar-comentario-pago');
                if (val === 'Rechazada') {
                    rechazoDiv.style.display = 'block';
                    comentario.required = true;
                } else {
                    rechazoDiv.style.display = 'none';
                    comentario.required = false;
                }
            };
            decisionSelect.addEventListener('change', handleChange);
            decisionSelect._listener = handleChange;

            modalInstances['modal-aprobar-solicitud-pago']?.show();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    function toggleComentarioRechazo() {
        const decision = document.getElementById('aprobar-decision-pago')?.value;
        const group = document.getElementById('campos-rechazo-group-pago');
        if (decision === 'Rechazada') {
            if (group) group.style.display = 'block';
        } else {
            if (group) group.style.display = 'none';
        }
    }

    async function confirmarAprobacion() {
        const id = document.getElementById('aprobar-solicitud-id-pago').value;
        const decision = document.getElementById('aprobar-decision-pago').value;
        const comentario = document.getElementById('aprobar-comentario-pago').value;

        if (!decision) return Swal.fire({ icon: 'warning', title: 'Selección requerida' });
        if (decision === 'Rechazada' && !comentario) return Swal.fire({ icon: 'warning', title: 'Comentario requerido' });

        Swal.fire({
            title: `¿Confirmar ${decision === 'Aprobada' ? 'aprobación' : 'rechazo'}?`,
            icon: 'question',
            showCancelButton: true
        }).then(async (result) => {
            if (!result.isConfirmed) return;
            Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const res = await fetch('./api/aprobar_solicitud_pago.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        solicitud_id: id,
                        decision: decision,
                        comentario: comentario
                    })
                });
                const data = await res.json();
                Swal.close();
                if (data.success) {
                    modalInstances['modal-aprobar-solicitud-pago']?.hide();
                    Swal.fire({ icon: 'success', title: 'Solicitud actualizada', timer: 2000 });
                    if (window.solicitudesPagos) window.solicitudesPagos.cargarSolicitudes();
                } else throw new Error(data.message);
            } catch (error) {
                Swal.close();
                Swal.fire({ icon: 'error', title: 'Error', text: error.message });
            }
        });
    }

    // ========== MODAL: REGISTRAR PAGO ==========
    async function mostrarPago(id) {
        try {
            const res = await fetch(`./api/obtener_detalles_pago.php?id=${id}&simple=1`);
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            const s = data.solicitud;

            document.getElementById('info-solicitud-pago-pago').innerHTML = `
                <strong>Código:</strong> ${s.codigo_solicitud}<br>
                <strong>Concepto:</strong> ${s.concepto}<br>
                <strong>Beneficiario:</strong> ${s.beneficiario}<br>
                <strong>Monto:</strong> $${parseFloat(s.monto_solicitado).toFixed(2)}
                ${s.es_honorario ? `<br><span class="badge bg-info">Honorarios</span>` : ''}
            `;
            document.getElementById('pago-solicitud-id-pago').value = id;
            document.getElementById('pago-monto-pago').value = s.monto_solicitado;
            document.getElementById('pago-fecha-pago').value = new Date().toISOString().split('T')[0];
            document.getElementById('pago-beneficiario-pago').value = s.beneficiario;

            await cargarBancos();
            modalInstances['modal-registrar-pago-pago']?.show();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    async function cargarBancos() {
        const select = document.getElementById('pago-banco-id-pago');
        if (!select) return;
        select.innerHTML = '<option value="">Cargando bancos...</option>';
        select.disabled = true;
        try {
            const response = await fetch('./api/bancos.php?action=listar');
            const data = await response.json();
            select.innerHTML = '<option value="">Seleccionar banco...</option>';
            if (data.success && data.cuentas && data.cuentas.length > 0) {
                data.cuentas.forEach(banco => {
                    if (banco.activo === 1 || banco.activo === true) {
                        const option = document.createElement('option');
                        option.value = banco.id;
                        const cuentaInfo = banco.numero_cuenta ? ` - ${banco.numero_cuenta}` : '';
                        const monedaInfo = banco.moneda ? ` (${banco.moneda})` : '';
                        option.textContent = `${banco.nombre}${cuentaInfo}${monedaInfo}`;
                        select.appendChild(option);
                    }
                });
            } else {
                select.innerHTML = '<option value="">No hay bancos disponibles</option>';
            }
        } catch (error) {
            console.error('Error cargando bancos:', error);
            select.innerHTML = '<option value="">Error al cargar bancos</option>';
        } finally {
            select.disabled = false;
        }
    }

    async function confirmarPago() {
        const form = document.getElementById('form-registrar-pago-pago');
        if (!form.checkValidity()) return form.reportValidity();

        const comprobanteInput = document.getElementById('pago-comprobante-pago');
        const formData = new FormData();
        formData.append('solicitud_id', document.getElementById('pago-solicitud-id-pago').value);
        formData.append('banco_origen_id', document.getElementById('pago-banco-id-pago').value);
        formData.append('numero_transferencia', document.getElementById('pago-numero-transferencia-pago').value);
        formData.append('monto_pagado', document.getElementById('pago-monto-pago').value);
        formData.append('fecha_pago', document.getElementById('pago-fecha-pago').value);
        if (comprobanteInput.files.length) formData.append('comprobante', comprobanteInput.files[0]);

        Swal.fire({ title: 'Registrando pago...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const res = await fetch('./api/registrar_pago_solicitud_pago.php', { method: 'POST', body: formData });
            const data = await res.json();
            Swal.close();
            if (data.success) {
                modalInstances['modal-registrar-pago-pago']?.hide();
                Swal.fire({ icon: 'success', title: 'Pago registrado', timer: 2000 });
                if (window.solicitudesPagos) window.solicitudesPagos.cargarSolicitudes();
            } else throw new Error(data.message);
        } catch (error) {
            Swal.close();
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    // ========== MODAL: CERRAR SOLICITUD ==========
    function mostrarCierre(id) {
        document.getElementById('cerrar-solicitud-id-pago').value = id;
        document.getElementById('cerrar-concepto-pago').value = '';
        document.getElementById('cerrar-observaciones-pago').value = '';
        obtenerInfoSolicitudParaCierre(id);
        modalInstances['modal-cerrar-solicitud-pago']?.show();
    }

    async function obtenerInfoSolicitudParaCierre(solicitudId) {
        try {
            const res = await fetch(`./api/obtener_detalles_pago.php?id=${solicitudId}&simple=1`);
            const data = await res.json();
            if (data.success) {
                const s = data.solicitud;
                const concepto = document.getElementById('cerrar-concepto-pago');
                if (concepto) {
                    concepto.value = `Pago: ${s.concepto} - ${s.beneficiario}`;
                }
            }
        } catch (e) { console.error(e); }
    }

    async function confirmarCierre() {
        const id = document.getElementById('cerrar-solicitud-id-pago').value;
        const concepto = document.getElementById('cerrar-concepto-pago').value;
        const observaciones = document.getElementById('cerrar-observaciones-pago').value;
        const moneda = document.getElementById('cerrar-moneda-pago')?.value || 'USD';
        const tasaCambio = parseFloat(document.getElementById('cerrar-tasa-cambio-pago')?.value) || 1.0000;

        if (!concepto) return Swal.fire({ icon: 'warning', title: 'Concepto requerido' });

        if (moneda === 'BS' && tasaCambio <= 0) {
            return Swal.fire({
                icon: 'warning',
                title: 'Tasa de cambio requerida',
                text: 'Debe ingresar la tasa de cambio para pagos en Bolívares (BS)'
            });
        }

        Swal.fire({
            title: 'Cerrar solicitud de pago',
            html: `
                <p>¿Está seguro de cerrar esta solicitud?</p>
                <p><strong>Concepto:</strong> ${concepto}</p>
                <p><strong>Moneda:</strong> ${moneda}</p>
                ${moneda === 'BS' ? `<p><strong>Tasa de Cambio:</strong> ${tasaCambio.toFixed(4)} Bs/USD</p>` : ''}
            `,
            icon: 'question',
            showCancelButton: true
        }).then(async (result) => {
            if (!result.isConfirmed) return;
            Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const res = await fetch('./api/cerrar_solicitud_pago.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        solicitud_id: id,
                        observaciones,
                        concepto,
                        moneda: moneda,
                        tasa_cambio: tasaCambio
                    })
                });
                const data = await res.json();
                Swal.close();
                if (data.success) {
                    modalInstances['modal-cerrar-solicitud-pago']?.hide();
                    Swal.fire({ icon: 'success', title: 'Solicitud cerrada', timer: 2000 });
                    if (window.solicitudesPagos) window.solicitudesPagos.cargarSolicitudes();
                } else throw new Error(data.message);
            } catch (error) {
                Swal.close();
                Swal.fire({ icon: 'error', title: 'Error', text: error.message });
            }
        });
    }

    // ========== API PÚBLICA ==========
    return {
        inicializarModales,
        mostrarNuevaSolicitud,
        verDetalles,
        mostrarAprobacion,
        mostrarPago,
        mostrarCierre,
        agregarDetalle,
        eliminarDetalle,
        calcularTotalPago,
        confirmarAprobacion,
        confirmarPago,
        confirmarCierre,
        formatearFechaLocal,
        escapeHtml,
        cargarUsuariosPago,
        cargarDatosPagoUsuario,
        toggleTipoBeneficiario
    };
})();

window.solicitudesPagosModales = solicitudesPagosModales;

document.addEventListener('DOMContentLoaded', function () {
    if (window.solicitudesPagosModales && typeof window.solicitudesPagosModales.inicializarModales === 'function') {
        window.solicitudesPagosModales.inicializarModales();
        console.log('✅ solicitudesPagosModales inicializado con soporte para honorarios');
    }
});