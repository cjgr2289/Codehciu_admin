// Función para inicializar el modal de políticas
function initPoliticasModal() {
    // console.log("Inicializando modal de políticas");
    
    const user = JSON.parse(localStorage.getItem('user'));
    const politicasLink = document.getElementById('ver-politicas-link');
    const politicasModal = document.getElementById('politicas-modal');
    const aceptarBtn = document.getElementById('aceptar-politicas-btn');
    const cerrarBtn = document.getElementById('cerrar-politicas-btn');
    const politicasCheck = document.getElementById('politicas-check');

    // Debug: Verificar el usuario
    // console.log("Usuario desde localStorage:", user);

    // Variable para controlar si las políticas están aceptadas
    let politicasAceptadas = false;

    // Función para mostrar el modal
    function mostrarModal() {
        if (politicasModal) {
            politicasModal.classList.add('visible');
            document.body.style.overflow = 'hidden';
        }
    }

    // Función para ocultar el modal
    function ocultarModal() {
        if (politicasModal) {
            politicasModal.classList.remove('visible');
            document.body.style.overflow = '';
        }
    }

    // Función para actualizar el estado de bloqueo del modal
    function actualizarEstadoBloqueo() {
        if (politicasModal) {
            if (politicasAceptadas) {
                politicasModal.classList.remove('bloqueado');
            } else {
                politicasModal.classList.add('bloqueado');
            }
        }
    }

    // Función para verificar si se puede cerrar el modal
    function puedeCerrarModal() {
        if (politicasAceptadas) {
            return true;
        }
        return politicasCheck ? politicasCheck.checked : false;
    }

    // Cargar estado inicial de las políticas
    if (user && user.id) {
        // console.log("Cargando estado de políticas para usuario ID:", user.id);
        cargarEstadoPoliticas(user.id)
            .then(aceptadas => {
                politicasAceptadas = aceptadas;
                actualizarEstadoBloqueo();
                
                if (!aceptadas) {
                    mostrarModal();
                    // console.log("Políticas no aceptadas, modal bloqueado");
                }
            })
            .catch(error => {
                console.error('Error al cargar estado de políticas:', error);
            });
    } else {
        console.error("No se pudo obtener el usuario o el ID del usuario");
    }

    // Event listener para cambios en el checkbox
    if (politicasCheck) {
        politicasCheck.addEventListener('change', function() {
            actualizarEstadoBloqueo();
        });
    }

    // Manejar el botón de aceptar
    if (aceptarBtn) {
        aceptarBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (!politicasCheck || !politicasCheck.checked) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Debes aceptar las políticas para continuar'
                });
                return;
            }
            
            if (user && user.id) {
                // console.log("Intentando guardar políticas para usuario ID:", user.id);
                
                // Mostrar loading
                const originalText = aceptarBtn.textContent;
                aceptarBtn.textContent = 'Guardando...';
                aceptarBtn.disabled = true;
                
                guardarAceptacionPoliticas(user.id, true)
                    .then((data) => {
                        // console.log("Políticas guardadas exitosamente:", data);
                        
                        // Actualizar estado local
                        politicasAceptadas = true;
                        if (politicasCheck) {
                            politicasCheck.disabled = true;
                        }
                        localStorage.setItem('politicasAceptadas', 'true');
                        actualizarEstadoBloqueo();
                        
                        // Restaurar botón
                        aceptarBtn.textContent = originalText;
                        aceptarBtn.disabled = false;
                        
                        Swal.fire({
                            icon: 'success',
                            title: '¡Éxito!',
                            text: 'Políticas aceptadas correctamente',
                            timer: 2000,
                            showConfirmButton: false
                        }).then(() => {
                            ocultarModal();
                        });
                    })
                    .catch(error => {
                        console.error('Error al guardar políticas:', error);
                        // Restaurar botón
                        aceptarBtn.textContent = originalText;
                        aceptarBtn.disabled = false;
                        
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'No se pudo guardar la aceptación de políticas: ' + error.message
                        });
                    });
            } else {
                console.error("No hay usuario o ID de usuario válido");
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se pudo identificar al usuario. Por favor, recarga la página.'
                });
            }
        });
    }
    
    // Abrir modal desde el enlace
    if (politicasLink) {
        politicasLink.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            mostrarModal();
        });
    }

    // Manejar el botón Cerrar
    if (cerrarBtn) {
        cerrarBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (puedeCerrarModal()) {
                ocultarModal();
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Atención',
                    text: 'Debes aceptar las políticas antes de continuar'
                });
            }
        });
    }

    // Cerrar modal al hacer clic fuera del contenido
    if (politicasModal) {
        politicasModal.addEventListener('click', function(e) {
            if (e.target === politicasModal) {
                if (puedeCerrarModal()) {
                    ocultarModal();
                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Atención',
                        text: 'Debes aceptar las políticas antes de continuar'
                    });
                }
            }
        });
    }

    // Cerrar modal con la tecla Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && politicasModal && politicasModal.classList.contains('visible')) {
            if (puedeCerrarModal()) {
                ocultarModal();
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Atención',
                    text: 'Debes aceptar las políticas antes de continuar'
                });
                e.preventDefault();
            }
        }
    });
}

