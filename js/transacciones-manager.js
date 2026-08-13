// transacciones-manager.js - Gestión de transacciones (SOLO EGRESOS a partidas)
class TransaccionesManager {
    constructor(controlFlujo) {
        this.cf = controlFlujo;
    }

    // ============================================
    // REGISTRAR EGRESO (con impresión de recibo opcional)
    // ============================================
    async registrarEgreso() {
        try {
            if (!this.cf.proyectoActual) {
                throw new Error('No hay proyecto seleccionado');
            }

            const partidaSelect = document.getElementById('partida_egreso');
            const bancoSelect = document.getElementById('banco_egreso');
            const montoInput = document.getElementById('monto_egreso');
            const descripcionInput = document.getElementById('descripcion_egreso');
            const beneficiarioInput = document.getElementById('beneficiario_egreso');
            const fechaInput = document.getElementById('fecha_egreso');
            const referenciaInput = document.getElementById('referencia_egreso');
            const metodoPagoSelect = document.getElementById('metodo_pago');
            const monedaSelect = document.getElementById('moneda_egreso');
            const tasaCambioInput = document.getElementById('tasa_cambio_egreso');

            const partidaId = partidaSelect ? partidaSelect.value : null;
            const bancoId = bancoSelect ? bancoSelect.value : null;
            const montoUSD = montoInput ? this.parsearMonto(montoInput.value) : 0;
            const descripcion = descripcionInput ? descripcionInput.value.trim() : '';
            const beneficiario = beneficiarioInput ? beneficiarioInput.value.trim() : '';
            const fecha = fechaInput ? fechaInput.value : new Date().toISOString().split('T')[0];
            const referencia = referenciaInput ? referenciaInput.value.trim() : '';
            const metodoPago = metodoPagoSelect ? metodoPagoSelect.value : 'Transferencia';
            const monedaPago = monedaSelect ? monedaSelect.value : 'USD';

            let tasaCambio = 1.00;
            if (tasaCambioInput && tasaCambioInput.value) {
                tasaCambio = this.parsearMonto(tasaCambioInput.value);
            }
            if (isNaN(tasaCambio) || tasaCambio <= 0) tasaCambio = 1.00;

            let montoGuardar = montoUSD;
            let monedaGuardar = monedaPago;

            // Validaciones
            if (!partidaId || partidaId === '' || partidaId === '0' || partidaId === 'null') {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Partida no seleccionada',
                    text: 'Por favor, seleccione una partida válida de la lista.'
                });
                throw new Error('Seleccione una partida válida');
            }

