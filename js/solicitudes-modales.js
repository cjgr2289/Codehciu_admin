/**
 * Módulo de modales para Solicitudes de Compras
 * CODEHCIU - Sistema de Finanzas
 * Con soporte para Servicios y Compras, Proveedores, Cotizaciones y Órdenes de Compra
 */

const solicitudesModales = (function () {
    let modalInstances = {};

    // ========== OPCIONES DE UNIDAD SEGÚN TIPO ==========
    function getOpcionesUnidad(tipo) {
        if (tipo === 'servicio') {
            return [
                { value: 'Horas', text: 'Horas (Hrs)' },
                { value: 'Dias', text: 'Días (Dia)' },
                { value: 'Mes', text: 'Mes (Mes)' },
                { value: 'Viaje ida/vuelta', text: 'Viaje ida/vuelta' },
                { value: 'Viaje Ida', text: 'Viaje Ida' },
                { value: 'Viaje vuelta', text: 'Viaje vuelta' }
            ];
        } else { // compra
            return [
                { value: 'Pieza', text: 'Pieza (Pza)' },
                { value: 'Caja', text: 'Caja (CJA)' },
                { value: 'Kilogramos', text: 'Kilogramos (Kg)' },
                { value: 'Litros', text: 'Litros (lt)' },
                { value: 'Metro', text: 'Metro (m)' },
                { value: 'Metro cuadrado', text: 'Metro cuadrado (M2)' }
            ];
        }
    }

    // ========== ACTUALIZAR SELECTS DE UNIDAD CUANDO CAMBIA EL TIPO ==========
    function actualizarUnidadesPorTipo() {
        const tipo = document.getElementById('solicitud-tipo')?.value || 'compra';
        const opciones = getOpcionesUnidad(tipo);
        const selects = document.querySelectorAll('#items-container .item-unidad');

        selects.forEach(select => {
            const valorActual = select.value;
            select.innerHTML = '';
            opciones.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                if (opt.value === valorActual) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            if (select.value !== valorActual && opciones.length > 0) {
                select.value = opciones[0].value;
            }
        });
    }

    // ========== FUNCIÓN AUXILIAR PARA FORMATEAR FECHAS SIN ZONA HORARIA ==========
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

    // ========== INICIALIZACIÓN ==========
    function inicializarModales() {
        const modales = [
            'modal-nueva-solicitud', 'modal-ver-solicitud', 'modal-aprobar-solicitud',
            'modal-registrar-pago', 'modal-cerrar-solicitud', 'modal-ver-comprobante',
            'modal-proveedores', 'modal-cotizaciones', 'modal-reporte-oc'
        ];
        modales.forEach(id => {
            const el = document.getElementById(id);
            if (el) modalInstances[id] = new bootstrap.Modal(el);
            else console.warn(`⚠️ Modal ${id} no encontrado`);
        });
        configurarEventosModales();
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
    function configurarEventosModales() {
        document.getElementById('btn-guardar-solicitud')?.addEventListener('click', guardarSolicitud);
        document.getElementById('btn-confirmar-aprobacion')?.addEventListener('click', confirmarAprobacion);
        document.getElementById('btn-confirmar-pago')?.addEventListener('click', confirmarPago);
        document.getElementById('btn-confirmar-cierre')?.addEventListener('click', confirmarCierre);
        document.getElementById('btn-agregar-item')?.addEventListener('click', agregarItem);
        document.getElementById('aprobar-decision')?.addEventListener('change', toggleComentarioRechazo);
        document.getElementById('solicitud-tipo')?.addEventListener('change', onTipoSolicitudChange);
        document.getElementById('btn-agregar-cotizacion')?.addEventListener('click', mostrarModalAgregarCotizacion);
        document.getElementById('btn-guardar-cotizacion')?.addEventListener('click', guardarCotizacion);
        document.getElementById('btn-nuevo-proveedor')?.addEventListener('click', mostrarModalNuevoProveedor);
        document.getElementById('btn-guardar-proveedor')?.addEventListener('click', guardarProveedor);
        document.getElementById('btn-cancelar-proveedor')?.addEventListener('click', cerrarModalProveedor);

        const comprobanteInput = document.getElementById('pago-comprobante');
        if (comprobanteInput) comprobanteInput.addEventListener('change', validarImagen);

        ['pago-banco-id', 'pago-numero-transferencia', 'pago-monto', 'pago-beneficiario'].forEach(id => {
            const campo = document.getElementById(id);
            if (campo) {
                campo.addEventListener('input', () => validarCampoPago(id));
                campo.addEventListener('change', () => validarCampoPago(id));
            }
        });

        document.addEventListener('click', function (e) {
            const btn = e.target.closest('.btn-ver-comprobante-modal');
            if (btn && btn.dataset.id) {
                e.preventDefault();
                verComprobanteModal(btn.dataset.id);
            }
            const btnCotizacion = e.target.closest('.btn-seleccionar-ganador');
            if (btnCotizacion && btnCotizacion.dataset.id) {
                e.preventDefault();
                seleccionarGanadorCotizacion(btnCotizacion.dataset.id);
            }
        });
    }

    // ========== VALIDACIONES ==========
    function validarImagen(event) {
        const file = event.target.files[0];
        const maxSizeMB = 50;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        let errorSpan = document.getElementById('error-imagen');
        let infoSpan = document.getElementById('info-archivo');
        if (!errorSpan) {
            errorSpan = document.createElement('div');
            errorSpan.id = 'error-imagen';
            errorSpan.className = 'text-danger small mt-1';
            event.target.parentNode.appendChild(errorSpan);
        }
        if (!infoSpan) {
            infoSpan = document.createElement('div');
            infoSpan.id = 'info-archivo';
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
            case 'pago-banco-id':
                if (!valor) {
                    errorSpan.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Debe seleccionar un banco';
                    errorSpan.style.display = 'block';
                    campo.style.borderColor = '#dc3545';
                    return false;
                }
                break;
            case 'pago-numero-transferencia':
                if (!valor || valor.length < 5) {
                    errorSpan.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Número de transferencia requerido (mínimo 5 caracteres)';
                    errorSpan.style.display = 'block';
                    campo.style.borderColor = '#dc3545';
                    return false;
                }
                break;
            case 'pago-monto':
                const monto = parseFloat(valor);
                if (!valor || isNaN(monto) || monto <= 0) {
                    errorSpan.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Monto válido mayor a 0';
                    errorSpan.style.display = 'block';
                    campo.style.borderColor = '#dc3545';
                    return false;
                }
                break;
            case 'pago-beneficiario':
                if (!valor || valor.length < 3) {
                    errorSpan.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Beneficiario requerido (mínimo 3 caracteres)';
                    errorSpan.style.display = 'block';
                    campo.style.borderColor = '#dc3545';
                    return false;
                }
                break;
            case 'pago-documento':
                if (!valor) {
                    errorSpan.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Documento (RIF/CI) requerido';
                    errorSpan.style.display = 'block';
                    campo.style.borderColor = '#dc3545';
                    return false;
                }
                break;
            case 'pago-cuenta-destino':
                if (!valor) {
                    errorSpan.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Cuenta destino requerida';
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

    function validarTodosCamposPago() {
        const campos = ['pago-banco-id', 'pago-numero-transferencia', 'pago-monto', 'pago-beneficiario', 'pago-documento', 'pago-cuenta-destino'];
        return campos.every(id => validarCampoPago(id));
    }

    // ========== MODAL: NUEVA SOLICITUD ==========
    function mostrarNuevaSolicitud(proyectoId = null) {
        const form = document.getElementById('form-nueva-solicitud');
        if (form) form.reset();
        const itemsContainer = document.getElementById('items-container');
        if (itemsContainer) itemsContainer.innerHTML = '';
        document.getElementById('total-estimado').textContent = '$0.00';
        const tipoSelect = document.getElementById('solicitud-tipo');
        if (tipoSelect) tipoSelect.value = 'compra';
        onTipoSolicitudChange();
        // Pasar el proyectoId a la generación del código
        generarCodigoPreview(proyectoId);
        cargarProyectos(proyectoId);
        agregarItem();
        modalInstances['modal-nueva-solicitud']?.show();
    }

    function onTipoSolicitudChange() {
        const tipo = document.getElementById('solicitud-tipo')?.value;
        const alerta = document.getElementById('alerta-cotizacion');
        if (alerta) {
            if (tipo === 'servicio') alerta.style.display = 'none';
            else {
                alerta.style.display = 'block';
                actualizarAvisoCotizacion();
            }
        }
        actualizarUnidadesPorTipo();
    }

    function actualizarAvisoCotizacion() {
        const monto = parseFloat(document.getElementById('solicitud-monto-total')?.value || 0);
        const aviso = document.getElementById('alerta-cotizacion');
        if (aviso) {
            if (monto >= 1000) {
                aviso.innerHTML = '<i class="fas fa-info-circle"></i> <strong>Importante:</strong> Esta compra requiere cotización de 2 o más proveedores.';
                aviso.className = 'alert alert-warning';
            } else {
                aviso.innerHTML = '<i class="fas fa-info-circle"></i> Esta compra no requiere cotizaciones (monto < $1,000).';
                aviso.className = 'alert alert-info';
            }
        }
    }
    // ========== MODAL: VER DETALLES ==========
    async function verDetalles(id) {
        Swal.fire({ title: 'Cargando detalles...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const response = await fetch(`./api/obtener_detalles_solicitud.php?id=${id}`);
            const data = await response.json();
            Swal.close();
            if (data.success) {
                console.log('📋 Datos recibidos:', data); // Para depuración
                console.log('📋 Items OC:', data.orden_compra_items); // Para depuración
                const html = generarHTMLDetalles(data);
                document.getElementById('detalles-solicitud-content').innerHTML = html;
                modalInstances['modal-ver-solicitud']?.show();
            } else throw new Error(data.message);
        } catch (error) {
            Swal.close();
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    function generarHTMLDetalles(data) {
        const s = data.solicitud || {};
        const items = data.items || [];
        const pagos = data.pagos || [];
        const cotizaciones = data.cotizaciones || [];
        const historial = data.historial || [];
        const tipoBadge = s.tipo_solicitud === 'servicio' ? 'badge bg-info' : 'badge bg-primary';
        const tipoTexto = s.tipo_solicitud === 'servicio' ? 'Servicio' : 'Compra de Items';

        let itemsHtml = '';
        if (items.length) {
            var itemsRows = '';
            items.forEach(function (i) {
                itemsRows += '<tr><td>' + i.descripcion_item + '</td><td>' + i.cantidad + '</td><td>' + (i.unidad_medida || '-') + '</td><td>' + (window.solicitudesCompras?.formatearMonto(i.precio_unitario_estimado) || '$0.00') + '</td><td>' + (window.solicitudesCompras?.formatearMonto(i.subtotal_estimado) || '$0.00') + '</td></tr>';
            });
            itemsHtml = '<h6 class="mt-3"><i class="fas fa-list"></i> Items</h6><div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>Descripción</th><th>Cant.</th><th>Unidad</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead><tbody>' + itemsRows + '</tbody></table></div>';
        } else {
            itemsHtml = '<div class="alert alert-warning mt-3">No hay items registrados.</div>';
        }

        // ========== ORDEN DE COMPRA CON IVA (CORREGIDO) ==========
        let ocHtml = '';
        if (s.codigo_oc) {
            let ocItemsHtml = '';
            if (data.orden_compra_items && data.orden_compra_items.length) {
                var ocRows = '';
                var totalOC = 0;
                data.orden_compra_items.forEach(function (oi) {
                    // Calcular correctamente el total
                    var cantidad = parseFloat(oi.cantidad) || 0;
                    var precio = parseFloat(oi.precio_unitario) || 0;
                    var subtotal = cantidad * precio;
                    var tieneIva = parseInt(oi.tiene_iva) === 1;
                    var iva = parseFloat(oi.iva) || (tieneIva ? subtotal * 0.16 : 0);
                    var total = parseFloat(oi.total_con_iva) || (subtotal + iva);

                    // Acumular total general
                    totalOC += total;

                    ocRows += '<tr>' +
                        '<td style="text-align:center;">' + cantidad + '</td>' +
                        '<td>' + oi.descripcion_item + '</td>' +
                        '<td style="text-align:center;">' + (oi.unidad_medida || '-') + '</td>' +
                        '<td style="text-align:right;">$ ' + precio.toFixed(2) + '</td>' +
                        '<td style="text-align:center;">' + (tieneIva ? 'Sí' : 'No') + '</td>' +
                        '<td style="text-align:right;">$ ' + iva.toFixed(2) + '</td>' +
                        '<td style="text-align:right;"><strong>$ ' + total.toFixed(2) + '</strong></td>' +
                        '</tr>';
                });
                ocItemsHtml = '<div class="table-responsive mt-2"><table class="table table-sm table-bordered">' +
                    '<thead><tr style="background-color: #e9ecef;">' +
                    '<th style="text-align:center;">Cant.</th>' +
                    '<th>Descripción</th>' +
                    '<th style="text-align:center;">Unidad</th>' +
                    '<th style="text-align:right;">Precio Unit.</th>' +
                    '<th style="text-align:center;">IVA</th>' +
                    '<th style="text-align:right;">Monto IVA</th>' +
                    '<th style="text-align:right;">Total</th>' +
                    '</tr></thead>' +
                    '<tbody>' + ocRows +
                    '<tr style="background:#f8f9fa;font-weight:bold;">' +
                    '<td colspan="6" style="text-align:right;">TOTAL OC:</td>' +
                    '<td style="text-align:right;color:#27ae60;">$ ' + totalOC.toFixed(2) + '</td>' +
                    '</tr>' +
                    '</tbody></table></div>';
            }

            ocHtml = '<div class="alert alert-info mt-3">' +
                '<strong>Orden de Compra:</strong> ' + s.codigo_oc + '<br>' +
                '<strong>Monto aprobado:</strong> $' + parseFloat(s.monto_oc || s.monto_estimado).toFixed(2) + '<br>' +
                '<strong>Proveedor:</strong> ' + (s.proveedor_nombre || 'No asignado') + '<br>' +
                '<strong>Fecha de Entrega:</strong> ' + formatearFechaLocal(s.fecha_entrega, 'largo') +
                '<button class="btn btn-sm btn-outline-primary ms-2" onclick="solicitudesModales.mostrarReporteOC(' + s.id + ')">Ver Reporte</button>' +
                ocItemsHtml +
                '</div>';
        }

        // ========== COTIZACIONES ==========
        let cotizacionesHtml = '';
        if (cotizaciones.length) {
            var cotRows = '';
            cotizaciones.forEach(function (c) {
                cotRows += '<tr><td>' + c.proveedor_nombre + '</td><td>$' + parseFloat(c.monto_cotizado).toFixed(2) + '</td><td>' + formatearFechaLocal(c.fecha_cotizacion, 'corto') + '</td></tr>';
            });
            cotizacionesHtml = '<h6 class="mt-3">Cotizaciones</h6><div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>Proveedor</th><th>Monto</th><th>Fecha</th></tr></thead><tbody>' + cotRows + '</tbody></table></div>';
        }

        // ========== PAGOS ==========
        let pagosHtml = '';
        if (pagos.length) {
            var pagRows = '';
            pagos.forEach(function (p) {
                pagRows += '<tr><td>' + formatearFechaLocal(p.fecha_pago, 'corto') + '</td><td>' + p.numero_transferencia + '</td><td>' + p.beneficiario + '</td><td>' + (window.solicitudesCompras?.formatearMonto(p.monto_pagado) || '$0.00') + '</td></tr>';
            });
            pagosHtml = '<h6 class="mt-3">Pagos</h6><div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>Fecha</th><th>Transferencia</th><th>Beneficiario</th><th>Monto</th></tr></thead><tbody>' + pagRows + '</tbody></table></div>';
        }

        // ========== HISTORIAL ==========
        let historialHtml = '';
        if (historial.length) {
            var histRows = '';
            historial.forEach(function (h) {
                var fecha = formatearFechaLocal(h.created_at, 'largo') + ' ' + (h.created_at ? h.created_at.split('T')[1]?.substring(0, 5) || '' : '');
                var estadoAnterior = h.estado_anterior ? h.estado_anterior.replace('_', ' ') : 'N/A';
                var estadoNuevo = h.estado_nuevo ? h.estado_nuevo.replace('_', ' ') : 'N/A';
                var comentario = h.comentario || 'Sin comentario';

                var badgeColor = 'bg-secondary';
                if (h.estado_nuevo === 'Pendiente') badgeColor = 'bg-warning text-dark';
                else if (h.estado_nuevo === 'En_Revision') badgeColor = 'bg-info text-white';
                else if (h.estado_nuevo === 'Aprobada') badgeColor = 'bg-success';
                else if (h.estado_nuevo === 'Rechazada') badgeColor = 'bg-danger';
                else if (h.estado_nuevo === 'Pagada') badgeColor = 'bg-primary';
                else if (h.estado_nuevo === 'Cerrada') badgeColor = 'bg-secondary';

                histRows += '<tr>' +
                    '<td>' + fecha + '</td>' +
                    '<td>' + (h.usuario_nombre || 'Sistema') + '</td>' +
                    '<td><span class="badge bg-secondary">' + estadoAnterior + '</span></td>' +
                    '<td><span class="badge ' + badgeColor + '">' + estadoNuevo + '</span></td>' +
                    '<td>' + comentario + '</td>' +
                    '</tr>';
            });
            historialHtml = '<h6 class="mt-3"><i class="fas fa-history"></i> Historial de Actividades</h6><div class="table-responsive" style="max-height: 200px; overflow-y: auto;"><table class="table table-sm table-bordered"><thead><tr><th>Fecha</th><th>Usuario</th><th>Estado Anterior</th><th>Estado Nuevo</th><th>Comentario</th></tr></thead><tbody>' + histRows + '</tbody></table></div>';
        } else {
            historialHtml = '<div class="alert alert-secondary mt-3">No hay historial registrado.</div>';
        }

        return '<div class="detalles-header">' +
            '<h4>' + (s.codigo_solicitud || 'N/A') + '</h4>' +
            '<p>' + (s.descripcion || 'Sin descripción') + '</p>' +
            '<span class="' + tipoBadge + '">' + tipoTexto + '</span>' +
            '</div>' +
            '<div class="detalles-info">' +
            '<div class="info-grid">' +
            '<div><strong>Solicitante:</strong> ' + s.solicitante_nombre + '</div>' +
            '<div><strong>Fecha:</strong> ' + formatearFechaLocal(s.fecha_solicitud, 'corto') + '</div>' +
            '<div><strong>Proyecto:</strong> ' + s.proyecto_nombre + '</div>' +
            '<div><strong>Monto:</strong> ' + (window.solicitudesCompras?.formatearMonto(s.monto_estimado, s.moneda) || '$0.00') + '</div>' +
            '<div><strong>Prioridad:</strong> ' + (s.prioridad || 'Media') + '</div>' +
            '<div><strong>Estado:</strong> ' + ((s.estado || 'Pendiente').replace('_', ' ')) + '</div>' +
            '</div>' +
            ocHtml +
            itemsHtml +
            cotizacionesHtml +
            pagosHtml +
            historialHtml +
            '</div>';
    }

    // ========== FUNCIÓN RECARGAR DETALLES ==========
    function recargarDetalles(id) {
        if (modalInstances['modal-ver-solicitud']) {
            modalInstances['modal-ver-solicitud'].hide();
        }
        setTimeout(function () {
            verDetalles(id);
        }, 300);
    }

    // ========== MODAL: APROBACIÓN (completa) ==========
    async function mostrarAprobacion(id) {
        try {
            const response = await fetch(`./api/obtener_detalles_solicitud.php?id=${id}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.message);
            const s = data.solicitud;
            const items = data.items || [];
            const tipo = s.tipo_solicitud;
            const monto = parseFloat(s.monto_estimado);
            const requiereCotizaciones = (tipo === 'compra' && monto >= 1000);

            document.getElementById('aprobar-solicitud-id').value = id;
            document.getElementById('aprobar-decision').value = '';
            document.getElementById('aprobar-comentario').value = '';
            document.getElementById('campos-rechazo-group').style.display = 'none';
            document.getElementById('campos-aprobacion-group').style.display = 'none';

            document.getElementById('aprobar-direccion-entrega').value = s.direccion_entrega || '';
            document.getElementById('aprobar-fecha-entrega').value = s.fecha_entrega || '';
            document.getElementById('aprobar-forma-pago').value = s.forma_pago || 'Transferencia bancaria';

            // Campo oculto para el total con IVA
            let hiddenTotal = document.getElementById('monto-total-con-iva');
            if (!hiddenTotal) {
                hiddenTotal = document.createElement('input');
                hiddenTotal.type = 'hidden';
                hiddenTotal.id = 'monto-total-con-iva';
                document.getElementById('campos-aprobacion-group').appendChild(hiddenTotal);
            }
            hiddenTotal.value = '0';

            cargarItemsAprobacion(items);

            const proveedorGroup = document.getElementById('proveedor-group');
            const cotizacionesGroup = document.getElementById('cotizaciones-group');
            proveedorGroup.style.display = 'none';
            cotizacionesGroup.style.display = 'none';

            if (tipo === 'servicio') {
                proveedorGroup.style.display = 'block';
                proveedorGroup.querySelector('label').innerHTML = '<i class="fas fa-handshake"></i> Seleccionar Proveedor del Servicio *';
                await cargarProveedoresSelect('aprobar-proveedor', 'servicio');
            } else if (requiereCotizaciones) {
                cotizacionesGroup.style.display = 'block';
                await cargarCotizaciones(id);
            } else {
                proveedorGroup.style.display = 'block';
                proveedorGroup.querySelector('label').innerHTML = '<i class="fas fa-truck"></i> Seleccionar Proveedor *';
                await cargarProveedoresSelect('aprobar-proveedor', 'bienes');
            }

            if (s.proveedor_id) {
                setTimeout(() => {
                    const select = document.getElementById('aprobar-proveedor');
                    if (select && Array.from(select.options).some(opt => opt.value == s.proveedor_id))
                        select.value = s.proveedor_id;
                }, 500);
            }

            const decisionSelect = document.getElementById('aprobar-decision');
            if (decisionSelect._listener) decisionSelect.removeEventListener('change', decisionSelect._listener);
            const handleChange = function () {
                const val = this.value;
                const rechazoDiv = document.getElementById('campos-rechazo-group');
                const aprobacionDiv = document.getElementById('campos-aprobacion-group');
                const comentarioRechazo = document.getElementById('aprobar-comentario');
                if (val === 'Rechazada') {
                    rechazoDiv.style.display = 'block';
                    aprobacionDiv.style.display = 'none';
                    comentarioRechazo.required = true;
                } else if (val === 'Aprobada') {
                    rechazoDiv.style.display = 'none';
                    aprobacionDiv.style.display = 'block';
                    comentarioRechazo.required = false;
                } else {
                    rechazoDiv.style.display = 'none';
                    aprobacionDiv.style.display = 'none';
                    comentarioRechazo.required = false;
                }
            };
            decisionSelect.addEventListener('change', handleChange);
            decisionSelect._listener = handleChange;

            modalInstances['modal-aprobar-solicitud']?.show();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    function cargarItemsAprobacion(items) {
        const tbody = document.getElementById('items-orden-compra-body');
        if (!tbody) return;

        if (!items || !items.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay items</td></tr>';
            document.getElementById('total-oc-aprobacion').textContent = '$0.00';
            return;
        }

        let html = '';
        let totalGeneral = 0;

        items.forEach((item, idx) => {
            const precio = parseFloat(item.precio_unitario_estimado) || 0;
            const cantidad = parseInt(item.cantidad) || 1;
            const subtotal = precio * cantidad;
            const tieneIva = false;
            const iva = 0;
            const totalConIva = subtotal;
            totalGeneral += totalConIva;

            html += '<tr data-item-index="' + idx + '">';
            html += '<td><input type="text" class="form-control form-control-sm item-descripcion" value="' + escapeHtml(item.descripcion_item) + '" readonly style="background:#f8f9fa"></td>';
            html += '<td><input type="number" class="form-control form-control-sm item-cantidad" value="' + cantidad + '" readonly style="background:#f8f9fa"></td>';
            html += '<td><input type="text" class="form-control form-control-sm item-unidad" value="' + (item.unidad_medida || '') + '" readonly style="background:#f8f9fa"></td>';
            html += '<td><input type="number" class="form-control form-control-sm item-precio" value="' + precio.toFixed(2) + '" step="0.01" onchange="solicitudesModales.actualizarSubtotalItem(this)"></td>';
            html += '<td class="text-center">';
            html += '<div class="form-check form-check-inline">';
            html += '<input class="form-check-input item-tiene-iva" type="checkbox" onchange="solicitudesModales.actualizarSubtotalItem(this)" data-item="' + idx + '">';
            html += '<label class="form-check-label small">Con IVA</label>';
            html += '</div></td>';
            html += '<td><input type="text" class="form-control form-control-sm item-iva" value="0.00" readonly style="background:#e9ecef; width:80px;"></td>';
            html += '<td><input type="text" class="form-control form-control-sm item-total" value="' + totalConIva.toFixed(2) + '" readonly style="background:#e9ecef; width:100px;"></td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;
        document.getElementById('total-oc-aprobacion').textContent = '$' + totalGeneral.toFixed(2);
        document.getElementById('monto-total-con-iva').value = totalGeneral.toFixed(2);
    }

    function actualizarSubtotalItem(input) {
        const row = input.closest('tr');
        const cantidad = parseFloat(row.querySelector('.item-cantidad')?.value) || 0;
        const precio = parseFloat(row.querySelector('.item-precio')?.value) || 0;
        const tieneIvaCheck = row.querySelector('.item-tiene-iva');
        const tieneIva = tieneIvaCheck ? tieneIvaCheck.checked : false;

        const subtotal = cantidad * precio;
        const IVA_PORCENTAJE = 16;
        const iva = tieneIva ? subtotal * (IVA_PORCENTAJE / 100) : 0;
        const totalConIva = subtotal + iva;

        const ivaInput = row.querySelector('.item-iva');
        const totalInput = row.querySelector('.item-total');

        if (ivaInput) ivaInput.value = iva.toFixed(2);
        if (totalInput) totalInput.value = totalConIva.toFixed(2);

        recalcularTotalAprobacion();
    }

    function recalcularTotalAprobacion() {
        let total = 0;
        document.querySelectorAll('#items-orden-compra-body .item-total').forEach(inp => {
            total += parseFloat(inp.value) || 0;
        });
        document.getElementById('total-oc-aprobacion').textContent = '$' + total.toFixed(2);
        document.getElementById('monto-total-con-iva').value = total.toFixed(2);
    }

    function obtenerItemsModificados() {
        const items = [];
        document.querySelectorAll('#items-orden-compra-body tr').forEach(row => {
            const desc = row.querySelector('.item-descripcion')?.value;
            if (!desc) return;

            const cantidad = parseFloat(row.querySelector('.item-cantidad')?.value) || 0;
            const precio = parseFloat(row.querySelector('.item-precio')?.value) || 0;
            const tieneIvaCheck = row.querySelector('.item-tiene-iva');
            const tieneIva = tieneIvaCheck ? tieneIvaCheck.checked : false;
            const subtotal = cantidad * precio;
            const IVA_PORCENTAJE = 16;
            const iva = tieneIva ? subtotal * (IVA_PORCENTAJE / 100) : 0;
            const totalConIva = subtotal + iva;

            items.push({
                descripcion_item: desc,
                cantidad: cantidad,
                unidad_medida: row.querySelector('.item-unidad')?.value || '',
                precio_unitario: precio,
                subtotal: subtotal,
                tiene_iva: tieneIva,
                iva: iva,
                total_con_iva: totalConIva
            });
        });
        return items;
    }

    async function cargarCotizaciones(solicitudId) {
        const container = document.getElementById('cotizaciones-lista');
        if (!container) return;
        container.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm"></div> Cargando...</div>';
        try {
            const res = await fetch(`./api/cotizaciones.php?action=listar&solicitud_id=${solicitudId}`);
            const data = await res.json();
            if (data.success && data.cotizaciones.length) {
                let html = '<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>Proveedor</th><th>Monto</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>';
                data.cotizaciones.forEach(c => {
                    html += `<tr><td>${c.proveedor_nombre}</td><td>$${parseFloat(c.monto_cotizado).toFixed(2)}</td><td>${formatearFechaLocal(c.fecha_cotizacion, 'corto')}</td><td><button class="btn btn-sm btn-success btn-seleccionar-ganador" data-id="${c.id}">Seleccionar ganador</button></td></tr>`;
                });
                html += '</tbody></table></div><button class="btn btn-sm btn-primary" id="btn-agregar-cotizacion">Agregar cotización</button>';
                container.innerHTML = html;
                document.getElementById('btn-agregar-cotizacion')?.addEventListener('click', () => mostrarModalAgregarCotizacion(solicitudId));
            } else {
                container.innerHTML = '<div class="alert alert-warning">No hay cotizaciones. Debe agregar al menos 2 cotizaciones.</div><button class="btn btn-sm btn-primary mt-2" id="btn-agregar-cotizacion">Agregar cotización</button>';
                document.getElementById('btn-agregar-cotizacion')?.addEventListener('click', () => mostrarModalAgregarCotizacion(solicitudId));
            }
        } catch (error) {
            container.innerHTML = '<div class="alert alert-danger">Error al cargar cotizaciones</div>';
        }
    }

    function toggleComentarioRechazo() {
        const decision = document.getElementById('aprobar-decision')?.value;
        const group = document.getElementById('comentario-rechazo-group');
        const camposAprobacion = document.getElementById('campos-aprobacion-group');
        if (decision === 'Rechazada') {
            if (group) group.style.display = 'block';
            if (camposAprobacion) camposAprobacion.style.display = 'none';
        } else if (decision === 'Aprobada') {
            if (group) group.style.display = 'none';
            if (camposAprobacion) camposAprobacion.style.display = 'block';
        } else {
            if (group) group.style.display = 'none';
            if (camposAprobacion) camposAprobacion.style.display = 'none';
        }
    }

    async function confirmarAprobacion() {
        const id = document.getElementById('aprobar-solicitud-id').value;
        const decision = document.getElementById('aprobar-decision').value;
        const comentario = document.getElementById('aprobar-comentario').value;
        const proveedorId = document.getElementById('aprobar-proveedor').value;
        const cotizacionGanadoraId = document.getElementById('cotizacion-ganadora-id')?.value;
        const direccionEntrega = document.getElementById('aprobar-direccion-entrega').value;
        const fechaEntrega = document.getElementById('aprobar-fecha-entrega').value;
        const formaPago = document.getElementById('aprobar-forma-pago').value;
        const itemsModificados = obtenerItemsModificados();
        const montoTotalSinIVA = itemsModificados.reduce((sum, i) => sum + i.subtotal, 0);
        const montoTotalConIVA = itemsModificados.reduce((sum, i) => sum + i.total_con_iva, 0);

        if (!decision) return Swal.fire({ icon: 'warning', title: 'Selección requerida' });
        if (decision === 'Rechazada' && !comentario) return Swal.fire({ icon: 'warning', title: 'Comentario requerido' });
        if (decision === 'Aprobada') {
            if (!proveedorId && !cotizacionGanadoraId) return Swal.fire({ icon: 'warning', title: 'Proveedor requerido' });
            if (!direccionEntrega) return Swal.fire({ icon: 'warning', title: 'Dirección de entrega requerida' });
            if (!fechaEntrega) return Swal.fire({ icon: 'warning', title: 'Fecha de entrega requerida' });
            if (!formaPago) return Swal.fire({ icon: 'warning', title: 'Forma de pago requerida' });
            if (!itemsModificados.length) return Swal.fire({ icon: 'warning', title: 'Items requeridos' });
        }

        Swal.fire({
            title: '¿Confirmar ' + (decision === 'Aprobada' ? 'aprobación' : 'rechazo') + '?',
            html: '<div style="text-align:left">' +
                '<p><strong>Dirección:</strong> ' + direccionEntrega + '</p>' +
                '<p><strong>Fecha entrega:</strong> ' + formatearFechaLocal(fechaEntrega, 'largo') + '</p>' +
                '<p><strong>Monto sin IVA:</strong> $' + montoTotalSinIVA.toFixed(2) + '</p>' +
                '<p><strong>IVA (16%):</strong> $' + (montoTotalConIVA - montoTotalSinIVA).toFixed(2) + '</p>' +
                '<p><strong>Total con IVA:</strong> $' + montoTotalConIVA.toFixed(2) + '</p>' +
                '</div>',
            icon: 'question',
            showCancelButton: true
        }).then(async (result) => {
            if (!result.isConfirmed) return;
            Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const body = {
                    solicitud_id: id,
                    decision: decision,
                    comentario: comentario,
                    direccion_entrega: direccionEntrega,
                    fecha_entrega: fechaEntrega,
                    forma_pago: formaPago,
                    items_oc: itemsModificados,
                    monto_total_oc: montoTotalSinIVA,
                    monto_total_con_iva: montoTotalConIVA
                };
                if (proveedorId) body.proveedor_id = proveedorId;
                if (cotizacionGanadoraId) body.cotizacion_ganadora_id = cotizacionGanadoraId;

                const res = await fetch('./api/aprobar_solicitud.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                Swal.close();
                if (data.success) {
                    modalInstances['modal-aprobar-solicitud']?.hide();
                    Swal.fire({ icon: 'success', title: 'Solicitud actualizada', timer: 2000 });
                    if (window.solicitudesCompras) window.solicitudesCompras.cargarSolicitudes();
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
            const res = await fetch(`./api/obtener_detalles_solicitud.php?id=${id}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            const s = data.solicitud;
            if (!s.codigo_oc) {
                Swal.fire({ icon: 'warning', title: 'Sin Orden de Compra', text: 'Esta solicitud no tiene una Orden de Compra aprobada.' });
                return;
            }
            document.getElementById('info-solicitud-pago').innerHTML = `
                <strong>Orden de Compra:</strong> ${s.codigo_oc}<br>
                <strong>Fecha de Entrega:</strong> ${formatearFechaLocal(s.fecha_entrega, 'largo')}<br>
                <strong>Forma de Pago:</strong> ${s.forma_pago || 'No especificada'}<br>
                <strong>Dirección:</strong> ${s.direccion_entrega || 'No especificada'}
            `;
            document.getElementById('pago-solicitud-id').value = id;
            document.getElementById('pago-orden-compra-id').value = s.orden_compra_id || '';
            document.getElementById('pago-monto').value = s.monto_oc || s.monto_estimado;
            document.getElementById('pago-fecha').value = new Date().toISOString().split('T')[0];
            if (s.proveedor_nombre) {
                document.getElementById('pago-beneficiario').value = s.proveedor_nombre;
                document.getElementById('pago-documento').value = s.proveedor_rif || '';
                document.getElementById('pago-cuenta-destino').value = s.cuenta_bancaria || '';
            }
            await cargarBancos();
            modalInstances['modal-registrar-pago']?.show();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    async function confirmarPago() {
        if (!validarTodosCamposPago()) return Swal.fire({ icon: 'warning', title: 'Campos incompletos' });
        const form = document.getElementById('form-registrar-pago');
        if (!form.checkValidity()) return form.reportValidity();

        const comprobanteInput = document.getElementById('pago-comprobante');
        if (comprobanteInput.files.length) {
            const file = comprobanteInput.files[0];
            if (file.size > 50 * 1024 * 1024) return Swal.fire({ icon: 'warning', title: 'Archivo muy grande' });
            if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'].includes(file.type))
                return Swal.fire({ icon: 'warning', title: 'Tipo de archivo no válido' });
        }

        const formData = new FormData();
        formData.append('solicitud_id', document.getElementById('pago-solicitud-id').value);
        formData.append('orden_compra_id', document.getElementById('pago-orden-compra-id').value);
        formData.append('banco_id', document.getElementById('pago-banco-id').value);
        formData.append('numero_transferencia', document.getElementById('pago-numero-transferencia').value);
        formData.append('monto', document.getElementById('pago-monto').value);
        formData.append('fecha_pago', document.getElementById('pago-fecha').value);
        formData.append('beneficiario', document.getElementById('pago-beneficiario').value);
        formData.append('documento', document.getElementById('pago-documento').value);
        formData.append('cuenta_destino', document.getElementById('pago-cuenta-destino').value);
        formData.append('observaciones', document.getElementById('pago-observaciones').value);
        if (comprobanteInput.files.length) formData.append('comprobante', comprobanteInput.files[0]);

        Swal.fire({ title: 'Registrando pago...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const res = await fetch('./api/registrar_pago_solicitud.php', { method: 'POST', body: formData });
            const data = await res.json();
            Swal.close();
            if (data.success) {
                modalInstances['modal-registrar-pago']?.hide();
                Swal.fire({ icon: 'success', title: 'Pago registrado', timer: 2000 });
                if (window.solicitudesCompras) window.solicitudesCompras.cargarSolicitudes();
            } else throw new Error(data.message);
        } catch (error) {
            Swal.close();
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    // ========== MODAL: CERRAR SOLICITUD ==========
    function mostrarCierre(id) {
        document.getElementById('cerrar-solicitud-id').value = id;
        document.getElementById('cerrar-concepto').value = '';
        document.getElementById('cerrar-observaciones').value = '';
        obtenerInfoSolicitudParaCierre(id);
        modalInstances['modal-cerrar-solicitud']?.show();
    }

    async function obtenerInfoSolicitudParaCierre(solicitudId) {
        try {
            const res = await fetch(`./api/obtener_detalles_solicitud.php?id=${solicitudId}&simple=1`);
            const data = await res.json();
            if (data.success) {
                const s = data.solicitud;
                const concepto = document.getElementById('cerrar-concepto');
                if (concepto) concepto.value = `Egreso por OC ${s.codigo_oc || s.codigo_solicitud} - ${s.descripcion.substring(0, 50)}`;
            }
        } catch (e) { console.error(e); }
    }

    async function confirmarCierre() {
        const id = document.getElementById('cerrar-solicitud-id').value;
        const concepto = document.getElementById('cerrar-concepto').value;
        const observaciones = document.getElementById('cerrar-observaciones').value;
        if (!concepto) return Swal.fire({ icon: 'warning', title: 'Concepto requerido' });
        Swal.fire({
            title: 'Cerrar solicitud',
            html: `<p>¿Está seguro de cerrar esta solicitud?</p><p><strong>Concepto:</strong> ${concepto}</p>`,
            icon: 'question',
            showCancelButton: true
        }).then(async (result) => {
            if (!result.isConfirmed) return;
            Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const res = await fetch('./api/cerrar_solicitud.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ solicitud_id: id, observaciones, concepto }) });
                const data = await res.json();
                Swal.close();
                if (data.success) {
                    modalInstances['modal-cerrar-solicitud']?.hide();
                    Swal.fire({ icon: 'success', title: 'Solicitud cerrada', timer: 2000 });
                    if (window.solicitudesCompras) window.solicitudesCompras.cargarSolicitudes();
                } else throw new Error(data.message);
            } catch (error) {
                Swal.close();
                Swal.fire({ icon: 'error', title: 'Error', text: error.message });
            }
        });
    }

    // ========== MODAL: REPORTE ORDEN DE COMPRA CON IVA ==========
    async function mostrarReporteOC(solicitudId) {
        try {
            const res = await fetch('./api/obtener_detalles_solicitud.php?id=' + solicitudId);
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            const s = data.solicitud;
            if (!s.codigo_oc) return Swal.fire({ icon: 'info', title: 'Sin Orden de Compra' });

            let itemsOC = data.orden_compra_items || [];
            let totalGeneral = 0;
            let totalSinIVA = 0;
            let totalIVA = 0;

            if (!itemsOC.length && data.items.length) {
                itemsOC = data.items.map(function (i) {
                    return {
                        descripcion_item: i.descripcion_item,
                        cantidad: i.cantidad,
                        unidad_medida: i.unidad_medida,
                        precio_unitario: i.precio_unitario_estimado,
                        subtotal: i.cantidad * i.precio_unitario_estimado,
                        tiene_iva: 0,
                        iva: 0,
                        total_con_iva: i.cantidad * i.precio_unitario_estimado
                    };
                });
            }

            // Calcular totales
            itemsOC.forEach(function (i) {
                const precio = parseFloat(i.precio_unitario || i.precio || 0);
                const cantidad = parseFloat(i.cantidad || 0);
                const subtotal = precio * cantidad;
                const tieneIva = parseInt(i.tiene_iva) === 1;
                const iva = parseFloat(i.iva) || (tieneIva ? subtotal * 0.16 : 0);
                const total = parseFloat(i.total_con_iva) || (subtotal + iva);

                totalSinIVA += subtotal;
                totalIVA += iva;
                totalGeneral += total;
            });

            const totalLetras = numeroALetras(totalGeneral);
            const fechaEntregaFormateada = formatearFechaLocal(s.fecha_entrega, 'largo');
            const nombreEmpresa = s.proveedor_nombre || '_________________________';
            const rifEmpresa = s.proveedor_rif || '_________________________';

            // Generar filas de la tabla con IVA
            var itemsTabla = '';
            itemsOC.forEach(function (i) {
                const precio = parseFloat(i.precio_unitario || i.precio || 0);
                const cantidad = parseFloat(i.cantidad || 0);
                const subtotal = precio * cantidad;
                const tieneIva = parseInt(i.tiene_iva) === 1;
                const iva = parseFloat(i.iva) || (tieneIva ? subtotal * 0.16 : 0);
                const total = parseFloat(i.total_con_iva) || (subtotal + iva);

                itemsTabla += '<tr>' +
                    '<td style="border: 1px solid #dee2e6; padding: 4px; text-align: center;">' + cantidad + '</td>' +
                    '<td style="border: 1px solid #dee2e6; padding: 4px;">' + i.descripcion_item + '</td>' +
                    '<td style="border: 1px solid #dee2e6; padding: 4px; text-align: center;">' + (i.unidad_medida || '-') + '</td>' +
                    '<td style="border: 1px solid #dee2e6; padding: 4px; text-align: right;">$ ' + precio.toFixed(2) + '</td>' +
                    '<td style="border: 1px solid #dee2e6; padding: 4px; text-align: center;">' + (tieneIva ? 'Sí' : 'No') + '</td>' +
                    '<td style="border: 1px solid #dee2e6; padding: 4px; text-align: right;">$ ' + iva.toFixed(2) + '</td>' +
                    '<td style="border: 1px solid #dee2e6; padding: 4px; text-align: right;"><strong>$ ' + total.toFixed(2) + '</strong></td>' +
                    '</tr>';
            });

            var html = '<div id="reporte-oc-' + solicitudId + '" class="reporte-oc" style="font-family: \'Segoe UI\', Arial, sans-serif; font-size: 11px; line-height: 1.3;">' +
                '<!-- PRIMERA PÁGINA - ORDEN DE COMPRA -->' +
                '<div>' +
                '<div style="text-align: center; margin-bottom: 15px;">' +
                '<h2 style="color: #2c3e50; margin: 0; font-size: 18px;">CODEHCIU</h2>' +
                '<p style="color: #7f8c8d; margin: 2px 0; font-size: 11px;">Comisión para los Derechos Humanos y la Ciudadanía</p>' +
                '<h3 style="color: #3498db; margin: 8px 0 0 0; font-size: 14px;">ORDEN DE COMPRA</h3>' +
                '</div>' +

                '<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; background: #f8f9fa; padding: 10px; border-radius: 6px;">' +
                '<div style="flex: 1; min-width: 180px;">' +
                '<p style="margin: 2px 0;"><strong>N° OC:</strong> ' + s.codigo_oc + '</p>' +
                '<p style="margin: 2px 0;"><strong>Fecha Emisión:</strong> ' + formatearFechaLocal(s.fecha_aprobacion || s.created_at, 'corto') + '</p>' +
                '<p style="margin: 2px 0;"><strong>Solicitud:</strong> ' + s.codigo_solicitud + '</p>' +
                '</div>' +
                '<div style="flex: 1; min-width: 180px;">' +
                '<p style="margin: 2px 0;"><strong>Solicitante:</strong> ' + s.solicitante_nombre + '</p>' +
                '<p style="margin: 2px 0;"><strong>Proyecto:</strong> ' + s.proyecto_nombre + '</p>' +
                '<p style="margin: 2px 0;"><strong>Tipo:</strong> ' + (s.tipo_solicitud === 'servicio' ? 'Servicio' : 'Compra de Items') + '</p>' +
                '</div>' +
                '</div>' +

                '<div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 12px;">' +
                '<h4 style="color: #2c3e50; margin: 0 0 8px 0; font-size: 12px;">PROVEEDOR</h4>' +
                '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">' +
                '<div><strong>Nombre:</strong><br>' + (s.proveedor_nombre || 'No asignado') + '</div>' +
                '<div><strong>RIF/CI:</strong><br>' + (s.proveedor_rif || '-') + '</div>' +
                '<div><strong>Cuenta Bancaria:</strong><br>' + (s.cuenta_bancaria || '-') + '</div>' +
                '<div><strong>Teléfono:</strong><br>' + (s.proveedor_telefono || '-') + '</div>' +
                '<div><strong>Email:</strong><br>' + (s.proveedor_email || '-') + '</div>' +
                '<div><strong>Dirección:</strong><br>' + (s.proveedor_direccion || '-') + '</div>' +
                '</div>' +
                '</div>' +

                '<h4 style="color: #2c3e50; margin: 10px 0 5px 0; font-size: 12px;">DETALLE DE LA ORDEN</h4>' +
                '<table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px;">' +
                '<thead>' +
                '<tr style="background-color: #2c3e50;">' +
                '<th style="border: 1px solid #dee2e6; padding: 5px; text-align: center; color: #000000;">Cant.</th>' +
                '<th style="border: 1px solid #dee2e6; padding: 5px; text-align: left; color: #000000;">Descripción</th>' +
                '<th style="border: 1px solid #dee2e6; padding: 5px; text-align: center; color: #000000;">Unidad</th>' +
                '<th style="border: 1px solid #dee2e6; padding: 5px; text-align: right; color: #000000;">Precio Unit.</th>' +
                '<th style="border: 1px solid #dee2e6; padding: 5px; text-align: center; color: #000000;">IVA</th>' +
                '<th style="border: 1px solid #dee2e6; padding: 5px; text-align: right; color: #000000;">Monto IVA</th>' +
                '<th style="border: 1px solid #dee2e6; padding: 5px; text-align: right; color: #000000;">Total</th>' +
                '</tr>' +
                '</thead>' +
                '<tbody>' +
                itemsTabla +
                '<tr style="background-color: #f8f9fa; font-weight: bold;">' +
                '<td colspan="4" style="border: 1px solid #dee2e6; padding: 5px; text-align: right;">SUBTOTAL SIN IVA:</td>' +
                '<td colspan="3" style="border: 1px solid #dee2e6; padding: 5px; text-align: right; color: #2c3e50;">$ ' + totalSinIVA.toFixed(2) + '</td>' +
                '</tr>' +
                '<tr style="background-color: #f8f9fa;">' +
                '<td colspan="4" style="border: 1px solid #dee2e6; padding: 5px; text-align: right; font-weight: bold;">IVA (16%):</td>' +
                '<td colspan="3" style="border: 1px solid #dee2e6; padding: 5px; text-align: right; color: #e67e22;">$ ' + totalIVA.toFixed(2) + '</td>' +
                '</tr>' +
                '<tr style="background-color: #2c3e50; font-weight: bold;">' +
                '<td colspan="4" style="border: 1px solid #2c3e50; padding: 5px; text-align: right; color: #ffffff;">TOTAL GENERAL:</td>' +
                '<td colspan="3" style="border: 1px solid #2c3e50; padding: 5px; text-align: right; color: #ffffff;">$ ' + totalGeneral.toFixed(2) + '</td>' +
                '</tr>' +
                '</tbody>' +
                '</table>' +

                '<div style="text-align: right; margin: 8px 0; padding: 5px; background: #f8f9fa; border-radius: 4px; font-size: 10px;">' +
                '<p style="margin: 0;"><strong>Total en letras:</strong> ' + totalLetras + '</p>' +
                '</div>' +

                '<div style="background: #e8f4f8; padding: 6px 8px; border-radius: 6px; margin-bottom: 10px; display: flex; flex-wrap: wrap; justify-content: space-between; font-size: 10px;">' +
                '<div><strong>📅 Fecha de Entrega:</strong> ' + fechaEntregaFormateada + '</div>' +
                '<div><strong>💳 Forma de Pago:</strong> ' + (s.forma_pago || 'No especificada') + '</div>' +
                '<div><strong>📍 Dirección de Entrega:</strong> ' + (s.direccion_entrega || 'No especificada') + '</div>' +
                '</div>' +

                (s.descripcion ?
                    '<div style="margin: 8px 0;">' +
                    '<h4 style="color: #2c3e50; margin: 0 0 3px 0; font-size: 11px;">OBSERVACIONES</h4>' +
                    '<p style="background: #f8f9fa; padding: 5px; border-radius: 4px; margin: 0; font-size: 10px;">' + s.descripcion + '</p>' +
                    '</div>'
                    : '') +

                '<div style="display: flex; justify-content: space-between; margin-top: 20px; padding-top: 10px; border-top: 1px solid #dee2e6;">' +
                '<div style="text-align: center; flex: 1;">' +
                '<p style="margin: 0; font-size: 10px;">_________________________</p>' +
                '<p style="margin: 2px 0; font-weight: bold; font-size: 10px;">Solicitante</p>' +
                '</div>' +
                '<div style="text-align: center; flex: 1;">' +
                '<p style="margin: 0; font-size: 10px;">_________________________</p>' +
                '<p style="margin: 2px 0; font-weight: bold; font-size: 10px;">Resp. Compras</p>' +
                '</div>' +
                '<div style="text-align: center; flex: 1;">' +
                '<p style="margin: 0; font-size: 10px;">_________________________</p>' +
                '<p style="margin: 2px 0; font-weight: bold; font-size: 10px;">Administración</p>' +
                '</div>' +
                '</div>' +

                '<div style="display: flex; justify-content: space-between; margin-top: 20px; padding-top: 10px;">' +
                '<div style="text-align: center; flex: 1;">' +
                '<p style="margin: 0; font-size: 10px;">_________________________</p>' +
                '<p style="margin: 2px 0; font-weight: bold; font-size: 10px;">Coordinación General</p>' +
                '</div>' +
                '<div style="text-align: center; flex: 1;">' +
                '<p style="margin: 0; font-size: 10px;">_________________________</p>' +
                '<p style="margin: 2px 0; font-weight: bold; font-size: 10px;">Proveedor</p>' +
                '</div>' +
                '</div>' +

                '<div style="margin-top: 12px; text-align: center; font-size: 8px; color: #95a5a6; border-top: 1px solid #dee2e6; padding-top: 5px;">' +
                '<p style="margin: 2px 0;">Documento generado por el Sistema de Finanzas CODEHCIU</p>' +
                '<p style="margin: 2px 0;">Fecha de emisión: ' + new Date().toLocaleString() + '</p>' +
                '</div>' +
                '</div>' +

                '<!-- SEGUNDA PÁGINA - DECLARACIÓN AML DEL PROVEEDOR -->' +
                '<div style="page-break-before: always; margin-top: 15px;">' +
                '<div style="text-align: center; margin-bottom: 15px;">' +
                '<h3 style="color: #2c3e50; margin: 0; font-size: 14px;">DECLARACIÓN DE PREVENCIÓN DE LEGITIMACIÓN DE CAPITALES</h3>' +
                '<h4 style="color: #e74c3c; margin: 3px 0; font-size: 12px;">Y FINANCIACIÓN AL TERRORISMO</h4>' +
                '</div>' +

                '<div style="line-height: 1.35; font-size: 10px;">' +
                '<p style="margin: 0 0 8px 0; text-align: justify;">La empresa <strong>' + nombreEmpresa + '</strong>, debidamente constituida conforme a las leyes de la República Bolivariana de Venezuela, declara su firme compromiso con la prevención y control de la Legitimación de Capitales, la Financiación al Terrorismo y la Financiación de la Proliferación de Armas de Destrucción Masiva, en cumplimiento de lo establecido en la legislación vigente.</p>' +

                '<p style="margin: 6px 0; text-align: justify;">En particular, damos cumplimiento a lo dispuesto en la <strong>Ley Orgánica contra la Delincuencia Organizada y Financiamiento al Terrorismo (LOCDOFT)</strong>, así como a las normativas, resoluciones y lineamientos emitidos por la <strong>Superintendencia de las Instituciones del Sector Bancario (SUDEBAN)</strong> y demás autoridades competentes.</p>' +

                '<p style="margin: 6px 0; font-weight: bold;">En tal sentido, declaramos que:</p>' +

                '<ol style="padding-left: 20px; margin: 5px 0;">' +
                '<li style="margin-bottom: 4px;"><strong>Cumplimiento legal y regulatorio:</strong> La empresa cumple estrictamente con las leyes, reglamentos y disposiciones aplicables en materia de prevención y control de legitimación de capitales y financiamiento al terrorismo.</li>' +
                '<li style="margin-bottom: 4px;"><strong>Políticas y controles internos:</strong> Contamos con políticas, normas y procedimientos internos orientados a prevenir, detectar y gestionar riesgos asociados a actividades ilícitas, incluyendo mecanismos de control adecuados.</li>' +
                '<li style="margin-bottom: 4px;"><strong>Debida diligencia (Conozca a su cliente):</strong> Aplicamos procesos de identificación, verificación y conocimiento de nuestros clientes, proveedores y aliados comerciales, con el fin de mitigar riesgos y garantizar la transparencia de las relaciones comerciales.</li>' +
                '<li style="margin-bottom: 4px;"><strong>Monitoreo de operaciones:</strong> Realizamos seguimiento a las operaciones efectuadas, a fin de identificar transacciones inusuales o sospechosas que puedan estar vinculadas con actividades ilícitas.</li>' +
                '<li style="margin-bottom: 4px;"><strong>Capacitación del personal:</strong> Promovemos la formación continua de nuestro personal en materia de prevención de legitimación de capitales y financiamiento al terrorismo.</li>' +
                '<li style="margin-bottom: 4px;"><strong>Reporte de actividades sospechosas:</strong> Nos comprometemos a reportar de manera oportuna ante las autoridades competentes cualquier actividad sospechosa, conforme a lo establecido en la normativa vigente.</li>' +
                '<li style="margin-bottom: 4px;"><strong>Tolerancia cero:</strong> Mantenemos una política de cero tolerancia frente a cualquier actividad ilícita relacionada con legitimación de capitales, financiamiento al terrorismo o delitos conexos.</li>' +
                '</ol>' +

                '<p style="margin: 8px 0; text-align: justify;">La presente declaración reafirma nuestro compromiso con la ética, la transparencia y el cumplimiento de la normativa legal vigente en la República Bolivariana de Venezuela.</p>' +

                '<div style="margin-top: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px;">' +
                '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">' +
                '<div><strong>Lugar y fecha:</strong> _________________________</div>' +
                '<div><strong>Nombre de la Empresa:</strong> ' + nombreEmpresa + '</div>' +
                '<div><strong>RIF:</strong> ' + rifEmpresa + '</div>' +
                '<div><strong>Nombre del Representante Legal:</strong> _________________________</div>' +
                '<div><strong>Cédula de Identidad:</strong> _________________________</div>' +
                '<div><strong>Firma:</strong> _________________________</div>' +
                '<div><strong>Sello de la Empresa:</strong> _________________________</div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>';

            document.getElementById('reporte-oc-content').innerHTML = html;
            document.getElementById('btn-imprimir-oc')?.addEventListener('click', function () {
                var ventana = window.open('', '_blank');
                ventana.document.write('<!DOCTYPE html><html><head><title>Orden de Compra ' + s.codigo_oc + '</title><meta charset="UTF-8"><style>body{margin:0;padding:15px;font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse}th,td{padding:5px;border:1px solid #ddd;text-align:left}</style></head><body>' + html + '<script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}<\/script></body></html>');
                ventana.document.close();
            });
            modalInstances['modal-reporte-oc']?.show();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    function numeroALetras(numero) {
        const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
        const decenas = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
        const centenas = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
        if (numero === 0) return 'cero';
        let entero = Math.floor(numero);
        let decimales = Math.round((numero - entero) * 100);
        let partes = [];
        if (entero >= 1000) {
            let miles = Math.floor(entero / 1000);
            partes.push(centenas[Math.floor(miles / 100)] || '');
            if (miles % 100 !== 0) partes.push(decenas[Math.floor((miles % 100) / 10)] || '');
            partes.push(unidades[miles % 10] || '');
            partes.push('mil');
            entero = entero % 1000;
        }
        if (entero >= 100) { partes.push(centenas[Math.floor(entero / 100)]); entero = entero % 100; }
        if (entero >= 20) { partes.push(decenas[Math.floor(entero / 10)]); entero = entero % 10; }
        if (entero >= 10) {
            const especiales = { 10: 'diez', 11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince', 16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve' };
            partes.push(especiales[entero]);
            entero = 0;
        }
        if (entero > 0) partes.push(unidades[entero]);
        let resultado = partes.filter(p => p).join(' ');
        if (decimales > 0) resultado += ` con ${decimales}/100`;
        return resultado.toUpperCase();
    }

    // ========== PROVEEDORES ==========
    async function cargarProveedoresSelect(selectId, tipo) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = '<option value="">Cargando...</option>';
        select.disabled = true;
        try {
            let url = './api/proveedores.php?action=listar&activo=1';
            if (tipo && tipo !== 'todos') url += `&tipo=${tipo}`;
            const res = await fetch(url);
            const data = await res.json();
            select.innerHTML = '<option value="">Seleccionar proveedor...</option>';
            if (data.success && data.proveedores?.length) {
                data.proveedores.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = `${p.nombre} (${p.ci_rif})${p.cuenta_bancaria ? ` - Cuenta: ${p.cuenta_bancaria}` : ''}`;
                    select.appendChild(opt);
                });
            } else {
                select.innerHTML = '<option value="">No hay proveedores disponibles</option>';
            }
        } catch (error) {
            select.innerHTML = '<option value="">Error al cargar proveedores</option>';
        } finally {
            select.disabled = false;
        }
    }

    function mostrarModalProveedores() {
        cargarListaProveedores();
        modalInstances['modal-proveedores']?.show();
    }

    async function cargarListaProveedores() {
        const tbody = document.getElementById('tabla-proveedores-body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando...</td></tr>';
        try {
            const res = await fetch('./api/proveedores.php?action=listar&activo=1');
            const data = await res.json();
            if (data.success && data.proveedores?.length) {
                let html = '';
                data.proveedores.forEach(p => {
                    html += `<tr><td><code>${p.id}</code></td><td>${p.nombre}</td><td>${p.ci_rif}</td><td>${p.cuenta_bancaria}</td><td>${p.telefono || '-'}</td><td><button class="btn btn-sm btn-warning btn-editar-proveedor" data-id="${p.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-eliminar-proveedor" data-id="${p.id}"><i class="fas fa-trash"></i></button></td></tr>`;
                });
                tbody.innerHTML = html;
                document.querySelectorAll('.btn-editar-proveedor').forEach(btn => btn.addEventListener('click', () => editarProveedor(btn.dataset.id)));
                document.querySelectorAll('.btn-eliminar-proveedor').forEach(btn => btn.addEventListener('click', () => eliminarProveedor(btn.dataset.id)));
            } else {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay proveedores</td></tr>';
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error</td></tr>';
        }
    }

    // Variable para saber si estamos editando (opcional, también podemos usar el valor del campo id)
    let modoEdicionProveedor = false;

    function mostrarModalNuevoProveedor() {
        modoEdicionProveedor = false;
        const idInput = document.getElementById('proveedor-id');
        idInput.value = '';
        idInput.removeAttribute('readonly');   // Habilitar edición
        idInput.style.backgroundColor = '#fff';
        document.getElementById('proveedor-nombre').value = '';
        document.getElementById('proveedor-ci-rif').value = '';
        document.getElementById('proveedor-cuenta').value = '';
        document.getElementById('proveedor-telefono').value = '';
        document.getElementById('proveedor-email').value = '';
        document.getElementById('proveedor-direccion').value = '';
        document.getElementById('proveedor-tipo').value = 'ambos';
        document.getElementById('modal-proveedor-title').textContent = 'Nuevo Proveedor';
        const modal = new bootstrap.Modal(document.getElementById('modal-form-proveedor'));
        modal.show();
    }

    async function editarProveedor(id) {
        modoEdicionProveedor = true;
        try {
            const res = await fetch(`./api/proveedores.php?action=obtener&id=${id}`);
            const data = await res.json();
            if (data.success) {
                const p = data.proveedor;
                const idInput = document.getElementById('proveedor-id');
                idInput.value = p.id;
                idInput.setAttribute('readonly', true);   // Bloquear edición
                idInput.style.backgroundColor = '#e9ecef'; // Fondo gris claro
                document.getElementById('proveedor-nombre').value = p.nombre;
                document.getElementById('proveedor-ci-rif').value = p.ci_rif;
                document.getElementById('proveedor-cuenta').value = p.cuenta_bancaria;
                document.getElementById('proveedor-telefono').value = p.telefono || '';
                document.getElementById('proveedor-email').value = p.email || '';
                document.getElementById('proveedor-direccion').value = p.direccion || '';
                document.getElementById('proveedor-tipo').value = p.tipo_proveedor;
                document.getElementById('modal-proveedor-title').textContent = 'Editar Proveedor';

                modalInstances['modal-proveedores']?.hide();
                const modal = new bootstrap.Modal(document.getElementById('modal-form-proveedor'));
                modal.show();
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el proveedor' });
        }
    }

    async function guardarProveedor() {
        const id = document.getElementById('proveedor-id').value;
        const nombre = document.getElementById('proveedor-nombre').value;
        const ciRif = document.getElementById('proveedor-ci-rif').value;
        const cuenta = document.getElementById('proveedor-cuenta').value;
        const telefono = document.getElementById('proveedor-telefono').value;
        const email = document.getElementById('proveedor-email').value;
        const direccion = document.getElementById('proveedor-direccion').value;
        const tipo = document.getElementById('proveedor-tipo').value;

        if (!id || !nombre || !ciRif || !cuenta) {
            Swal.fire({ icon: 'warning', title: 'Campos obligatorios', text: 'ID, Nombre, RIF/CI y Cuenta Bancaria son obligatorios' });
            return;
        }

        // Determinar si es creación o actualización
        const esEdicion = modoEdicionProveedor === true;
        const action = esEdicion ? 'actualizar' : 'crear';

        const data = {
            action: action,
            id: id,
            nombre: nombre,
            ci_rif: ciRif,
            cuenta_bancaria: cuenta,
            telefono: telefono,
            email: email,
            direccion: direccion,
            tipo_proveedor: tipo,
            activo: 1
        };

        try {
            const url = './api/proveedores.php';
            const options = {
                method: esEdicion ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            };
            const res = await fetch(url, options);
            const result = await res.json();
            if (result.success) {
                Swal.fire({ icon: 'success', title: esEdicion ? 'Proveedor actualizado' : 'Proveedor guardado', timer: 1500 });
                cerrarModal('modal-form-proveedor');
                cargarListaProveedores();
                modoEdicionProveedor = false;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    async function eliminarProveedor(id) {
        Swal.fire({ title: 'Eliminar proveedor', text: '¿Está seguro?', icon: 'warning', showCancelButton: true }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch('./api/proveedores.php', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'eliminar' }) });
                    const data = await res.json();
                    if (data.success) {
                        Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500 });
                        cargarListaProveedores();
                    } else throw new Error(data.message);
                } catch (error) {
                    Swal.fire({ icon: 'error', title: 'Error', text: error.message });
                }
            }
        });
    }

    function cerrarModalProveedor() {
        document.querySelector('#modal-form-proveedor .btn-close')?.click();
    }

    // ========== COTIZACIONES ==========
    function mostrarModalAgregarCotizacion(solicitudId) {
        document.getElementById('cotizacion-solicitud-id').value = solicitudId;
        document.getElementById('cotizacion-proveedor').value = '';
        document.getElementById('cotizacion-monto').value = '';
        document.getElementById('cotizacion-fecha').value = new Date().toISOString().split('T')[0];
        document.getElementById('cotizacion-observaciones').value = '';
        cargarProveedoresSelect('cotizacion-proveedor', 'bienes');
        modalInstances['modal-cotizaciones']?.show();
    }

    async function guardarCotizacion() {
        const data = {
            action: 'crear',
            solicitud_id: document.getElementById('cotizacion-solicitud-id').value,
            proveedor_id: document.getElementById('cotizacion-proveedor').value,
            monto_cotizado: parseFloat(document.getElementById('cotizacion-monto').value),
            fecha_cotizacion: document.getElementById('cotizacion-fecha').value,
            observaciones: document.getElementById('cotizacion-observaciones').value
        };
        if (!data.proveedor_id || !data.monto_cotizado) return Swal.fire({ icon: 'warning', title: 'Campos incompletos' });
        try {
            const res = await fetch('./api/cotizaciones.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await res.json();
            if (result.success) {
                modalInstances['modal-cotizaciones']?.hide();
                Swal.fire({ icon: 'success', title: 'Cotización agregada', timer: 1500 });
                const solicitudId = document.getElementById('aprobar-solicitud-id')?.value;
                if (solicitudId) cargarCotizaciones(solicitudId);
            } else throw new Error(result.message);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    async function seleccionarGanadorCotizacion(cotizacionId) {
        const solicitudId = document.getElementById('aprobar-solicitud-id')?.value;
        Swal.fire({ title: 'Seleccionar proveedor ganador', text: '¿Está seguro?', icon: 'question', showCancelButton: true }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch('./api/cotizaciones.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'seleccionar_ganador', cotizacion_id: cotizacionId, solicitud_id: solicitudId }) });
                    const data = await res.json();
                    if (data.success) {
                        Swal.fire({ icon: 'success', title: 'Proveedor seleccionado', timer: 1500 });
                        cargarCotizaciones(solicitudId);
                        document.getElementById('cotizacion-ganadora-id').value = cotizacionId;
                    } else throw new Error(data.message);
                } catch (error) {
                    Swal.fire({ icon: 'error', title: 'Error', text: error.message });
                }
            }
        });
    }

    // ========== FUNCIONES AUXILIARES ==========
    async function generarCodigoPreview(proyectoId) {
        proyectoId = proyectoId || null;
        try {
            var url = './api/solicitudes_compras.php?action=generar_codigo';
            if (proyectoId) {
                url += '&proyecto_id=' + proyectoId;
            }
            var res = await fetch(url);
            var data = await res.json();
            var codigoSpan = document.getElementById('codigo-preview');
            if (codigoSpan) {
                if (proyectoId) {
                    codigoSpan.innerHTML = '<code class="text-primary">' + data.codigo + '</code><br><small>Formato: CMP-CGE-SOL-PROY_ID-AÑO-XXXXXX (6 dígitos por proyecto)</small>';
                } else {
                    codigoSpan.innerHTML = '<code class="text-primary">' + data.codigo + '</code><br><small>Formato: CMP-CGE-SOL-AÑO-XXXXXX (6 dígitos)</small>';
                }
            }
            document.getElementById('codigo-generado').value = data.codigo;
        } catch (error) {
            var codigoSpan = document.getElementById('codigo-preview');
            if (codigoSpan) {
                codigoSpan.innerHTML = '<code class="text-muted">CMP-CGE-SOL-' + new Date().getFullYear() + '-XXXXXX</code>';
            }
        }
    }

    async function cargarProyectos(seleccionarId = null) {
        const select = document.getElementById('solicitud-proyecto');
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
                select.addEventListener('change', () => cargarPartidas(select.value));
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
        const select = document.getElementById('solicitud-partida');
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

// ========== FUNCIÓN CARGAR BANCOS - CORREGIDA ==========
async function cargarBancos() {
    const select = document.getElementById('pago-banco-id');
    if (!select) {
        console.error('❌ Select de bancos no encontrado');
        return;
    }
    
    console.log('🏦 Cargando bancos...');
    select.innerHTML = '<option value="">Cargando bancos...</option>';
    select.disabled = true;
    
    try {
        const url = './api/bancos.php?action=listar';
        console.log('📡 URL bancos:', url);
        
        const response = await fetch(url);
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📡 Datos bancos:', data);
        
        select.innerHTML = '<option value="">Seleccionar banco...</option>';
        
        // ✅ CORRECCIÓN: La clave es "cuentas", no "bancos"
        if (data.success && data.cuentas && data.cuentas.length > 0) {
            console.log(`✅ Encontrados ${data.cuentas.length} bancos`);
            
            data.cuentas.forEach(banco => {
                // Verificar si el banco está activo
                const estaActivo = banco.activo === 1 || banco.activo === true || banco.activo === '1';
                
                if (estaActivo) {
                    const option = document.createElement('option');
                    option.value = banco.id;
                    const cuentaInfo = banco.numero_cuenta ? ` - ${banco.numero_cuenta}` : '';
                    const monedaInfo = banco.moneda ? ` (${banco.moneda})` : '';
                    option.textContent = `${banco.nombre}${cuentaInfo}${monedaInfo}`;
                    select.appendChild(option);
                    console.log(`✅ Banco agregado: ${option.textContent}`);
                } else {
                    console.log(`⚠️ Banco inactivo: ${banco.nombre}`);
                }
            });
            
            // Verificar si hay opciones después de filtrar
            if (select.options.length <= 1) {
                select.innerHTML = '<option value="">No hay bancos activos</option>';
                console.warn('⚠️ No hay bancos activos disponibles');
            }
        } else if (data.success && data.cuentas && data.cuentas.length === 0) {
            select.innerHTML = '<option value="">No hay bancos disponibles</option>';
            console.warn('⚠️ No se encontraron bancos');
        } else {
            // Si data es un array directamente
            if (Array.isArray(data)) {
                console.log('📡 Datos son un array directo:', data);
                select.innerHTML = '<option value="">Seleccionar banco...</option>';
                
                data.forEach(banco => {
                    const option = document.createElement('option');
                    option.value = banco.id;
                    option.textContent = banco.nombre || 'Banco sin nombre';
                    select.appendChild(option);
                });
            } else {
                throw new Error(data.error || 'Estructura de datos no reconocida');
            }
        }
    } catch (error) {
        console.error('❌ Error cargando bancos:', error);
        select.innerHTML = '<option value="">Error al cargar bancos</option>';
        
        Swal.fire({
            icon: 'warning',
            title: 'Bancos no disponibles',
            text: 'No se pudieron cargar los bancos. Error: ' + error.message,
            confirmButtonText: 'Entendido'
        });
    } finally {
        select.disabled = false;
        console.log('🏦 Carga de bancos finalizada');
    }
}

    function agregarItem() {
        const container = document.getElementById('items-container');
        if (!container) return;
        const tipo = document.getElementById('solicitud-tipo')?.value || 'compra';
        const opciones = getOpcionesUnidad(tipo);
        let optionsHtml = '';
        opciones.forEach(opt => optionsHtml += `<option value="${opt.value}">${opt.text}</option>`);
        const html = `<div class="item-row"><div class="row g-2"><div class="col-md-5"><input type="text" class="form-control form-control-sm item-descripcion" placeholder="Descripción" required></div><div class="col-md-2"><input type="number" class="form-control form-control-sm item-cantidad" placeholder="Cant." min="1" value="1" onchange="solicitudesModales.calcularTotal()"></div><div class="col-md-2"><select class="form-control form-control-sm item-unidad">${optionsHtml}</select></div><div class="col-md-2"><div class="input-group input-group-sm"><span class="input-group-text">$</span><input type="number" class="form-control item-precio" placeholder="Precio" step="0.01" onchange="solicitudesModales.calcularTotal()"></div></div><div class="col-md-1"><button type="button" class="btn btn-sm btn-danger" onclick="solicitudesModales.eliminarItem(this)"><i class="fas fa-times"></i></button></div></div></div>`;
        container.insertAdjacentHTML('beforeend', html);
    }

    function eliminarItem(btn) {
        btn.closest('.item-row')?.remove();
        calcularTotal();
    }

    function calcularTotal() {
        let total = 0;
        document.querySelectorAll('.item-row').forEach(row => {
            const cantidad = parseFloat(row.querySelector('.item-cantidad')?.value) || 0;
            const precio = parseFloat(row.querySelector('.item-precio')?.value) || 0;
            total += cantidad * precio;
        });
        document.getElementById('total-estimado').textContent = `$${total.toFixed(2)}`;
        document.getElementById('solicitud-monto-total').value = total;
        actualizarAvisoCotizacion();
    }

    async function guardarSolicitud() {
        const form = document.getElementById('form-nueva-solicitud');
        if (!form.checkValidity()) return form.reportValidity();
        const items = [];
        document.querySelectorAll('.item-row').forEach(row => {
            const desc = row.querySelector('.item-descripcion')?.value;
            const cant = row.querySelector('.item-cantidad')?.value;
            const unidad = row.querySelector('.item-unidad')?.value;
            const precio = row.querySelector('.item-precio')?.value;
            if (desc && cant && precio) {
                items.push({ descripcion_item: desc, cantidad: parseInt(cant), unidad_medida: unidad, precio_unitario_estimado: parseFloat(precio) });
            }
        });
        if (!items.length) return Swal.fire({ icon: 'warning', title: 'Items requeridos' });
        const tipo = document.getElementById('solicitud-tipo').value;
        if (tipo === 'servicio' && items.length > 1) return Swal.fire({ icon: 'warning', title: 'Servicio', text: 'Para servicios, debe agregar un solo item' });
        const data = {
            action: 'crear',
            tipo_solicitud: tipo,
            proyecto_id: document.getElementById('solicitud-proyecto').value,
            partida_id: document.getElementById('solicitud-partida').value || null,
            fecha_requerida: document.getElementById('solicitud-fecha-requerida').value,
            prioridad: document.getElementById('solicitud-prioridad').value,
            descripcion: document.getElementById('solicitud-descripcion').value,
            justificacion: document.getElementById('solicitud-justificacion').value,
            monto_estimado: parseFloat(document.getElementById('solicitud-monto-total').value),
            moneda: 'USD',
            items: items
        };
        if (!data.proyecto_id) return Swal.fire({ icon: 'warning', title: 'Proyecto requerido' });
        try {
            const res = await fetch('./api/solicitudes_compras.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await res.json();
            if (result.success) {
                modalInstances['modal-nueva-solicitud']?.hide();
                Swal.fire({ icon: 'success', title: 'Solicitud creada', timer: 3000 });
                if (window.solicitudesCompras) window.solicitudesCompras.cargarSolicitudes();
            } else throw new Error(result.message);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    async function verComprobanteModal(pagoId) {
        if (!pagoId || isNaN(pagoId)) return Swal.fire({ icon: 'error', title: 'Error', text: 'ID de pago no válido' });
        Swal.fire({ title: 'Cargando comprobante...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const res = await fetch(`./api/obtener_comprobante.php?id=${pagoId}`);
            const data = await res.json();
            Swal.close();
            if (data.success && data.comprobante) {
                const img = document.getElementById('comprobante-imagen');
                img.src = `data:${data.tipo};base64,${data.comprobante}`;
                img.style.display = 'block';
                new bootstrap.Modal(document.getElementById('modal-ver-comprobante')).show();
            } else throw new Error(data.message);
        } catch (error) {
            Swal.close();
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== API PÚBLICA ==========
    return {
        inicializarModales: inicializarModales,
        mostrarNuevaSolicitud: mostrarNuevaSolicitud,
        verDetalles: verDetalles,
        mostrarAprobacion: mostrarAprobacion,
        mostrarPago: mostrarPago,
        mostrarCierre: mostrarCierre,
        mostrarReporteOC: mostrarReporteOC,
        mostrarModalProveedores: mostrarModalProveedores,
        mostrarModalNuevoProveedor: mostrarModalNuevoProveedor,
        guardarProveedor: guardarProveedor,
        editarProveedor: editarProveedor,
        eliminarProveedor: eliminarProveedor,
        cargarListaProveedores: cargarListaProveedores,
        mostrarModalAgregarCotizacion: mostrarModalAgregarCotizacion,
        guardarCotizacion: guardarCotizacion,
        verComprobanteModal: verComprobanteModal,
        recargarDetalles: recargarDetalles,
        actualizarSubtotalItem: actualizarSubtotalItem,
        recalcularTotalAprobacion: recalcularTotalAprobacion,
        obtenerItemsModificados: obtenerItemsModificados,
        cargarItemsAprobacion: cargarItemsAprobacion,
        agregarItem: agregarItem,
        eliminarItem: eliminarItem,
        calcularTotal: calcularTotal,
        confirmarAprobacion: confirmarAprobacion,
        cargarProveedoresSelect: cargarProveedoresSelect,
        cargarCotizaciones: cargarCotizaciones,
        formatearFechaLocal: formatearFechaLocal,
        escapeHtml: escapeHtml,
        getOpcionesUnidad: getOpcionesUnidad,
        actualizarUnidadesPorTipo: actualizarUnidadesPorTipo,
        onTipoSolicitudChange: onTipoSolicitudChange
    };
})(); // Fin de la IIFE

// Asignar al objeto window
window.solicitudesModales = solicitudesModales;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    if (window.solicitudesModales && typeof window.solicitudesModales.inicializarModales === 'function') {
        window.solicitudesModales.inicializarModales();
        console.log('✅ solicitudesModales inicializado con soporte para IVA');
    }
});