// Función para cargar el estado de las políticas
async function cargarEstadoPoliticas(userId) {
    try {
        // console.log("Cargando estado de políticas para userId:", userId);
        
        if (!userId || userId <= 0) {
            throw new Error("ID de usuario inválido: " + userId);
        }
        
        const response = await fetch(`./api/obtener-politicas.php?userId=${userId}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        // console.log("Datos recibidos de obtener-politicas:", data);
        
        if (data.success) {
            const checkbox = document.getElementById('politicas-check');
            if (checkbox) {
                checkbox.checked = data.aceptado;
                checkbox.disabled = data.aceptado;
            }
            localStorage.setItem('politicasAceptadas', data.aceptado ? 'true' : 'false');
            return data.aceptado;
        } else {
            throw new Error(data.error || 'Error al cargar políticas');
        }
    } catch (error) {
        console.error('Error al cargar estado de políticas:', error);
        // Usar localStorage como respaldo
        const politicasAceptadas = localStorage.getItem('politicasAceptadas') === 'true';
        const checkbox = document.getElementById('politicas-check');
        if (checkbox && politicasAceptadas) {
            checkbox.checked = true;
            checkbox.disabled = true;
        }
        return politicasAceptadas;
    }
}

// Función para guardar la aceptación de políticas
async function guardarAceptacionPoliticas(userId, aceptado) {
    try {
        // console.log('Guardando aceptación de políticas:', { userId, aceptado });
        
        // Validar el userId antes de enviar
        if (!userId || userId <= 0) {
            throw new Error("ID de usuario inválido: " + userId);
        }
        
        const requestBody = {
            userId: userId,
            aceptado: aceptado
        };
        
        // console.log('Enviando request body:', requestBody);
        
        const response = await fetch('./api/actualizar-politicas.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        // console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response text:', errorText);
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        // console.log('Response data:', data);
        
        if (!data.success) {
            throw new Error(data.error || data.message || 'Error al guardar políticas');
        }
        
        return data;
    } catch (error) {
        console.error('Error en guardarAceptacionPoliticas:', error);
        throw error;
    }
}

// Función para obtener el usuario de forma segura
function getCurrentUser() {
    try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            console.error('No se encontró usuario en localStorage');
            return null;
        }
        
        const user = JSON.parse(userStr);
        if (!user || !user.id) {
            console.error('Usuario inválido en localStorage:', user);
            return null;
        }
        
        return user;
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        return null;
    }
}

// Función para verificar si las políticas han sido aceptadas
async function verificarPoliticasAceptadas(userId) {
    try {
        // Validar userId
        if (!userId || userId <= 0) {
            console.error('UserId inválido para verificación:', userId);
            return false;
        }
        
        // Verificar primero en localStorage
        const politicasAceptadas = localStorage.getItem('politicasAceptadas');
        if (politicasAceptadas === 'true') {
            return true;
        }
        
        // Si no está en localStorage, verificar en la base de datos
        const response = await fetch(`./api/obtener-politicas.php?userId=${userId}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && !data.aceptado) {
            // Mostrar modal si no están aceptadas
            setTimeout(() => {
                const politicasModal = document.getElementById('politicas-modal');
                if (politicasModal) {
                    politicasModal.classList.add('visible');
                    politicasModal.classList.add('bloqueado');
                }
            }, 300);
            return false;
        }
        
        return data.aceptado;
    } catch (error) {
        console.error('Error al verificar políticas:', error);
        // En caso de error, mostrar el modal
        setTimeout(() => {
            const politicasModal = document.getElementById('politicas-modal');
            if (politicasModal) {
                politicasModal.classList.add('visible');
                politicasModal.classList.add('bloqueado');
            }
        }, 300);
        return false;
    }
}

// Inicializar el modal cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // console.log("DOM cargado, verificando modal de políticas...");
    
    // Solo inicializar si el modal ya está en el DOM
    if (document.getElementById('politicas-modal')) {
        // console.log("Modal encontrado en DOM, inicializando...");
        initPoliticasModal();
    }
    
    // Verificar si hay un usuario logueado
    const user = getCurrentUser();
    if (user) {
        // console.log("Usuario encontrado, verificando políticas. ID:", user.id);
        // Verificar políticas después de un pequeño retraso
        setTimeout(() => {
            verificarPoliticasAceptadas(user.id);
        }, 500);
    } else {
        // console.log("No hay usuario logueado o usuario inválido");
    }
});

// Hacer funciones disponibles globalmente
window.initPoliticasModal = initPoliticasModal;
window.guardarAceptacionPoliticas = guardarAceptacionPoliticas;
window.cargarEstadoPoliticas = cargarEstadoPoliticas;
window.getCurrentUser = getCurrentUser;