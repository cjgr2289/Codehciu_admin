// ui-manager.js - Gestión de la interfaz de usuario (Versión Corregida)
class UIManager {
    constructor(controlFlujo) {
        this.cf = controlFlujo;
        this.modalObservers = [];
        this.activeEventListeners = new Map();
    }

    // ============================================
    // LIMPIEZA DE BACKDROPS (NUEVO MÉTODO CENTRALIZADO)
    // ============================================
    limpiarBackdrops() {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }

    // ============================================
    // ABRIR MODAL DE FORMA SEGURA (NUEVO)
    // ============================================
    abrirModalSeguro(modalElement, callbackPrevio = null) {
        if (!modalElement) return;

        // Cerrar cualquier modal abierto previamente
        const modalesAbiertos = document.querySelectorAll('.modal.show');
        modalesAbiertos.forEach(modalAbierto => {
            const bsModal = bootstrap.Modal.getInstance(modalAbierto);
            if (bsModal) bsModal.hide();
            else modalAbierto.classList.remove('show');
            modalAbierto.style.display = 'none';
            modalAbierto.setAttribute('aria-hidden', 'true');
        });

        // Limpiar backdrops
        this.limpiarBackdrops();

        // Ejecutar callback de preparación si existe
        if (callbackPrevio && typeof callbackPrevio === 'function') {
            callbackPrevio();
        }

        // Remover clases residuales del modal
        modalElement.classList.remove('show');
        modalElement.style.display = 'none';
        modalElement.removeAttribute('aria-hidden');

        // Crear y mostrar nueva instancia
        const modal = new bootstrap.Modal(modalElement, { backdrop: true, keyboard: true, focus: true });
        modal.show();

        // Al cerrar, limpiar nuevamente
        modalElement.addEventListener('hidden.bs.modal', () => {
            this.limpiarBackdrops();
        }, { once: true });
    }

