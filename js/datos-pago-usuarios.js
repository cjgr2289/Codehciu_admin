/**
 * Módulo para gestionar datos de pago de usuarios
 * CODEHCIU - Sistema de Finanzas
 */

const datosPagoUsuarios = (function() {
    
    // Variables
    let modalInstance = null;
    let currentUserId = null;
    let currentUserData = null;
    let initialized = false;

    // ========== INICIALIZACIÓN ==========
    function init() {
        if (initialized) return;
        initialized = true;
        
        console.log('✅ datosPagoUsuarios inicializado');
        configurarEventos();
        
        // Esperar a que la tabla de usuarios se cargue
        esperarTablaUsuarios();
    }

    // ========== ESPERAR TABLA DE USUARIOS ==========
    function esperarTablaUsuarios() {
        let intentos = 0;
        const maxIntentos = 20; // 10 segundos máximo
        
        const interval = setInterval(() => {
            intentos++;
            
            const tablaBody = document.querySelector('#users-list table tbody');
            if (tablaBody && tablaBody.children.length > 0) {
                clearInterval(interval);
                console.log('✅ Tabla de usuarios encontrada, agregando botones...');
                agregarBotonesDatosPago();
            } else if (intentos >= maxIntentos) {
                clearInterval(interval);
                console.warn('⚠️ No se encontró la tabla de usuarios después de 10 segundos');
            }
        }, 500);
    }

    // ========== CONFIGURAR EVENTOS ==========
    function configurarEventos() {
        // Evento para el botón de datos de pago en la tabla (delegado)
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

        // Evento para cuando se recarga la tabla (nuevos usuarios)
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    // Verificar si se agregaron filas a la tabla
                    const tablaBody = document.querySelector('#users-list table tbody');
                    if (tablaBody) {
                        agregarBotonesDatosPago();
                    }
                }
            });
        });

        // Observar cambios en el contenedor de usuarios
        const usersList = document.getElementById('users-list');
        if (usersList) {
            observer.observe(usersList, {
                childList: true,
                subtree: true
            });
        }

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

    // ========== AGREGAR BOTONES DE DATOS DE PAGO ==========
    function agregarBotonesDatosPago() {
        const tablaBody = document.querySelector('#users-list table tbody');
        if (!tablaBody) return;

        // Verificar si ya existe la columna de datos de pago en el header
        const headerRow = document.querySelector('#users-list table thead tr');
        if (headerRow) {
            let hasDatosPago = false;
            const ths = headerRow.querySelectorAll('th');
            ths.forEach(th => {
                if (th.textContent.trim() === 'Datos Pago') {
                    hasDatosPago = true;
                }
            });
            
            if (!hasDatosPago) {
                const newTh = document.createElement('th');
                newTh.textContent = 'Datos Pago';
                newTh.style.textAlign = 'center';
                newTh.style.width = '80px';
                headerRow.appendChild(newTh);
            }
        }

        // Recorrer filas y agregar botón de datos de pago
        const rows = tablaBody.querySelectorAll('tr');
        rows.forEach(row => {
            // Verificar si ya tiene la celda de datos de pago
            const cells = row.querySelectorAll('td');
            const lastCell = cells[cells.length - 1];
            
            // Si la última celda ya tiene el botón, saltar
            if (lastCell && lastCell.querySelector('.btn-datos-pago')) {
                return;
            }
            
            // Si hay más de 6 celdas, ya tiene todas las columnas
            if (cells.length >= 7) {
                // Ya tiene todas las columnas, verificar si la última es la de datos pago
                const possibleDatosPagoCell = cells[cells.length - 1];
                if (possibleDatosPagoCell.querySelector('.btn-datos-pago')) {
                    return;
                }
            }
            
            // Buscar el ID del usuario en la fila
            let userId = null;
            let userName = '';
            let userEmail = '';
            
            // Buscar en el botón de editar
            const editBtn = row.querySelector('.btn-edit');
            if (editBtn) {
                userId = editBtn.dataset.id;
            }
            
            // Si no, buscar en el botón de eliminar
            if (!userId) {
                const deleteBtn = row.querySelector('.btn-delete');
                if (deleteBtn) {
                    userId = deleteBtn.dataset.id;
                }
            }
            
            // Si no, buscar en el botón de proyectos
            if (!userId) {
                const projectsBtn = row.querySelector('.btn-projects');
                if (projectsBtn) {
                    userId = projectsBtn.dataset.id;
                }
            }
            
            // Si no, buscar en el botón de cambio de contraseña
            if (!userId) {
                const passBtn = row.querySelector('.btn-change-password');
                if (passBtn) {
                    userId = passBtn.dataset.id;
                }
            }
            
            // Si aún no hay userId, intentar obtener del data-id de cualquier botón
            if (!userId) {
                const anyBtn = row.querySelector('button[data-id]');
                if (anyBtn) {
                    userId = anyBtn.dataset.id;
                }
            }
            
            if (userId) {
                // Obtener nombre de la celda de nombre
                const nameCell = row.querySelector('td[data-label="Nombre"]');
                if (nameCell) {
                    const strong = nameCell.querySelector('strong');
                    if (strong) {
                        userName = strong.textContent.trim();
                    }
                }
                
                // Si no se encontró, buscar en cualquier celda
                if (!userName) {
                    const firstCell = row.querySelector('td:first-child');
                    if (firstCell) {
                        const strong = firstCell.querySelector('strong');
                        if (strong) {
                            userName = strong.textContent.trim();
                        } else {
                            userName = firstCell.textContent.trim();
                        }
                    }
                }
                
                // Obtener email
                const emailCell = row.querySelector('td[data-label="Email"]');
                if (emailCell) {
                    userEmail = emailCell.textContent.trim();
                }
                
                // Si no se encontró email, buscar en otra celda
                if (!userEmail) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length > 1) {
                        // Intentar encontrar el email por su formato
                        for (let cell of cells) {
                            const text = cell.textContent.trim();
                            if (text.includes('@') && text.includes('.')) {
                                userEmail = text;
                                break;
                            }
                        }
                    }
                }
                
                // Crear la celda si no existe
                let newCell = null;
                if (cells.length >= 7) {
                    // Ya tiene 7 columnas, reemplazar la última o agregar
                    const lastCell = cells[cells.length - 1];
                    if (!lastCell.querySelector('.btn-datos-pago')) {
                        newCell = document.createElement('td');
                        newCell.setAttribute('data-label', 'Datos Pago');
                        newCell.style.textAlign = 'center';
                        newCell.style.verticalAlign = 'middle';
                        newCell.innerHTML = `
                            <button class="btn-datos-pago" 
                                    data-user-id="${userId}" 
                                    data-user-name="${escapeHtml(userName)}" 
                                    data-user-email="${escapeHtml(userEmail)}"
                                    title="Gestionar datos de pago">
                                <i class="fas fa-credit-card"></i>
                            </button>
                        `;
                        // Reemplazar la última celda
                        lastCell.parentNode.replaceChild(newCell, lastCell);
                    }
                } else {
                    // Agregar nueva celda al final
                    newCell = document.createElement('td');
                    newCell.setAttribute('data-label', 'Datos Pago');
                    newCell.style.textAlign = 'center';
                    newCell.style.verticalAlign = 'middle';
                    newCell.innerHTML = `
                        <button class="btn-datos-pago" 
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

    // ========== CARGAR USUARIOS CON DATOS DE PAGO ==========
    async function cargarUsuariosConDatosPago() {
        try {
            const response = await fetch('./api/datos_pago_usuarios.php?action=listar_usuarios', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.success && data.data) {
                // Solo almacenar datos, no renderizar
                console.log('✅ Datos de pago cargados:', data.data.length, 'usuarios');
            }
        } catch (error) {
            console.error('Error cargando datos de pago:', error);
        }
    }

    // ========== ABRIR MODAL DATOS DE PAGO ==========
    function abrirModalDatosPago(userId, userName, userEmail) {
        currentUserId = userId;
        currentUserData = { nombre: userName, email: userEmail };
        
        // Mostrar modal
        const modal = document.getElementById('modal-datos-pago');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
        
        // Actualizar información del usuario
        const nameElement = document.getElementById('datos-pago-user-name');
        if (nameElement) nameElement.textContent = userName || 'Usuario';
        
        const emailElement = document.getElementById('datos-pago-user-email');
        if (emailElement) emailElement.textContent = userEmail || '';
        
        const userIdInput = document.getElementById('datos-pago-usuario-id');
        if (userIdInput) userIdInput.value = userId;
        
        // Iniciales para el avatar
        const inicialElement = document.getElementById('datos-pago-inicial');
        if (inicialElement && userName) {
            inicialElement.textContent = userName.charAt(0).toUpperCase();
        }
        
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
                // Recargar la tabla para actualizar el estado del botón
                if (typeof loadUsers === 'function') {
                    loadUsers();
                } else {
                    // Si no hay función loadUsers, simplemente esperar
                    setTimeout(() => {
                        agregarBotonesDatosPago();
                    }, 1000);
                }
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
                if (typeof loadUsers === 'function') {
                    loadUsers();
                }
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

    // ========== FUNCIÓN PARA FORZAR AGREGAR BOTONES ==========
    function forzarAgregarBotones() {
        agregarBotonesDatosPago();
    }

    // ========== API PÚBLICA ==========
    return {
        init,
        abrirModalDatosPago,
        cargarUsuariosConDatosPago,
        cerrarModal,
        agregarBotones: forzarAgregarBotones
    };

})();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Esperar a que usuarios.js cargue primero
    setTimeout(function() {
        if (typeof datosPagoUsuarios !== 'undefined') {
            datosPagoUsuarios.init();
        }
    }, 1500);
});

// Hacer funciones globales para acceso desde HTML
window.datosPagoUsuarios = datosPagoUsuarios;

// También ejecutar cuando se termine de cargar la tabla
document.addEventListener('load', function() {
    setTimeout(function() {
        if (typeof datosPagoUsuarios !== 'undefined') {
            datosPagoUsuarios.agregarBotones();
        }
    }, 2000);
});