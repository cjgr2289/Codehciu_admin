// js/abonos-manager.js - Manejo específico de abonos de proyectos
class AbonosManager {
    constructor(controlFlujo) {
        this.cf = controlFlujo;
        this.initialize();
    }

    initialize() {
       // console.log('💰 AbonosManager inicializado');
        // Exponer métodos globalmente si es necesario
        window.guardarAbonoProyecto = this.guardarAbonoProyecto.bind(this);
    }

    async guardarAbonoProyecto() {
        try {
         //   console.log('=== INICIANDO REGISTRO DE ABONO ===');
            
            // Validar que haya proyecto seleccionado
            if (!this.cf.proyectoActual) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No hay proyecto seleccionado. Regrese al listado y seleccione un proyecto.'
                });
                return;
            }

            // Obtener elementos del DOM
            const proyectoIdElement = document.getElementById('ingreso_proyecto_id');
            const bancoSelect = document.getElementById('banco_ingreso');
            const montoInput = document.getElementById('monto_ingreso');
            const monedaSelect = document.getElementById('moneda_ingreso');
            const conceptoInput = document.getElementById('concepto_ingreso');
            const fechaInput = document.getElementById('fecha_ingreso');

            // Validar que los elementos existen
            if (!proyectoIdElement || !bancoSelect || !montoInput || !conceptoInput || !fechaInput) {
                console.error('Elementos del formulario no encontrados');
                Swal.fire({
                    icon: 'error',
                    title: 'Error del formulario',
                    text: 'Algunos campos del formulario no están disponibles.'
                });
                return;
            }

            // Obtener valores
            const proyectoId = proyectoIdElement.value;
            const bancoId = bancoSelect.value;
            const monto = parseFloat(montoInput.value);
            const moneda = monedaSelect ? monedaSelect.value : 'USD';
            const concepto = conceptoInput.value.trim();
            const fechaIngreso = fechaInput.value;
            
            // Valores opcionales
            const descripcion = document.getElementById('descripcion_ingreso')?.value.trim() || '';
            const referencia = document.getElementById('referencia_ingreso')?.value.trim() || '';
            const beneficiario = document.getElementById('beneficiario_ingreso')?.value.trim() || '';
            
            // Tasa de cambio
            const tasaCambioElement = document.getElementById('tasa_cambio_ingreso');
            let tasaCambio = 1.0;
            
            if (tasaCambioElement && tasaCambioElement.value) {
                tasaCambio = parseFloat(tasaCambioElement.value);
            } else if (moneda !== 'USD') {
                // Valores por defecto
                if (moneda === 'BS') {
                    tasaCambio = 36.50;
                    if (tasaCambioElement) tasaCambioElement.value = '36.50';
                } else if (moneda === 'EUR') {
                    tasaCambio = 0.92;
                    if (tasaCambioElement) tasaCambioElement.value = '0.92';
                }
            }

            // console.log('📋 Datos capturados:', {
            //     proyectoId,
            //     bancoId,
            //     monto,
            //     moneda,
            //     tasaCambio,
            //     concepto,
            //     fechaIngreso
            // });

            // Validaciones
            const validationErrors = this.validarDatosAbono({
                proyectoId, bancoId, monto, concepto, fechaIngreso,
                bancoSelect, montoInput, conceptoInput, fechaInput
            });
            
            if (validationErrors) {
                return; // La validación ya mostró el error
            }

            // Calcular monto en USD
            let montoUSD = monto;
            if (moneda === 'BS') {
                montoUSD = monto / tasaCambio;
            } else if (moneda === 'EUR') {
                montoUSD = monto * tasaCambio;
            }

            // Preparar datos
            const datos = {
                proyecto_id: parseInt(proyectoId),
                banco_id: parseInt(bancoId),
                tipo: 'Ingreso',
                monto: monto,
                moneda: moneda,
                tasa_cambio: tasaCambio,
                monto_usd: montoUSD,
                concepto: concepto,
                descripcion: descripcion,
                fecha_transaccion: fechaIngreso,
                numero_documento: referencia,
                beneficiario: beneficiario,
                metodo_pago: 'Transferencia'
            };

           // console.log('📤 Enviando datos de abono:', datos);

            // Enviar al servidor
            const resultado = await this.enviarAbonoAlServidor(datos);
            
            if (resultado.success) {
                await this.procesarExitoAbono();
            } else {
                this.procesarErrorAbono(resultado.error);
            }

        } catch (error) {
            console.error('💥 Error general en guardarAbonoProyecto:', error);
            this.mostrarErrorInesperado(error);
        }
    }

    validarDatosAbono(data) {
        const { proyectoId, bancoId, monto, concepto, fechaIngreso, bancoSelect, montoInput, conceptoInput, fechaInput } = data;

        if (!proyectoId || proyectoId === '') {
            Swal.fire({ icon: 'error', title: 'Proyecto no seleccionado', text: 'No hay proyecto seleccionado' });
            return true;
        }

        if (!bancoId || bancoId === '' || bancoId === '0') {
            Swal.fire({ icon: 'error', title: 'Cuenta bancaria no seleccionada', text: 'Por favor, seleccione una cuenta bancaria' });
            if (bancoSelect) bancoSelect.focus();
            return true;
        }

        if (isNaN(monto) || monto <= 0) {
            Swal.fire({ icon: 'error', title: 'Monto inválido', text: 'Ingrese un monto válido mayor a 0' });
            if (montoInput) montoInput.focus();
            return true;
        }

        if (!concepto) {
            Swal.fire({ icon: 'error', title: 'Concepto requerido', text: 'Ingrese un concepto para el abono' });
            if (conceptoInput) conceptoInput.focus();
            return true;
        }

        if (!fechaIngreso) {
            Swal.fire({ icon: 'error', title: 'Fecha requerida', text: 'Ingrese la fecha del abono' });
            if (fechaInput) fechaInput.focus();
            return true;
        }

        return false; // Sin errores
    }

    async enviarAbonoAlServidor(datos) {
        // Obtener botón y mostrar loading
        const btnGuardar = document.getElementById('btn-registrar-abono');
        const textoOriginal = btnGuardar.innerHTML;
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';

        // Configurar timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 15000);

        try {
           // console.log('🌐 Enviando solicitud a API...');
            
            const response = await fetch('api/abonos-proyecto.php?action=crear', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(datos),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            
           // console.log('✅ Respuesta recibida. Status:', response.status);
            
            const responseText = await response.text();
           // console.log('📄 Respuesta cruda:', responseText);
            
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Error parseando JSON:', parseError, responseText);
                throw new Error('Respuesta del servidor no es JSON válido');
            }
            
           // console.log('📊 Respuesta parseada:', result);

            // Restaurar botón
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = textoOriginal;

            return {
                success: result.success || false,
                data: result,
                error: result.error
            };

        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            // Restaurar botón
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = textoOriginal;
            
            console.error('❌ Error en fetch:', fetchError);
            
            return {
                success: false,
                error: this.interpretarErrorFetch(fetchError)
            };
        }
    }

    interpretarErrorFetch(error) {
        if (error.name === 'AbortError') {
            return {
                titulo: 'Timeout',
                mensaje: 'La solicitud tardó demasiado. Verifique su conexión a internet.'
            };
        } else if (error.name === 'TypeError') {
            if (error.message.includes('Failed to fetch') || 
                error.message.includes('establish connection')) {
                return {
                    titulo: 'Error de conexión',
                    mensaje: 'No se pudo establecer conexión. Verifique: 1) Extensión AdBlock está desactivada 2) Está en modo incógnito sin extensiones 3) El servidor está activo.'
                };
            }
        }
        
        return {
            titulo: 'Error de conexión',
            mensaje: error.message || 'Error al conectar con el servidor'
        };
    }

    async procesarExitoAbono() {
        // Mostrar éxito
        await Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: 'Abono registrado correctamente',
            timer: 2500,
            showConfirmButton: false,
            timerProgressBar: true
        });

        // Cerrar modal
        this.cerrarModalIngreso();

        // Limpiar formulario
        this.limpiarFormularioIngreso();

        // Recargar datos del proyecto
        this.recargarDatosProyecto();
    }

    procesarErrorAbono(errorInfo) {
        const { titulo, mensaje } = errorInfo;
        
        Swal.fire({
            icon: 'error',
            title: titulo,
            html: `
                <div class="text-left">
                    <strong>${mensaje}</strong>
                    <hr>
                    <small class="text-muted">
                        <p><i class="fas fa-lightbulb"></i> Soluciones:</p>
                        <ul>
                            <li>Desactive extensiones como AdBlock</li>
                            <li>Intente en modo incógnito (Ctrl+Shift+N)</li>
                            <li>Verifique su conexión a internet</li>
                            <li>Contacte al administrador</li>
                        </ul>
                    </small>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#d33',
            width: '500px'
        });
    }

    mostrarErrorInesperado(error) {
        // Restaurar botón si existe
        const btnGuardar = document.getElementById('btn-registrar-abono');
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="fas fa-check-circle"></i> Registrar Abono';
        }
        
        Swal.fire({
            icon: 'error',
            title: 'Error inesperado',
            text: 'Ocurrió un error inesperado: ' + error.message,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#d33'
        });
    }

    cerrarModalIngreso() {
        const modalElement = document.getElementById('modal-registrar-ingreso');
        if (modalElement && window.bootstrap) {
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            } else {
                const newModal = new bootstrap.Modal(modalElement);
                newModal.hide();
            }
        }
    }

    limpiarFormularioIngreso() {
        const form = document.getElementById('form-registrar-ingreso');
        if (form) {
            form.reset();
            
            // Restaurar fecha actual
            const fechaInput = document.getElementById('fecha_ingreso');
            if (fechaInput) {
                fechaInput.value = new Date().toISOString().split('T')[0];
            }
            
            // Restaurar moneda USD por defecto
            const monedaSelect = document.getElementById('moneda_ingreso');
            if (monedaSelect) {
                monedaSelect.value = 'USD';
            }
        }
    }

    recargarDatosProyecto() {
        if (!this.cf) return;
        
       // console.log('🔄 Recargando datos del proyecto...');
        
        // Pequeño delay para asegurar que el servidor procesó todo
        setTimeout(() => {
            if (this.cf.proyectos && this.cf.proyectos.cargarResumenFinanciero) {
                this.cf.proyectos.cargarResumenFinanciero();
            }
            
            if (this.cf.cuentas && this.cf.cuentas.cargarResumenCuentas) {
                this.cf.cuentas.cargarResumenCuentas();
            }
            
            // Actualizar gráficos si existen
            if (this.cf.graficos && this.cf.graficos.cargarGraficos) {
                this.cf.graficos.cargarGraficos();
            }
        }, 1000);
    }

    // Método para cargar cuentas bancarias en el modal de ingreso
    cargarCuentasBancariasIngreso() {
        if (this.cf.cuentas && this.cf.cuentas.cargarCuentasBancarias) {
            this.cf.cuentas.cargarCuentasBancarias('ingreso');
        }
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AbonosManager;
}