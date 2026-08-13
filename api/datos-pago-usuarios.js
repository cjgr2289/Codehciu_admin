/**
 * Módulo para gestionar datos de pago de usuarios
 * CODEHCIU - Sistema de Finanzas
 */

const datosPagoUsuarios = (function() {
    
    // Variables
    let modalInstance = null;
    let currentUserId = null;
    let currentUserData = null;

    // ========== INICIALIZACIÓN ==========
    function init() {
        console.log('✅ datosPagoUsuarios inicializado');
        configurarEventos();
        cargarUsuariosConDatosPago();
    }

    // ========== CONFIGURAR EVENTOS ==========
    function configurarEventos() {
        // Evento para el botón de datos de pago en la tabla
        document.addEventListener('click', function(e) {
            const btn = e.target.closest('.btn-datos-pago');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                const userId = btn.dataset.userId;
                const userName = btn.dataset.userName;
                const userEmail = btn.dataset.userEmail;
                if (userId) {
                    abrirModalDatosPago(userId, userName, userEmail);
                }
            }
        });

        // Cerrar modal con X
        document.querySelector('#modal-datos-pago .modal-close')?.addEventListener('click', cerrarModal);
        
        // Cerrar modal con click fuera
        document.querySelector('#modal-datos-pago')?.addEventListener('click', function(e) {
            if (e.target === this) {
                cerrarModal();
            }
        });

        // Guardar datos de pago
        document.getElementById('btn-guardar-datos-pago')?.addEventListener('click', guardarDatosPago);

        // Eliminar datos de pago
        document.getElementById('btn-eliminar-datos-pago')?.addEventListener('click', eliminarDatosPago);

        // Evento para checkbox de tercero
        document.getElementById('datos-pago-es-tercero')?.addEventListener('change', function() {
            const group = document.getElementById('honorarios-group');
            if (group) {
                group.style.display = this.checked ? 'block' : 'none';
            }
        });
    }

    // ========== CARGAR USUARIOS CON DATOS DE PAGO ==========
    async function cargarUsuariosConDatosPago() {
        try {
            const response = await fetch('./api/datos_pago_usuarios.php?action=listar_usuarios', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.success && data.data) {
                actualizarTablaUsuarios(data.data);
            }
        } catch (error) {
            console.error('Error cargando datos de pago:', error);
            showToast('error', 'Error al cargar datos de pago');
        }
    }

    // ========== ACTUALIZAR TABLA DE USUARIOS ==========
    function actualizarTablaUsuarios(usuarios) {
        // Buscar la tabla de usuarios y agregar columna de datos de pago
        const tablaBody = document.querySelector('#users-list table tbody');
        if (!tablaBody) return;

        // Verificar si ya existe la columna de datos de pago
        const headerRow = document.querySelector('#users-list table thead tr');
        if (headerRow) {
            // Si no existe la columna, agregarla
            const ths = headerRow.querySelectorAll('th');
            let hasDatosPago = false;
            ths.forEach(th => {
                if (th.textContent.trim() === 'Datos Pago') {
                    hasDatosPago = true;
                }
            });
            
            if (!hasDatosPago) {
                const newTh = document.createElement('th');
                newTh.textContent = 'Datos Pago';
                newTh.style.textAlign = 'center';
                headerRow.appendChild(newTh);
            }
        }

        // Recorrer filas y agregar botón de datos de pago
        const rows = tablaBody.querySelectorAll('tr');
        rows.forEach(row => {
            // Verificar si ya tiene la celda de datos de pago
            let hasDatosPagoCell = false;
            const cells = row.querySelectorAll('td');
            const lastCell = cells[cells.length - 1];
            
            // Si la última celda tiene el botón de datos de pago, no hacer nada
            if (lastCell && lastCell.querySelector('.btn-datos-pago')) {
                hasDatosPagoCell = true;
            }
            
            if (!hasDatosPagoCell) {
                // Buscar el ID del usuario en la fila
                const editBtn = row.querySelector('.btn-edit');
                let userId = null;
                let userName = '';
                let userEmail = '';
                
                if (editBtn) {
                    userId = editBtn.dataset.id;
                } else {
                    // Buscar en otros botones
                    const deleteBtn = row.querySelector('.btn-delete');
                    if (deleteBtn) {
                        userId = deleteBtn.dataset.id;
                    }
                }
                
                // Obtener nombre y email
                const nameCell = row.querySelector('td[data-label="Nombre"]');
                if (nameCell) {
                    const strong = nameCell.querySelector('strong');
                    if (strong) {
                        userName = strong.textContent.trim();
                    }
                }
                
                const emailCell = row.querySelector('td[data-label="Email"]');
                if (emailCell) {
                    userEmail = emailCell.textContent.trim();
                }
                
                if (userId) {
                    const newCell = document.createElement('td');
                    newCell.setAttribute('data-label', 'Datos Pago');
                    newCell.style.textAlign = 'center';
                    newCell.innerHTML = `
                        <button class="btn-icon btn-datos-pago" 
                                data-user-id="${userId}" 
                                data-user-name="${escapeHtml(userName)}" 
                                data-user-email="${escapeHtml(userEmail)}"
                                title="Gestionar datos de pago">
                            <i class="fas fa-credit-card"></i>
                        </button>
                    `;
                    row.appendChild(newCell);
                }
            }
        });
    }

    // ========== ABRIR MODAL DATOS DE PAGO ==========
    function abrirModalDatosPago(userId, userName, userEmail) {
        currentUserId = userId;
        currentUserData = { nombre: userName, email: userEmail };
        
        // Mostrar modal
        const modal = document.getElementById('modal-datos-pago');
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
        
        // Actualizar información del usuario
        document.getElementById('datos-pago-user-name').textContent = userName || 'Usuario';
        document.getElementById('datos-pago-user-email').textContent = userEmail || '';
        document.getElementById('datos-pago-usuario-id').value = userId;
        
        // Cargar datos existentes
        cargarDatosPagoUsuario(userId);
    }

    // ========== CARGAR DATOS DE PAGO DEL USUARIO ==========
    async function cargarDatosPagoUsuario(userId) {
        try {
            const response = await fetch(`./api/datos_pago_usuarios.php?action=obtener&usuario_id=${userId}`, {
                credentials: 'include'
            });
            const data = await response.json();
            
            // Limpiar formulario
            document.getElementById('datos-pago-banco').value = '';
            document.getElementById('datos-pago-tipo-cuenta').value = 'Corriente';
            document.getElementById('datos-pago-numero-cuenta').value = '';
            document.getElementById('datos-pago-numero-cedula').value = '';
            document.getElementById('datos-pago-forma-pago').value = 'Transferencia';
            document.getElementById('datos-pago-monto-honorarios').value = '';
            document.getElementById('datos-pago-es-tercero').checked = false;
            document.getElementById('datos-pago-tipo-contrato').value = 'Honorarios';
            document.getElementById('datos-pago-observaciones').value = '';
            document.getElementById('honorarios-group').style.display = 'none';
            document.getElementById('btn-eliminar-datos-pago').style.display = 'none';
            
            if (data.success && data.data) {
                const datos = data.data;
                
                document.getElementById('datos-pago-banco').value = datos.banco || '';
                document.getElementById('datos-pago-tipo-cuenta').value = datos.tipo_cuenta || 'Corriente';
                document.getElementById('datos-pago-numero-cuenta').value = datos.numero_cuenta || '';
                document.getElementById('datos-pago-numero-cedula').value = datos.numero_cedula || '';
                document.getElementById('datos-pago-forma-pago').value = datos.forma_pago || 'Transferencia';
                document.getElementById('datos-pago-monto-honorarios').value = datos.monto_honorarios || '';
                document.getElementById('datos-pago-es-tercero').checked = datos.es_tercero == 1;
                document.getElementById('datos-pago-tipo-contrato').value = datos.tipo_contrato || 'Honorarios';
                document.getElementById('datos-pago-observaciones').value = datos.observaciones || '';
                
                if (datos.es_tercero == 1) {
                    document.getElementById('honorarios-group').style.display = 'block';
                }
                
                // Mostrar botón eliminar si tiene datos
                if (datos.id) {
                    document.getElementById('btn-eliminar-datos-pago').style.display = 'inline-block';
                }
            }
        } catch (error) {
            console.error('Error cargando datos de pago:', error);
            showToast('error', 'Error al cargar los datos de pago');
        }
    }

    // ========== GUARDAR DATOS DE PAGO ==========
    async function guardarDatosPago() {
        const userId = document.getElementById('datos-pago-usuario-id').value;
        const banco = document.getElementById('datos-pago-banco').value.trim();
        const tipoCuenta = document.getElementById('datos-pago-tipo-cuenta').value;
        const numeroCuenta = document.getElementById('datos-pago-numero-cuenta').value.trim();
        const numeroCedula = document.getElementById('datos-pago-numero-cedula').value.trim();
        const formaPago = document.getElementById('datos-pago-forma-pago').value;
        const montoHonorarios = parseFloat(document.getElementById('datos-pago-monto-honorarios').value) || null;
        const esTercero = document.getElementById('datos-pago-es-tercero').checked ? 1 : 0;
        const tipoContrato = document.getElementById('datos-pago-tipo-contrato').value;
        const observaciones = document.getElementById('datos-pago-observaciones').value.trim();
        
        // Validaciones
        if (!banco) {
            showToast('warning', 'El banco es requerido');
            document.getElementById('datos-pago-banco').focus();
            return;
        }
        
        if (!numeroCuenta) {
            showToast('warning', 'El número de cuenta es requerido');
            document.getElementById('datos-pago-numero-cuenta').focus();
            return;
        }
        
        if (!numeroCedula) {
            showToast('warning', 'La cédula/RIF es requerida');
            document.getElementById('datos-pago-numero-cedula').focus();
            return;
        }
        
        if (esTercero && (!montoHonorarios || montoHonorarios <= 0)) {
            showToast('warning', 'El monto de honorarios es requerido para terceros');
            document.getElementById('datos-pago-monto-honorarios').focus();
            return;
        }
        
        const data = {
            usuario_id: parseInt(userId),
            banco: banco,
            tipo_cuenta: tipoCuenta,
            numero_cuenta: numeroCuenta,
            numero_cedula: numeroCedula,
            forma_pago: formaPago,
            monto_honorarios: montoHonorarios,
            es_tercero: esTercero,
            tipo_contrato: tipoContrato,
            observaciones: observaciones
        };
        
        try {
            const response = await fetch('./api/datos_pago_usuarios.php?action=guardar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
                credentials: 'include'
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('success', result.message || 'Datos de pago guardados correctamente');
                cerrarModal();
                cargarUsuariosConDatosPago();
            } else {
                showToast('error', result.error || 'Error al guardar datos de pago');
            }
        } catch (error) {
            console.error('Error guardando datos de pago:', error);
            showToast('error', 'Error al guardar los datos de pago');
        }
    }

    // ========== ELIMINAR DATOS DE PAGO ==========
    async function eliminarDatosPago() {
        const userId = document.getElementById('datos-pago-usuario-id').value;
        const userName = document.getElementById('datos-pago-user-name').textContent;
        
        const confirmacion = await Swal.fire({
            title: '¿Eliminar datos de pago?',
            html: `
                <p>¿Estás seguro de que deseas eliminar los datos de pago de <strong>${escapeHtml(userName)}</strong>?</p>
                <p class="text-muted" style="font-size: 13px;">Esta acción no eliminará los datos del usuario, solo sus datos bancarios y de pago.</p>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d33',
            reverseButtons: true
        });
        
        if (!confirmacion.isConfirmed) return;
        
        try {
            const response = await fetch('./api/datos_pago_usuarios.php?action=eliminar', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ usuario_id: parseInt(userId) }),
                credentials: 'include'
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('success', result.message || 'Datos de pago eliminados correctamente');
                cerrarModal();
                cargarUsuariosConDatosPago();
            } else {
                showToast('error', result.error || 'Error al eliminar datos de pago');
            }
        } catch (error) {
            console.error('Error eliminando datos de pago:', error);
            showToast('error', 'Error al eliminar los datos de pago');
        }
    }

    // ========== CERRAR MODAL ==========
    function cerrarModal() {
        const modal = document.getElementById('modal-datos-pago');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        currentUserId = null;
        currentUserData = null;
    }

    // ========== FUNCIONES AUXILIARES ==========
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showToast(type, message) {
        if (typeof Swal !== 'undefined') {
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer);
                    toast.addEventListener('mouseleave', Swal.resumeTimer);
                }
            });
            
            const icons = {
                success: 'success',
                error: 'error',
                warning: 'warning',
                info: 'info'
            };
            
            Toast.fire({
                icon: icons[type] || 'info',
                title: message
            });
        } else {
            alert(message);
        }
    }

    // ========== API PÚBLICA ==========
    return {
        init,
        abrirModalDatosPago,
        cargarUsuariosConDatosPago,
        cerrarModal
    };

})();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Esperar a que usuarios.js cargue primero
    setTimeout(function() {
        if (typeof datosPagoUsuarios !== 'undefined') {
            datosPagoUsuarios.init();
        }
    }, 1000);
});

// Hacer funciones globales para acceso desde HTML
window.datosPagoUsuarios = datosPagoUsuarios;