    configurarEventos() {
        this.limpiarEventListenersPrevios();

        // Eventos generales
        const btnCrearProyecto = document.getElementById('btn-crear-proyecto');
        if (btnCrearProyecto) {
            this.agregarEventListener(btnCrearProyecto, 'click', () => this.cf.proyectos.crearProyecto());
        }

        const btnCrearCuenta = document.getElementById('btn-crear-cuenta');
        if (btnCrearCuenta) {
            this.agregarEventListener(btnCrearCuenta, 'click', () => this.mostrarModalCrearCuenta());
        }

        const btnGuardarProyecto = document.getElementById('btn-guardar-proyecto');
        if (btnGuardarProyecto) {
            this.agregarEventListener(btnGuardarProyecto, 'click', (e) => {
                e.preventDefault();
                this.cf.proyectos.guardarProyecto();
            });
        }

        const btnGuardarCuenta = document.getElementById('btn-guardar-cuenta');
        if (btnGuardarCuenta) {
            this.agregarEventListener(btnGuardarCuenta, 'click', (e) => {
                e.preventDefault();
                this.cf.cuentas.crearCuentaBancaria();
            });
        }

        const btnVolverListado = document.getElementById('btn-volver-listado');
        if (btnVolverListado) {
            this.agregarEventListener(btnVolverListado, 'click', () => {
                const listaProyectos = document.getElementById('lista-proyectos');
                const dashboard = document.getElementById('dashboard-proyecto');
                if (listaProyectos) listaProyectos.style.display = 'block';
                if (dashboard) dashboard.style.display = 'none';
                this.cf.graficos.destruirGraficos();
                this.cf.charts = {};
                this.limpiarSistemaModalCompleto();
            });
        }

        // Formularios
        const formCrearProyecto = document.getElementById('form-crear-proyecto');
        if (formCrearProyecto) {
            this.agregarEventListener(formCrearProyecto, 'submit', (e) => {
                e.preventDefault();
                this.cf.proyectos.guardarProyecto();
            });
        }

        const formCrearCuenta = document.getElementById('form-crear-cuenta');
        if (formCrearCuenta) {
            this.agregarEventListener(formCrearCuenta, 'submit', (e) => {
                e.preventDefault();
                this.cf.cuentas.crearCuentaBancaria();
            });
        }

        // Fechas
        const fechaInicio = document.getElementById('fecha_inicio');
        const fechaFin = document.getElementById('fecha_fin');
        if (fechaInicio && fechaFin) {
            this.agregarEventListener(fechaInicio, 'change', function () {
                fechaFin.min = this.value;
                if (fechaFin.value && fechaFin.value < this.value) {
                    fechaFin.value = this.value;
                }
            });
        }

        // Modal de cuentas
        const modalCuentas = document.getElementById('modal-crear-cuenta');
        if (modalCuentas) {
            this.agregarEventListener(modalCuentas, 'shown.bs.modal', () => {
                this.cf.cuentas.cargarListaCuentas();
            });
        }

        // PARTIDAS
        const btnCrearPartida = document.getElementById('btn-crear-partida');
        if (btnCrearPartida) {
            this.agregarEventListener(btnCrearPartida, 'click', () => this.mostrarModalCrearPartida());
        }

        const btnGuardarPartida = document.getElementById('btn-guardar-partida');
        if (btnGuardarPartida) {
            this.agregarEventListener(btnGuardarPartida, 'click', (e) => {
                e.preventDefault();
                this.cf.partidas.crearPartida();
            });
        }

        const formCrearPartida = document.getElementById('form-crear-partida');
        if (formCrearPartida) {
            this.agregarEventListener(formCrearPartida, 'submit', (e) => {
                e.preventDefault();
                this.cf.partidas.crearPartida();
            });
        }

        // ABONOS
        const btnRegistrarIngreso = document.getElementById('btn-registrar-ingreso');
        if (btnRegistrarIngreso) {
            this.agregarEventListener(btnRegistrarIngreso, 'click', () => this.mostrarModalRegistrarIngreso());
        }

        const btnRegistrarAbono = document.getElementById('btn-registrar-abono');
        if (btnRegistrarAbono) {
            this.agregarEventListener(btnRegistrarAbono, 'click', (e) => {
                e.preventDefault();
                if (typeof window.guardarAbonoProyecto === 'function') {
                    window.guardarAbonoProyecto();
                }
            });
        }

        const formRegistrarIngreso = document.getElementById('form-registrar-ingreso');
        if (formRegistrarIngreso) {
            this.agregarEventListener(formRegistrarIngreso, 'submit', (e) => {
                e.preventDefault();
                if (typeof window.guardarAbonoProyecto === 'function') {
                    window.guardarAbonoProyecto();
                }
            });
        }

        // EGRESOS
        const btnRegistrarEgreso = document.getElementById('btn-registrar-egreso');
        if (btnRegistrarEgreso) {
            this.agregarEventListener(btnRegistrarEgreso, 'click', (e) => {
                e.preventDefault();
                this.mostrarModalRegistrarEgreso();
            });
        }

        // MODALES
        const modalIngreso = document.getElementById('modal-registrar-ingreso');
        if (modalIngreso) {
            this.agregarEventListener(modalIngreso, 'hidden.bs.modal', () => {
                this.limpiarFormularioModal('form-registrar-ingreso');
            });
        }

        const modalEgreso = document.getElementById('modal-registrar-egreso');
        if (modalEgreso) {
            this.agregarEventListener(modalEgreso, 'shown.bs.modal', () => this.cargarDatosParaModalEgreso());
            this.agregarEventListener(modalEgreso, 'hidden.bs.modal', () => {
                this.limpiarFormularioModal('form-registrar-egreso');
                this.limpiarEventListenersModalEgreso();
            });
        }

        // CONFIGURAR EVENTO DEL TIPO DE PARTIDA (CRÍTICO)
        this.configurarEventoTipoPartida();
    }