            if (!bancoId || bancoId === '' || bancoId === '0' || bancoId === 'null') {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Cuenta bancaria no seleccionada',
                    text: 'Por favor, seleccione una cuenta bancaria.'
                });
                throw new Error('Seleccione una cuenta bancaria');
            }

            if (montoUSD <= 0 || isNaN(montoUSD)) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Monto inválido',
                    text: 'El monto en dólares debe ser mayor a 0.'
                });
                throw new Error('Monto debe ser mayor a 0');
            }

            if (!beneficiario) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Beneficiario requerido',
                    text: 'Por favor, ingrese el nombre del beneficiario.'
                });
                throw new Error('Beneficiario es requerido');
            }

            if (!referencia) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Referencia requerida',
                    text: 'Por favor, ingrese el número de factura o referencia.'
                });
                throw new Error('Referencia es requerida');
            }

            // Verificar disponibilidad de la partida
            if (partidaSelect) {
                const selectedOption = partidaSelect.options[partidaSelect.selectedIndex];
                if (!selectedOption) {
                    throw new Error('No se encontró la partida seleccionada');
                }

                const disponibleStr = selectedOption.getAttribute('data-disponible') || '0';
                const disponible = this.parsearMonto(disponibleStr);
                const tipoPartida = selectedOption.getAttribute('data-tipo') || '';
                const nombrePartida = selectedOption.text;

                if (tipoPartida === 'Principal') {
                    await Swal.fire({
                        icon: 'error',
                        title: 'Partida incorrecta',
                        html: `No puede registrar egresos en partidas principales.<br><br>
                               <strong>Partida seleccionada:</strong> ${nombrePartida}<br>
                               Seleccione una subpartida.`
                    });
                    throw new Error('Solo se pueden registrar egresos en partidas secundarias');
                }

                if (montoUSD > disponible) {
                    await Swal.fire({
                        icon: 'error',
                        title: 'Fondos insuficientes',
                        html: `Monto USD: $${montoUSD.toLocaleString()} | Disponible: $${disponible.toLocaleString()}`
                    });
                    throw new Error('Fondos insuficientes');
                }

                let mensajeConfirmacion = `
                    <div class="text-left">
                        <p><strong>Partida:</strong> ${nombrePartida}</p>
                        <p><strong>Monto en USD:</strong> $${montoUSD.toLocaleString()}</p>
                        <p><strong>Moneda de Pago:</strong> ${monedaGuardar}</p>`;

                if (monedaPago === 'BS') {
                    mensajeConfirmacion += `<p><strong>Tasa Cambio:</strong> Bs ${tasaCambio.toLocaleString()} por USD</p>
                                            <p><strong>Monto a pagar en Bs:</strong> Bs ${montoGuardar.toLocaleString()}</p>`;
                } else {
                    mensajeConfirmacion += `<p><strong>Tasa Cambio:</strong> 1.00 (USD a USD)</p>`;
                }

                mensajeConfirmacion += `
                        <p><strong>Beneficiario:</strong> ${beneficiario}</p>
                        <p><strong>Referencia:</strong> ${referencia}</p>
                        <p><strong>Disponible en partida:</strong> $${disponible.toLocaleString()}</p>
                        <p><strong>Disponible después:</strong> $${(disponible - montoUSD).toLocaleString()}</p>
                    </div>
                `;

                const confirmar = await Swal.fire({
                    title: '¿Registrar Egreso?',
                    html: mensajeConfirmacion,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, registrar',
                    cancelButtonText: 'Cancelar'
                });

                if (!confirmar.isConfirmed) return;
            }

            const submitBtn = document.getElementById('btn-registrar-egreso');
            const originalText = submitBtn?.innerHTML || 'Registrar';
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
                submitBtn.disabled = true;
            }

            const data = {
                proyecto_id: this.cf.proyectoActual.id,
                partida_id: partidaId,
                banco_id: bancoId,
                tipo: 'Egreso',
                monto: montoGuardar,
                moneda: monedaGuardar,
                tasa_cambio: tasaCambio,
                concepto: descripcion || 'Pago registrado',
                fecha_transaccion: fecha,
                numero_documento: referencia,
                beneficiario: beneficiario,
                descripcion: descripcion,
                metodo_pago: metodoPago
            };

            const response = await fetch('api/transacciones.php?action=crear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error('Error parseando respuesta:', responseText);
                throw new Error('Error en la respuesta del servidor');
            }

            if (submitBtn) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }

            if (!response.ok || !result.success) {
                throw new Error(result.error || result.message || 'Error al registrar egreso');
            }

            // Éxito
            this.cf.ui.mostrarExito('✅ Egreso registrado correctamente');

            // Obtener el ID de la transacción (devuelto por el backend)
            const transaccionId = result.id;
            console.log('✅ Transacción registrada con ID:', transaccionId);

            // Cerrar modal inmediatamente
            const modal = document.getElementById('modal-registrar-egreso');
            if (modal && window.bootstrap) {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            }

            // Limpiar backdrops
            setTimeout(() => {
                const backdrops = document.querySelectorAll('.modal-backdrop');
                backdrops.forEach(b => b.remove());
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
            }, 100);

            // Preguntar si desea imprimir el recibo
            if (transaccionId) {
                const { value: imprimir } = await Swal.fire({
                    title: '¿Desea imprimir el recibo?',
                    text: 'Puede imprimir o guardar el comprobante del egreso.',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, imprimir',
                    cancelButtonText: 'No, gracias'
                });
                if (imprimir) {
                    console.log('🖨️ Llamando a generarReciboTransaccion con ID:', transaccionId);
                    await this.generarReciboTransaccion(transaccionId);
                }
            } else {
                console.warn('⚠️ No se recibió ID de transacción para imprimir');
            }

            // Recargar datos en segundo plano
            this.recargarDatosDespuesDeTransaccion().catch(err => console.warn(err));

            // Preguntar si desea otro egreso
            await this.preguntarNuevoEgreso();

            // Limpiar formulario
            const form = document.getElementById('form-registrar-egreso');
            if (form) {
                form.reset();
                const fechaInputElem = document.getElementById('fecha_egreso');
                const monedaSelectElem = document.getElementById('moneda_egreso');
                const tasaInputElem = document.getElementById('tasa_cambio_egreso');
                if (fechaInputElem) fechaInputElem.value = new Date().toISOString().split('T')[0];
                if (monedaSelectElem) monedaSelectElem.value = 'USD';
                if (tasaInputElem) tasaInputElem.value = '36.50';
            }

        } catch (error) {
            console.error('❌ Error en registrarEgreso:', error);
            this.cf.ui.mostrarError(error.message);

            const submitBtn = document.getElementById('btn-registrar-egreso');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Registrar Egreso';
                submitBtn.disabled = false;
            }
        }
    }

    // ============================================
    // GENERAR RECIBO DE TRANSACCIÓN (VERSIÓN CORREGIDA CON MÁS LOGS)
    // ============================================
    async generarReciboTransaccion(transaccionId) {
        console.log('🔔 Entrando a generarReciboTransaccion con ID:', transaccionId);
        try {
            const response = await fetch(`api/transacciones.php?action=obtener&id=${transaccionId}&_=${Date.now()}`);
            const data = await response.json();

            if (!data.success || !data.transaccion) {
                console.error('❌ No se pudo obtener la transacción:', data);
                this.cf.ui.mostrarError('No se pudo obtener los datos de la transacción');
                return;
            }

            const trans = data.transaccion;
            console.log('📄 Transacción obtenida:', trans);

            // 1. Obtener código y nombre de la partida
            let partidaTexto = 'No especificada';
            const codigoPartida = trans.codigo_partida || '';
            const nombrePartida = trans.partida_nombre || '';

            if (codigoPartida && nombrePartida) {
                partidaTexto = `${codigoPartida} - ${nombrePartida}`;
                console.log(`✅ Partida con código: ${partidaTexto}`);
            } else if (nombrePartida) {
                partidaTexto = nombrePartida;
                console.log(`⚠️ Solo nombre: ${partidaTexto}`);
            } else if (codigoPartida) {
                partidaTexto = codigoPartida;
                console.log(`⚠️ Solo código: ${partidaTexto}`);
            } else {
                console.warn('No hay datos de partida en la transacción');
            }

            // 2. Obtener nombre del proyecto
            let proyectoNombre = 'No especificado';
            if (trans.proyecto_id) {
                try {
                    const proyRes = await fetch(`api/proyectos.php?action=obtener&id=${trans.proyecto_id}`);
                    const proyData = await proyRes.json();
                    if (proyData.success) proyectoNombre = proyData.proyecto.nombre;
                    console.log(`📌 Proyecto: ${proyectoNombre}`);
                } catch(e) { console.warn('Error obteniendo proyecto:', e); }
            }

            // 3. Formatear fecha y montos
            const fechaObj = new Date(trans.fecha_transaccion);
            const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

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
                            <strong>Partida:</strong> <span>${partidaTexto}</span>
                        </div>
                    </div>
                    <div style="text-align: center; border-top: 2px dashed #ccc; padding-top: 12px; margin-top: 10px; font-size: 10px; color: #6c757d;">
                        Este comprobante es generado automáticamente.<br>
                        Gracias por su confianza.
                    </div>
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button id="imprimir-recibo" class="btn btn-primary"><i class="fas fa-print"></i> Imprimir / Guardar PDF</button>
                </div>
            `;

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
    // PREGUNTAR SI DESEA OTRO EGRESO
    // ============================================
    async preguntarNuevoEgreso() {
        try {
            const result = await Swal.fire({
                title: '¿Desea realizar otro egreso?',
                text: 'El egreso se registró exitosamente.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, registrar otro egreso',
                cancelButtonText: 'No, ir a las partidas',
                confirmButtonColor: '#28a745',
                cancelButtonColor: '#6c757d',
                reverseButtons: true,
                focusCancel: true
            });

            if (result.isConfirmed) {
                setTimeout(() => {
                    this.cf.ui.mostrarModalRegistrarEgreso();
                }, 300);
            } else {
                setTimeout(() => {
                    if (this.cf.partidas && this.cf.partidas.cargarPartidas) {
                        this.cf.partidas.cargarPartidas();
                    }
                }, 300);
            }
        } catch (error) {
            console.error('Error en preguntarNuevoEgreso:', error);
        }
    }

    // ============================================
    // RECARGAR DATOS DESPUÉS DE UNA TRANSACCIÓN
    // ============================================
    async recargarDatosDespuesDeTransaccion() {
        try {
            const promises = [];
            if (this.cf.proyectos && this.cf.proyectos.cargarResumenFinanciero) {
                promises.push(this.cf.proyectos.cargarResumenFinanciero());
            }
            if (this.cf.cuentas && this.cf.cuentas.cargarResumenCuentas) {
                promises.push(this.cf.cuentas.cargarResumenCuentas());
            }
            if (this.cf.partidas && this.cf.partidas.cargarPartidas) {
                promises.push(this.cf.partidas.cargarPartidas(true)); // forzar refresh
            }
            if (this.cf.graficos && this.cf.graficos.cargarGraficos) {
                promises.push(this.cf.graficos.cargarGraficos());
            }
            await Promise.allSettled(promises);
        } catch (error) {
            console.error('Error recargando datos:', error);
        }
    }

    // ============================================
    // PARSEAR MONTO (auxiliar)
    // ============================================
    parsearMonto(montoStr) {
        if (!montoStr && montoStr !== 0 && montoStr !== '0') return 0;
        const str = montoStr.toString();
        const cleanStr = str.replace(/[^0-9.,-]/g, '');
        let numericStr = cleanStr;
        if (cleanStr.includes(',') && cleanStr.includes('.')) {
            const lastComma = cleanStr.lastIndexOf(',');
            const lastDot = cleanStr.lastIndexOf('.');
            if (lastComma > lastDot) {
                numericStr = cleanStr.replace(/\./g, '').replace(',', '.');
            } else {
                numericStr = cleanStr.replace(/,/g, '');
            }
        } else if (cleanStr.includes(',')) {
            numericStr = cleanStr.replace(',', '.');
        }
        const result = parseFloat(numericStr);
        return isNaN(result) ? 0 : result;
    }

    // ============================================
    // ACTUALIZAR INFO DISPONIBILIDAD PARTIDA
    // ============================================
    actualizarInfoDisponibilidadPartida() {
        const partidaSelect = document.getElementById('partida_egreso');
        const montoInput = document.getElementById('monto_egreso');
        const infoDiv = document.getElementById('disponibilidad-partida');
        const infoTipoDiv = document.getElementById('info-tipo-partida');
        if (!partidaSelect || !montoInput || !infoDiv) return;
        const selectedOption = partidaSelect.options[partidaSelect.selectedIndex];
        if (!selectedOption || selectedOption.value === '' || selectedOption.value === '0') {
            infoDiv.innerHTML = '<span class="text-warning"><i class="fas fa-exclamation-circle"></i> Seleccione una partida</span>';
            if (infoTipoDiv) infoTipoDiv.style.display = 'none';
            return;
        }
        const disponibleStr = selectedOption.getAttribute('data-disponible') || '0';
        let tipoPartida = selectedOption.getAttribute('data-tipo') || '';
        if (!tipoPartida) {
            const optionText = selectedOption.text.toLowerCase();
            if (optionText.includes('principal') || selectedOption.getAttribute('data-es-principal')) {
                tipoPartida = 'Principal';
            } else {
                tipoPartida = 'Secundaria';
            }
        }
        const disponible = this.parsearMonto(disponibleStr);
        const monto = this.parsearMonto(montoInput.value);
        if (infoTipoDiv) {
            if (tipoPartida === 'Principal') {
                infoTipoDiv.style.display = 'block';
                infoTipoDiv.innerHTML = '<span class="text-danger"><i class="fas fa-exclamation-triangle"></i> Esta es una partida principal. Debe seleccionar una subpartida para registrar egresos.</span>';
            } else {
                infoTipoDiv.style.display = 'none';
            }
        }
        let mensaje = '';
        let colorClass = 'text-muted';
        if (tipoPartida === 'Secundaria') {
            if (monto > 0) {
                if (monto > disponible) {
                    mensaje = `<span class="text-danger"><i class="fas fa-exclamation-triangle"></i> El monto excede lo disponible en $${(monto - disponible).toLocaleString()}</span>`;
                    colorClass = 'text-danger';
                } else {
                    const restante = disponible - monto;
                    mensaje = `<span class="text-success"><i class="fas fa-check-circle"></i> Disponible: $${disponible.toLocaleString()} | Restante después: $${restante.toLocaleString()}</span>`;
                    colorClass = 'text-success';
                }
            } else {
                mensaje = `<span class="text-info"><i class="fas fa-info-circle"></i> Disponible: $${disponible.toLocaleString()}</span>`;
                colorClass = 'text-info';
            }
        } else if (tipoPartida === 'Principal') {
            mensaje = `<span class="text-warning"><i class="fas fa-exclamation-circle"></i> Partida principal: Debe seleccionar una subpartida para registrar egresos</span>`;
            colorClass = 'text-warning';
        }
        infoDiv.innerHTML = mensaje;
        infoDiv.className = `form-text ${colorClass}`;
    }

    // ============================================
    // CONFIGURAR CAMBIO DE MONEDA EN MODAL EGRESO
    // ============================================
    configurarCambioMonedaEgreso() {
        const monedaSelect = document.getElementById('moneda_egreso');
        const tasaCambioContainer = document.getElementById('tasa-cambio-egreso-container');
        const tasaCambioInput = document.getElementById('tasa_cambio_egreso');
        const monedaSimbolo = document.getElementById('moneda_egreso_simbolo');
        if (!monedaSelect || !tasaCambioContainer) return;
        const actualizarTasaCambio = () => {
            const moneda = monedaSelect.value;
            if (monedaSimbolo) monedaSimbolo.textContent = moneda;
            if (moneda !== 'USD') {
                tasaCambioContainer.style.display = 'block';
                if (tasaCambioInput) {
                    if (moneda === 'BS' && !tasaCambioInput.value) tasaCambioInput.value = '36.50';
                    else if (moneda === 'EUR' && !tasaCambioInput.value) tasaCambioInput.value = '1.08';
                }
            } else {
                tasaCambioContainer.style.display = 'none';
                if (tasaCambioInput) tasaCambioInput.value = '1.0';
            }
        };
        monedaSelect.addEventListener('change', actualizarTasaCambio);
        actualizarTasaCambio();
    }
}