    // ============================================
    // MÉTODO CRÍTICO: Configurar evento de tipo de partida
    // ============================================
    configurarEventoTipoPartida() {
        const tipoPartidaSelect = document.getElementById('tipo_partida');
        if (!tipoPartidaSelect) return;

        const nuevoTipoPartida = tipoPartidaSelect.cloneNode(true);
        tipoPartidaSelect.parentNode.replaceChild(nuevoTipoPartida, tipoPartidaSelect);

        this.agregarEventListener(nuevoTipoPartida, 'change', async (e) => {
            const esSecundaria = e.target.value === 'Secundaria';
            const esPrincipal = e.target.value === 'Principal';

            const partidaPadreGroup = document.getElementById('partida-padre-group');
            const alertaPrincipal = document.getElementById('alerta-principal');
            const partidaPadreSelect = document.getElementById('partida_padre');
            const infoPresupuestoPadre = document.getElementById('info-presupuesto-padre');

            if (partidaPadreGroup) {
                if (esSecundaria) {
                    partidaPadreGroup.classList.add('visible');
                    partidaPadreGroup.style.display = 'block';
                } else {
                    partidaPadreGroup.classList.remove('visible');
                    partidaPadreGroup.style.display = 'none';
                }
            }

            if (alertaPrincipal) {
                alertaPrincipal.style.display = esPrincipal ? 'block' : 'none';
            }

            if (infoPresupuestoPadre) {
                infoPresupuestoPadre.innerHTML = '';
            }

            if (esSecundaria) {
                let proyectoId = document.getElementById('proyecto_id_partida')?.value;
                if (!proyectoId && this.cf && this.cf.proyectoActual) {
                    proyectoId = this.cf.proyectoActual.id;
                }
                if (!proyectoId) {
                    proyectoId = localStorage.getItem('proyecto_actual');
                }

                if (proyectoId && partidaPadreSelect) {
                    partidaPadreSelect.innerHTML = '<option value="">⏳ Cargando...</option>';
                    partidaPadreSelect.disabled = true;

                    if (typeof window.cargarPartidasPrincipales === 'function') {
                        await window.cargarPartidasPrincipales(proyectoId);
                        partidaPadreSelect.style.display = 'block';
                        partidaPadreSelect.style.visibility = 'visible';
                    } else {
                        console.error('❌ window.cargarPartidasPrincipales no está definida');
                        partidaPadreSelect.innerHTML = '<option value="">Error: Función no disponible</option>';
                        partidaPadreSelect.disabled = false;
                    }
                }
            } else {
                if (partidaPadreSelect) {
                    partidaPadreSelect.innerHTML = '<option value="">Seleccionar partida principal...</option>';
                    partidaPadreSelect.disabled = false;
                }
            }
        });
    }

    // ============================================
    // MOSTRAR MODAL CREAR PARTIDA (CORREGIDO)
    // ============================================
    mostrarModalCrearPartida() {
        const modalElement = document.getElementById('modal-crear-partida');
        if (!modalElement) return;

        const callbackPrevio = () => {
            const form = document.getElementById('form-crear-partida');
            if (form) form.reset();

            const tipoPartidaSelect = document.getElementById('tipo_partida');
            const partidaPadreGroup = document.getElementById('partida-padre-group');
            const partidaPadreSelect = document.getElementById('partida_padre');
            const alertaPrincipal = document.getElementById('alerta-principal');
            const infoPresupuestoPadre = document.getElementById('info-presupuesto-padre');

            if (tipoPartidaSelect) tipoPartidaSelect.value = 'Principal';

            if (partidaPadreGroup) {
                partidaPadreGroup.classList.remove('visible');
                partidaPadreGroup.style.display = 'none';
            }
            if (alertaPrincipal) alertaPrincipal.style.display = 'none';
            if (infoPresupuestoPadre) infoPresupuestoPadre.innerHTML = '';

            if (partidaPadreSelect) {
                partidaPadreSelect.innerHTML = '<option value="">📁 Seleccionar partida principal...</option>';
                partidaPadreSelect.disabled = false;
                partidaPadreSelect.style.display = 'block';
                partidaPadreSelect.style.visibility = 'visible';
            }

            const proyectoIdInput = document.getElementById('proyecto_id_partida');
            if (proyectoIdInput && this.cf.proyectoActual) {
                proyectoIdInput.value = this.cf.proyectoActual.id;
            }

            this.configurarEventoTipoPartida();
        };

        this.abrirModalSeguro(modalElement, callbackPrevio);
    }

    // ============================================
    // MOSTRAR MODAL REGISTRAR INGRESO (CORREGIDO)
    // ============================================
    mostrarModalRegistrarIngreso() {
        const modalElement = document.getElementById('modal-registrar-ingreso');
        if (!modalElement) return;

        const callbackPrevio = () => {
            const fechaInput = document.getElementById('fecha_ingreso');
            if (fechaInput && !fechaInput.value) {
                fechaInput.value = new Date().toISOString().split('T')[0];
            }

            const form = document.getElementById('form-registrar-ingreso');
            if (form) {
                form.reset();
                if (fechaInput) fechaInput.value = new Date().toISOString().split('T')[0];
            }

            const monedaSelect = document.getElementById('moneda_ingreso');
            const tasaInput = document.getElementById('tasa_cambio_ingreso');
            if (monedaSelect) monedaSelect.value = 'USD';
            if (tasaInput) tasaInput.value = '36.50';

            // Cargar cuentas bancarias después de un breve delay
            setTimeout(() => {
                if (this.cf.cuentas && this.cf.cuentas.cargarCuentasBancarias) {
                    this.cf.cuentas.cargarCuentasBancarias('ingreso');
                }
                this.configurarCambioMonedaIngreso();
            }, 100);
        };

        this.abrirModalSeguro(modalElement, callbackPrevio);
    }

    // ============================================
    // MOSTRAR MODAL REGISTRAR EGRESO (YA FUNCIONA, PERO SE MEJORA)
    // ============================================
    mostrarModalRegistrarEgreso(partidaId = null) {
        const modalElement = document.getElementById('modal-registrar-egreso');
        if (!modalElement) return;

        const callbackPrevio = () => {
            const fechaInput = document.getElementById('fecha_egreso');
            if (fechaInput && !fechaInput.value) {
                fechaInput.value = new Date().toISOString().split('T')[0];
            }

            const monedaSelect = document.getElementById('moneda_egreso');
            const tasaInput = document.getElementById('tasa_cambio_egreso');
            if (monedaSelect) monedaSelect.value = 'USD';
            if (tasaInput) tasaInput.value = '36.50';

            if (this.cf.proyectoActual) {
                const proyectoIdInput = document.getElementById('egreso_proyecto_id');
                if (proyectoIdInput) proyectoIdInput.value = this.cf.proyectoActual.id;
            }

            this.configurarEventListenersModalEgreso();
            this.cargarDatosParaModalEgreso(partidaId);
        };

        this.abrirModalSeguro(modalElement, callbackPrevio);
    }

    // ============================================
    // MOSTRAR MODAL CREAR CUENTA (CORREGIDO)
    // ============================================
    mostrarModalCrearCuenta() {
        const modalElement = document.getElementById('modal-crear-cuenta');
        if (!modalElement) return;

        const callbackPrevio = () => {
            const form = document.getElementById('form-crear-cuenta');
            if (form) form.reset();
        };

        this.abrirModalSeguro(modalElement, callbackPrevio);
    }

    // ============================================
    // CONFIGURAR CAMBIO DE MONEDA PARA INGRESO
    // ============================================
    configurarCambioMonedaIngreso() {
        const monedaSelect = document.getElementById('moneda_ingreso');
        const tasaInput = document.getElementById('tasa_cambio_ingreso');
        const montoInput = document.getElementById('monto_ingreso');
        const previewSpan = document.getElementById('conversion-ingreso-preview');

        if (!monedaSelect || !tasaInput) return;

        const actualizarPreview = () => {
            const montoUSD = parseFloat(montoInput?.value) || 0;
            const tasa = parseFloat(tasaInput.value) || 1.0;
            const montoBs = montoUSD * tasa;

            if (previewSpan) {
                previewSpan.innerHTML = `🇻🇪 Monto equivalente en bolívares: <strong>Bs ${montoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>`;
            }
        };

        monedaSelect.removeEventListener('change', actualizarPreview);
        if (tasaInput) tasaInput.removeEventListener('input', actualizarPreview);
        if (montoInput) montoInput.removeEventListener('input', actualizarPreview);

        monedaSelect.addEventListener('change', actualizarPreview);
        if (tasaInput) tasaInput.addEventListener('input', actualizarPreview);
        if (montoInput) montoInput.addEventListener('input', actualizarPreview);

        actualizarPreview();
    }

    // ============================================
    // CONFIGURAR CAMBIO DE MONEDA PARA EGRESO
    // ============================================
    configurarCambioMonedaEgreso() {
        const monedaSelect = document.getElementById('moneda_egreso');
        const tasaInput = document.getElementById('tasa_cambio_egreso');
        const montoInput = document.getElementById('monto_egreso');
        const previewSpan = document.getElementById('conversion-egreso-preview');

        if (!monedaSelect || !tasaInput) return;

        const actualizarPreview = () => {
            const montoUSD = parseFloat(montoInput?.value) || 0;
            const tasa = parseFloat(tasaInput.value) || 1.0;
            const montoBs = montoUSD * tasa;

            if (previewSpan) {
                previewSpan.innerHTML = `🇻🇪 Monto equivalente en bolívares: <strong>Bs ${montoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>`;
            }
        };

        monedaSelect.removeEventListener('change', actualizarPreview);
        if (tasaInput) tasaInput.removeEventListener('input', actualizarPreview);
        if (montoInput) montoInput.removeEventListener('input', actualizarPreview);

        monedaSelect.addEventListener('change', actualizarPreview);
        if (tasaInput) tasaInput.addEventListener('input', actualizarPreview);
        if (montoInput) montoInput.addEventListener('input', actualizarPreview);

        actualizarPreview();
    }

    // ============================================
    // CARGAR DATOS PARA MODAL DE EGRESO
    // ============================================
    async cargarDatosParaModalEgreso(partidaId = null) {
        try {
            if (this.cf.partidas && this.cf.partidas.cargarPartidasParaEgreso) {
                await this.cf.partidas.cargarPartidasParaEgreso();

                if (partidaId) {
                    const partidaSelect = document.getElementById('partida_egreso');
                    if (partidaSelect) {
                        setTimeout(() => {
                            for (let i = 0; i < partidaSelect.options.length; i++) {
                                if (partidaSelect.options[i].value == partidaId) {
                                    partidaSelect.selectedIndex = i;
                                    partidaSelect.dispatchEvent(new Event('change'));
                                    break;
                                }
                            }
                        }, 300);
                    }
                }
            }

            if (this.cf.cuentas && this.cf.cuentas.cargarCuentasBancarias) {
                await this.cf.cuentas.cargarCuentasBancarias('egreso');
            }

            setTimeout(() => {
                this.configurarCambioMonedaEgreso();
            }, 150);

        } catch (error) {
            console.error('Error cargando datos para modal de egreso:', error);
        }
    }

    // ============================================
    // CONFIGURAR EVENT LISTENERS DEL MODAL EGRESO
    // ============================================
    configurarEventListenersModalEgreso() {
        const btnRegistrarEgresoModal = document.getElementById('btn-registrar-egreso');
        if (btnRegistrarEgresoModal) {
            const clone = btnRegistrarEgresoModal.cloneNode(true);
            btnRegistrarEgresoModal.parentNode.replaceChild(clone, btnRegistrarEgresoModal);
            const freshBtn = document.getElementById('btn-registrar-egreso');
            this.agregarEventListener(freshBtn, 'click', (e) => {
                e.preventDefault();
                if (this.cf.transacciones && this.cf.transacciones.registrarEgreso) {
                    this.cf.transacciones.registrarEgreso();
                }
            });
        }
        const formRegistrarEgreso = document.getElementById('form-registrar-egreso');
        if (formRegistrarEgreso) {
            const formClone = formRegistrarEgreso.cloneNode(true);
            formRegistrarEgreso.parentNode.replaceChild(formClone, formRegistrarEgreso);
            const freshForm = document.getElementById('form-registrar-egreso');
            this.agregarEventListener(freshForm, 'submit', (e) => {
                e.preventDefault();
                if (this.cf.transacciones && this.cf.transacciones.registrarEgreso) {
                    this.cf.transacciones.registrarEgreso();
                }
            });
        }
    }

    // ============================================
    // CONFIGURAR MODALES (Observadores)
    // ============================================
    configurarModales() {
        this.limpiarObservers();
        const modales = document.querySelectorAll('.modal');
        modales.forEach(modal => {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
                        const modalElement = mutation.target;
                        const focusedElement = modalElement.querySelector(':focus');
                        if (focusedElement && modalElement.getAttribute('aria-hidden') === 'true') {
                            try {
                                focusedElement.blur();
                            } catch (e) { }
                            try {
                                document.body.focus();
                            } catch (e) {
                                if (document.activeElement) document.activeElement.blur();
                            }
                        }
                    }
                });
            });
            observer.observe(modal, { attributes: true, attributeFilter: ['aria-hidden'] });
            this.modalObservers.push({ modal, observer });
            this.agregarEventListener(modal, 'hide.bs.modal', (event) => {
                event.stopImmediatePropagation();
            });
            this.agregarEventListener(modal, 'hidden.bs.modal', (event) => {
                const modalElement = event.target;
                modalElement.removeAttribute('aria-hidden');
                modalElement.style.display = 'none';
                this.limpiarBackdrops();
                const form = modalElement.querySelector('form');
                if (form) form.reset();
            });
        });
    }

    // ============================================
    // MÉTODOS AUXILIARES (sin cambios)
    // ============================================
    agregarEventListener(elemento, evento, manejador) {
        if (!elemento || !evento || !manejador) return;
        elemento.removeEventListener(evento, manejador);
        elemento.addEventListener(evento, manejador);
        const key = `${elemento.id || elemento.className || 'element'}_${evento}`;
        if (!this.activeEventListeners.has(key)) {
            this.activeEventListeners.set(key, []);
        }
        this.activeEventListeners.get(key).push({ elemento, evento, manejador });
    }

    limpiarEventListenersPrevios() {
        const elementosCriticos = ['partida_egreso', 'monto_egreso', 'moneda_egreso', 'btn-registrar-egreso', 'form-registrar-egreso'];
        elementosCriticos.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                const clone = elemento.cloneNode(true);
                elemento.parentNode.replaceChild(clone, elemento);
            }
        });
        this.activeEventListeners.clear();
    }

    limpiarEventListenersModalEgreso() {
        const elementos = ['partida_egreso', 'monto_egreso', 'moneda_egreso', 'tasa_cambio_egreso', 'btn-registrar-egreso', 'form-registrar-egreso'];
        elementos.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                const clone = elemento.cloneNode(true);
                elemento.parentNode.replaceChild(clone, elemento);
            }
        });
    }

    limpiarFormularioModal(formId) {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
            const fechaInputs = form.querySelectorAll('input[type="date"]');
            fechaInputs.forEach(input => {
                if (!input.value) input.value = new Date().toISOString().split('T')[0];
            });
        }
    }

    limpiarObservers() {
        if (this.modalObservers && this.modalObservers.length > 0) {
            this.modalObservers.forEach(({ observer }) => observer.disconnect());
            this.modalObservers = [];
        }
    }

    limpiarSistemaModalCompleto() {
        document.querySelectorAll('.modal').forEach(modalEl => {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
            modalEl.classList.remove('show');
            modalEl.style.display = 'none';
            modalEl.setAttribute('aria-hidden', 'true');
        });
        this.limpiarBackdrops();
        document.querySelectorAll('input:focus, select:focus, button:focus').forEach(el => el.blur());
        this.limpiarObservers();
    }

    mostrarError(mensaje) {
        Swal.fire({ icon: 'error', title: 'Error', text: mensaje, timer: 5000, confirmButtonColor: '#dc3545' });
    }

    mostrarExito(mensaje) {
        Swal.fire({ icon: 'success', title: '¡Éxito!', text: mensaje, timer: 3000, showConfirmButton: false });
    }

    async confirmarAccion(mensaje) {
        const result = await Swal.fire({
            title: 'Confirmar',
            text: mensaje,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33'
        });
        return result.isConfirmed;
    }

    inicializar() {
        this.configurarCleanupGlobal();
        this.configurarEventos();
        this.configurarModales();
    }

    configurarCleanupGlobal() {
        window.addEventListener('beforeunload', () => this.limpiarSistemaModalCompleto());
        const proyectoTabs = document.querySelectorAll('#proyectoTabs button');
        if (proyectoTabs) {
            proyectoTabs.forEach(tab => {
                this.agregarEventListener(tab, 'click', () => setTimeout(() => this.limpiarSistemaModalCompleto(), 100));
            });
        }
        window.cleanupModalsUI = () => this.limpiarSistemaModalCompleto();
    }

    async mostrarModalTransaccionBanco(tipoTransaccion) {
        const modalElement = document.getElementById('modal-transaccion-banco');
        if (!modalElement) return;

        const callbackPrevio = () => {
            this.configurarModalSegunTipo(tipoTransaccion);
            if (this.cf.cuentas && this.cf.cuentas.cargarCuentasParaModal) {
                this.cf.cuentas.cargarCuentasParaModal(tipoTransaccion);
            }
        };

        this.abrirModalSeguro(modalElement, callbackPrevio);
    }

    configurarModalSegunTipo(tipoTransaccion) {
        const modalTitle = document.querySelector('#modal-transaccion-banco .modal-title');
        const btnGuardar = document.getElementById('btn-guardar-transaccion');
        const cuentaDestinoGroup = document.getElementById('cuenta-destino-group');
        const beneficiarioGroup = document.getElementById('beneficiario-group');
        const transaccionTipo = document.getElementById('transaccion_tipo');
        if (transaccionTipo) transaccionTipo.value = tipoTransaccion;
        let titulo = '', textoBoton = '';
        switch (tipoTransaccion) {
            case 'ingreso': titulo = '<i class="fas fa-money-bill-wave"></i> Registrar Ingreso Bancario'; textoBoton = '<i class="fas fa-save"></i> Registrar Ingreso'; break;
            case 'egreso': titulo = '<i class="fas fa-credit-card"></i> Registrar Egreso Bancario'; textoBoton = '<i class="fas fa-save"></i> Registrar Egreso'; break;
            case 'transferencia': titulo = '<i class="fas fa-exchange-alt"></i> Transferencia Bancaria'; textoBoton = '<i class="fas fa-save"></i> Realizar Transferencia'; break;
        }
        if (modalTitle) modalTitle.innerHTML = titulo;
        if (btnGuardar) btnGuardar.innerHTML = textoBoton;
        if (cuentaDestinoGroup) cuentaDestinoGroup.style.display = tipoTransaccion === 'transferencia' ? 'block' : 'none';
        if (beneficiarioGroup) beneficiarioGroup.style.display = tipoTransaccion === 'egreso' ? 'block' : 'none';
    }
}