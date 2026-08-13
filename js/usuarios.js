// Add API base URL (use relative URL to avoid CORS issues)
const API_BASE = './api/usuarios.php';

// Variables globales para almacenar usuarios y filtros
let allUsers = [];
let filteredUsers = [];

// Funciones para la gestión de usuarios

// Cargar listado de usuarios
async function loadUsers() {
    try {
        const response = await fetch(API_BASE, {
            credentials: 'include'
        });

        if (!response.ok) {
            const errorText = await response.text();

            try {
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.error || `Error HTTP: ${response.status}`);
            } catch (e) {
                if (response.status === 401) {
                    throw new Error('Sesión expirada. Por favor, inicie sesión nuevamente.');
                } else if (response.status === 403) {
                    throw new Error('Acceso denegado. No tienes permisos de administrador.');
                } else {
                    throw new Error(`Error del servidor: ${response.status} - ${errorText.substring(0, 100)}`);
                }
            }
        }

        const data = await response.json();

        if (data.success) {
            allUsers = data.data;
            filteredUsers = [...allUsers];
            renderUsersList(filteredUsers);
            initSearch();
        } else {
            throw new Error(data.error || 'Error al cargar usuarios');
        }
    } catch (error) {
        console.error('Error:', error);

        let errorMessage = error.message;

        if (error.message.includes('Sesión expirada')) {
            showErrorToast('Sesión expirada. Redirigiendo al login...');
            setTimeout(() => {
                localStorage.removeItem('user');
                window.location.href = 'index.html';
            }, 2000);
            return;
        }

        if (error.message.includes('Acceso denegado')) {
            showErrorToast('Acceso denegado. No tienes permisos de administrador.');
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 2000);
            return;
        }

        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Error de conexión. Verifique su conexión a internet.';
        }

        showErrorToast(errorMessage);
    }
}

// Limitar número de proyectos mostrados
function limitProyectos(proyectosStr, max = 3) {
    if (!proyectosStr) return 'Ninguno';
    const proyectos = proyectosStr.split(', ');
    if (proyectos.length <= max) return proyectosStr;
    const primeros = proyectos.slice(0, max).join(', ');
    const restantes = proyectos.length - max;
    return `${primeros} +${restantes} más`;
}

// Inicializar búsqueda
function initSearch() {
    const searchInput = document.getElementById('search-users');
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterUsers(searchTerm);
        });
    }
}

// Filtrar usuarios
function filterUsers(searchTerm) {
    if (!searchTerm) {
        filteredUsers = [...allUsers];
    } else {
        filteredUsers = allUsers.filter(user =>
            (user.nombre && user.nombre.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm)) ||
            (user.cedula && user.cedula.toLowerCase().includes(searchTerm))
        );
    }
    renderUsersList(filteredUsers);
}

// Mostrar el listado de usuarios de forma responsive
function renderUsersList(users) {
    const container = document.getElementById('users-list');
    if (!container) {
        console.error('Elemento users-list no encontrado');
        return;
    }

    if (users.length === 0) {
        container.innerHTML = '<p>No hay usuarios registrados.</p>';
        return;
    }

    // Para móviles mostramos cards, para desktop mostramos tabla
    if (window.innerWidth < 768) {
        renderUsersCards(users);
    } else {
        renderUsersTable(users);
    }

    // Agregar evento para redimensionamiento
    window.addEventListener('resize', () => {
        if (window.innerWidth < 768) {
            renderUsersCards(users);
        } else {
            renderUsersTable(users);
        }
    });
}

// Renderizar como tabla para desktop (solo datos esenciales)
function renderUsersTable(users) {
    const container = document.getElementById('users-list');
    container.innerHTML = `
        <div class="table-responsive">
            <table class="users-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Cédula</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                           <td data-label="Nombre">
                            <div class="user-info-compact">
                                <strong>${escapeHtml(user.nombre)}</strong>
                                ${user.cargo ? `<br><small>${escapeHtml(user.cargo)}</small>` : ''}
                                ${user.proyectos_asignados ? `<br><small class="proyectos-asignados"><i class="fas fa-folder-open"></i> ${limitProyectos(user.proyectos_asignados)}</small>` : ''}
                            </div>
                        </td>
                            <td data-label="Email">${escapeHtml(user.email)}</td>
                            <td data-label="Cédula">${user.cedula || 'N/A'}</td>
                            <td data-label="Rol">
                                <span class="role-badge ${user.rol}">${user.rol}</span>
                            </td>
                            <td data-label="Estado">
                                <span class="status-badge ${user.Activo ? 'active' : 'inactive'}">
                                    ${user.Activo ? 'Activo' : 'Inactivo'}
                                </span>
                            </td>
                            <td data-label="Acciones">
                                <div class="action-buttons">
                                    <button class="btn-icon btn-edit" data-id="${user.id}" title="Editar">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-icon btn-projects" data-id="${user.id}" data-name="${escapeHtml(user.nombre)}" title="Gestionar Proyectos">
                                        <i class="fas fa-folder-open"></i>
                                    </button>
                                    <button class="btn-icon btn-delete" data-id="${user.id}" title="Eliminar">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                    <button class="btn-icon btn-change-password" data-id="${user.id}" title="Cambiar Contraseña">
                                        <i class="fas fa-key"></i>
                                    </button>
                                    <button class="btn-icon btn-signature" data-id="${user.id}" title="Generar Firma de Correo">
                                        <i class="fas fa-signature"></i>
                                    </button>
                                    <button class="btn-icon btn-credential" data-id="${user.id}" title="Generar Credencial">
                                        <i class="fas fa-id-card"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    addUserActionsEvents();
}

// Renderizar como cards para móviles (solo datos esenciales)
function renderUsersCards(users) {
    const container = document.getElementById('users-list');
    container.innerHTML = `
        <div class="users-cards">
            ${users.map(user => `
                <div class="user-card">
                    <div class="user-card-header">
                        <h3>${escapeHtml(user.nombre)}</h3>
                        <span class="user-role ${user.rol}">${user.rol}</span>
                    </div>
                    <div class="user-card-body">
                        <div class="user-info-item">
                            <span class="info-label">Email:</span>
                            <span class="info-value">${escapeHtml(user.email)}</span>
                        </div>
                        <div class="user-info-item">
                            <span class="info-label">Cédula:</span>
                            <span class="info-value">${user.cedula || 'N/A'}</span>
                        </div>
                        <div class="user-info-item">
                            <span class="info-label">Cargo:</span>
                            <span class="info-value">${user.cargo || 'N/A'}</span>
                        </div>
                        <div class="user-info-item">
                            <span class="info-label">Proyectos:</span>
                            <span class="info-value">${user.proyectos_asignados ? limitProyectos(user.proyectos_asignados) : 'Ninguno'}</span>
                        </div>
                        <div class="user-info-item">
                            <span class="info-label">Departamento:</span>
                            <span class="info-value">${user.departamento || 'N/A'}</span>
                        </div>
                        <div class="user-info-item">
                            <span class="info-label">Estado:</span>
                            <span class="info-value ${user.Activo ? 'active' : 'inactive'}">
                                ${user.Activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                    </div>
                    <div class="user-card-actions">
                        <button class="btn-icon btn-edit" data-id="${user.id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" data-id="${user.id}" title="Eliminar">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <button class="btn-icon btn-change-password" data-id="${user.id}" title="Cambiar Contraseña">
                            <i class="fas fa-key"></i>
                        </button>
                        <button class="btn-icon btn-signature" data-id="${user.id}" title="Generar Firma de Correo">
                            <i class="fas fa-signature"></i>
                        </button>
                        <button class="btn-icon btn-credential" data-id="${user.id}" title="Generar Credencial">
                            <i class="fas fa-id-card"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    addUserActionsEvents();
}

// Función adicional: mostrarUsuarios (tabla con conteo de proyectos y acciones)
function mostrarUsuarios(usuarios) {
    const container = document.getElementById('users-list');
    
    let html = `
        <div class="table-responsive">
            <table class="users-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Cédula</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Teléfono</th>
                        <th>Proyectos</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
    `;

    usuarios.forEach(usuario => {
        const tieneProyectos = usuario.proyectos_count > 0;
        const botonProyectos = tieneProyectos
            ? `<button class="btn-projects btn-proyectos" data-id="${usuario.id}" data-count="${usuario.proyectos_count}" title="Ver proyectos asignados">
                   <i class="fas fa-folder-open"></i> Ver (${usuario.proyectos_count})
               </button>`
            : `<button class="btn-projects btn-asignar" data-id="${usuario.id}" data-name="${escapeHtml(usuario.nombre)}" title="Asignar proyecto">
                   <i class="fas fa-plus-circle"></i> Asignar
               </button>`;

        html += `
            <tr>
                <td>${usuario.id}</td>
                <td>${escapeHtml(usuario.nombre)}</td>
                <td>${usuario.cedula || 'N/A'}</td>
                <td>${escapeHtml(usuario.email)}</td>
                <td><span class="rol-badge rol-${usuario.rol}">${usuario.rol}</span></td>
                <td>${usuario.telefono || 'N/A'}</td>
                <td class="proyectos-cell">${botonProyectos}</td>
                <td class="actions-cell">
                    <button class="btn-icon btn-edit" data-id="${usuario.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-change-password" data-id="${usuario.id}" title="Cambiar contraseña">
                        <i class="fas fa-key"></i>
                    </button>
                    <button class="btn-icon btn-toggle" data-id="${usuario.id}" data-active="${usuario.Activo}" title="${usuario.Activo ? 'Desactivar' : 'Activar'}">
                        <i class="fas ${usuario.Activo ? 'fa-user-check' : 'fa-user-slash'}"></i>
                    </button>
                    <button class="btn-icon btn-delete" data-id="${usuario.id}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    if (container) {
        container.innerHTML = html;
        // Añadir listeners para los botones de proyectos y para las acciones ya existentes
        addUserActionsEvents();

        // Listeners específicos para gestión de proyectos
        document.querySelectorAll('.btn-projects').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                const count = parseInt(btn.dataset.count || '0', 10);
                if (count > 0) {
                    abrirModalVerProyectos(id);
                } else {
                    abrirModalAsignarProyecto(id, btn.dataset.name || '');
                }
            });
        });

        document.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                const active = btn.dataset.active === '1' || btn.dataset.active === 'true' || btn.dataset.active === '1';
                toggleUsuarioEstado(id, active ? 0 : 1);
            });
        });
    }
}

// Función para cargar usuarios y adjuntar conteo de proyectos por usuario
async function cargarUsuarios() {
    try {
        const response = await fetch('api/get_usuarios.php', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const data = await response.json();
        
        if (data.success) {
            const usuariosConProyectos = await Promise.all(data.usuarios.map(async (usuario) => {
                try {
                    const proyectosResponse = await fetch(`api/get_proyectos_usuario.php?usuario_id=${usuario.id}`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    const proyectosData = await proyectosResponse.json();
                    usuario.proyectos_count = proyectosData.success ? proyectosData.proyectos.length : 0;
                } catch (e) {
                    usuario.proyectos_count = 0;
                }
                return usuario;
            }));
            
            mostrarUsuarios(usuariosConProyectos);
        } else {
            console.error('Error cargando usuarios:', data.message);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Abrir modal para ver proyectos asignados a un usuario (con opciones: asignar, editar rol, remover)
async function abrirModalVerProyectos(userId) {
    try {
        const resp = await fetch(`./api/get_proyectos_usuario.php?usuario_id=${userId}`, { credentials: 'include' });
        const text = await resp.text();

        if (!resp.ok) {
            console.error('Respuesta del servidor (no OK):', text);
            throw new Error(`Error HTTP ${resp.status}`);
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Respuesta no JSON al obtener proyectos:', text);
            showErrorToast('Respuesta inválida del servidor al obtener proyectos (ver consola)');
            return;
        }

        if (!data.success) {
            console.error('API devolvió error:', data);
            throw new Error(data.error || 'No se pudo obtener proyectos');
        }

        const proyectos = data.proyectos || [];

        const listaHtml = proyectos.length ? proyectos.map(p => `
            <li class="proyecto-item" data-id="${p.id}">
                <span class="proyecto-nombre">${escapeHtml(p.nombre)}</span>
                <small class="proyecto-rol">${escapeHtml(p.rol_proyecto || '')}</small>
                <div class="proyecto-actions">
                    <button class="btn-small btn-edit-rol" data-id="${p.id}" data-rol="${escapeHtml(p.rol_proyecto || '')}">Editar rol</button>
                    <button class="btn-small btn-remove-proyecto" data-id="${p.id}">Remover</button>
                </div>
            </li>
        `).join('') : '<li>No hay proyectos asignados</li>';

        const html = `
            <div class="swal-proyectos-wrapper">
                <div class="swal-proyectos-toolbar">
                    <button id="swal-asignar-btn" class="btn btn-primary swal-asignar-btn">Asignar proyecto</button>
                </div>
                <ul id="swal-proyectos-list" class="swal-proyectos-list">${listaHtml}</ul>
            </div>
        `;

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Proyectos asignados',
                html,
                showConfirmButton: false,
                didOpen: () => {
                    const container = Swal.getHtmlContainer();

                    // Asignar proyecto
                    const asignarBtn = container.querySelector('#swal-asignar-btn');
                    if (asignarBtn) {
                        asignarBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            abrirModalAsignarProyecto(userId, '');
                        });
                    }

                    // Remover proyecto
                    container.querySelectorAll('.btn-remove-proyecto').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            const proyectoId = btn.dataset.id;

                            // Confirmación con SweetAlert2
                            const confirmResult = await Swal.fire({
                                title: '¿Estás seguro?',
                                text: 'Se removerá la asignación del proyecto para este usuario.',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonText: 'Sí, remover',
                                cancelButtonText: 'Cancelar',
                                confirmButtonColor: '#d33'
                            });

                            if (!confirmResult.isConfirmed) return;

                            try {
                                // Mostrar loading mientras se procesa la solicitud
                                Swal.fire({
                                    title: 'Removiendo proyecto...',
                                    allowOutsideClick: false,
                                    didOpen: () => Swal.showLoading()
                                });

                                const res = await fetch('./api/remover_proyecto_usuario.php', {
                                    method: 'POST',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ usuario_id: userId, proyecto_id: proyectoId })
                                });

                                let d;
                                try {
                                    d = await res.json();
                                } catch (parseErr) {
                                    const text = await res.text();
                                    throw new Error('Respuesta inválida del servidor: ' + text);
                                }

                                Swal.close();

                                if (d.success) {
                                    await Swal.fire({
                                        icon: 'success',
                                        title: 'Proyecto removido',
                                        timer: 1600,
                                        showConfirmButton: false
                                    });
                                    abrirModalVerProyectos(userId);
                                } else {
                                    showErrorToast(d.message || 'Error al remover');
                                }
                            } catch (err) {
                                console.error('Error remover proyecto:', err);
                                Swal.close();
                                showErrorToast(err.message || 'Error al remover proyecto');
                            }
                        });
                    });

                    // Editar rol de asignación (usar select estilizado)
                    container.querySelectorAll('.btn-edit-rol').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            const proyectoId = btn.dataset.id;
                            const currentRol = btn.dataset.rol || 'miembro';
                            try {
                                const { value: selected } = await Swal.fire({
                                    title: 'Editar rol de proyecto',
                                    html: `
                                        <div class="swal-edit-row">
                                            <label class="swal-edit-label">Rol:</label>
                                            <select id="swal-edit-rol" class="swal2-select">
                                                <option value="manager">manager</option>
                                                <option value="miembro">miembro</option>
                                                <option value="observador">observador</option>
                                            </select>
                                        </div>
                                    `,
                                    didOpen: () => {
                                        const sel = Swal.getHtmlContainer().querySelector('#swal-edit-rol');
                                        if (sel) sel.value = currentRol;
                                    },
                                    preConfirm: () => document.getElementById('swal-edit-rol').value,
                                    showCancelButton: true
                                });

                                if (!selected) return;

                                const res = await fetch('./api/actualizar_rol_proyecto_usuario.php', {
                                    method: 'POST',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ usuario_id: userId, proyecto_id: proyectoId, rol_proyecto: selected })
                                });
                                const d = await res.json();
                                if (d.success) {
                                    showSuccessToast('Rol actualizado');
                                    abrirModalVerProyectos(userId);
                                } else {
                                    showErrorToast(d.message || d.error || 'Error al actualizar rol');
                                }
                            } catch (err) {
                                console.error('Error actualizar rol:', err);
                                showErrorToast('Error al actualizar rol');
                            }
                        });
                    });
                }
            });
        } else {
            // Fallback simple
            alert('Proyectos:\n' + proyectos.map(p => p.nombre).join('\n'));
        }
    } catch (error) {
        console.error('Error ver proyectos:', error);
        showErrorToast(error.message || 'Error al cargar proyectos');
    }
}

// Abrir modal para asignar proyecto a un usuario (VERSIÓN MEJORADA)
async function abrirModalAsignarProyecto(userId, userName, userEmail = '') {
    try {
        // Mostrar loading mientras se cargan los proyectos
        Swal.fire({
            title: 'Cargando proyectos...',
            text: 'Por favor espere',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const resp = await fetch(`./api/get_proyectos_disponibles.php?usuario_id=${userId}`, { 
            credentials: 'include' 
        });
        
        if (!resp.ok) throw new Error('Error al obtener proyectos disponibles');
        const data = await resp.json();
        
        if (!data.success) throw new Error(data.error || data.message || 'No se pudo obtener proyectos');

        const proyectos = data.proyectos || [];
        
        // Cerrar loading
        Swal.close();
        
        // Verificar si hay proyectos disponibles
        if (proyectos.length === 0) {
            await Swal.fire({
                title: 'No hay proyectos disponibles',
                html: `
                    <div class="no-proyectos-container" style="text-align: center; padding: 20px;">
                        <i class="fas fa-folder-open" style="font-size: 64px; color: #ffc107; margin-bottom: 20px;"></i>
                        <h4 style="color: #666; margin-bottom: 10px;">No hay proyectos activos disponibles</h4>
                        <p style="color: #999; margin-bottom: 15px;">No se encontraron proyectos para asignar a este usuario.</p>
                        <p class="text-muted" style="font-size: 13px; color: #6c757d;">
                            <i class="fas fa-info-circle"></i> Asegúrate de que existan proyectos activos en el sistema
                        </p>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: '<i class="fas fa-check"></i> Entendido',
                confirmButtonColor: '#3085d6',
                showCancelButton: false
            });
            return;
        }

        // Preparar opciones de proyectos con mejor formato
        const options = proyectos.map(p => 
            `<option value="${p.id}" data-cliente="${escapeHtml(p.cliente || 'Sin cliente')}" 
                    data-estado="${p.estado}" data-descripcion="${escapeHtml(p.descripcion || '')}">
                🚀 ${escapeHtml(p.nombre)} - ${escapeHtml(p.cliente || 'Sin cliente')} 
                <span style="color: ${getEstadoColor(p.estado)};">(${p.estado})</span>
            </option>`
        ).join('');

        // Definir roles con sus características
        const roles = [
            { 
                value: 'manager', 
                label: 'Manager', 
                icon: 'fa-crown', 
                color: '#ff9800',
                description: 'Control total del proyecto - Puede gestionar miembros, tareas y configuraciones',
                badge: 'Administrador del proyecto'
            },
            { 
                value: 'miembro', 
                label: 'Miembro', 
                icon: 'fa-user-friends', 
                color: '#4caf50',
                description: 'Participación activa - Puede ver y editar tareas, comentar y subir archivos',
                badge: 'Colaborador activo'
            },
            { 
                value: 'observador', 
                label: 'Observador', 
                icon: 'fa-eye', 
                color: '#9e9e9e',
                description: 'Solo visualización - Puede ver el progreso pero no realizar cambios',
                badge: 'Solo lectura'
            }
        ];

        const rolOptions = roles.map(rol => 
            `<option value="${rol.value}" data-icon="${rol.icon}" data-color="${rol.color}" data-description="${rol.description}">
                <i class="fas ${rol.icon}" style="color: ${rol.color};"></i> ${rol.label}
            </option>`
        ).join('');

        // Mostrar SweetAlert2 mejorado
        const { value: result } = await Swal.fire({
            title: `
                <div class="swal2-title-custom" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <i class="fas fa-project-diagram" style="color: #4caf50; font-size: 28px;"></i>
                    <span>Asignar Proyecto</span>
                </div>
            `,
            html: `
                <div class="swal2-user-info-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    border-radius: 12px; padding: 15px; margin: 15px 0; color: white; display: flex; 
                    align-items: center; gap: 15px;">
                    <div style="background: rgba(255,255,255,0.2); width: 60px; height: 60px; 
                        border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-user-circle" style="font-size: 40px;"></i>
                    </div>
                    <div style="text-align: left; flex: 1;">
                        <strong style="font-size: 16px; display: block; margin-bottom: 5px;">
                            ${escapeHtml(userName)}
                        </strong>
                        <small style="opacity: 0.9; display: block;">
                            <i class="fas fa-envelope"></i> ${escapeHtml(userEmail) || 'Email no registrado'}
                        </small>
                        <small style="opacity: 0.8; display: block;">
                            <i class="fas fa-id-card"></i> ID: ${userId}
                        </small>
                    </div>
                </div>

                <div class="swal2-form-group" style="margin: 20px 0; text-align: left;">
                    <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #333; font-size: 14px;">
                        <i class="fas fa-project-diagram" style="color: #4caf50; margin-right: 8px;"></i>
                        Proyecto a asignar
                    </label>
                    <select id="swal-proyectos" class="swal2-select" style="width: 100%; padding: 12px; 
                        border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; cursor: pointer;">
                        <option value="" disabled selected>-- Seleccione un proyecto --</option>
                        ${options}
                    </select>
                    
                    <!-- Preview del proyecto seleccionado -->
                    <div id="proyecto-preview" style="display: none; margin-top: 15px; 
                        background: #f8f9fa; border-radius: 10px; padding: 15px; 
                        border-left: 4px solid #4caf50; animation: slideDown 0.3s ease;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <i class="fas fa-info-circle" style="color: #4caf50;"></i>
                            <strong style="color: #333;">Detalles del proyecto</strong>
                        </div>
                        <div id="preview-content" style="font-size: 13px;"></div>
                    </div>
                </div>

                <div class="swal2-form-group" style="margin: 20px 0; text-align: left;">
                    <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #333; font-size: 14px;">
                        <i class="fas fa-user-tag" style="color: #4caf50; margin-right: 8px;"></i>
                        Rol en el proyecto
                    </label>
                    <select id="swal-rol" class="swal2-select" style="width: 100%; padding: 12px; 
                        border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; cursor: pointer;">
                        ${rolOptions}
                    </select>
                    
                    <!-- Información del rol seleccionado -->
                    <div id="rol-info-card" style="margin-top: 12px; padding: 12px; 
                        background: #e3f2fd; border-radius: 8px; font-size: 13px; 
                        display: flex; align-items: flex-start; gap: 10px;">
                        <i class="fas fa-info-circle" style="color: #1976d2; margin-top: 2px;"></i>
                        <div style="flex: 1;">
                            <div id="rol-badge" style="font-weight: 600; color: #1976d2; margin-bottom: 5px;">
                                Rol: Miembro
                            </div>
                            <div id="rol-description" style="color: #555; line-height: 1.4;">
                                Participación activa en el proyecto
                            </div>
                        </div>
                    </div>
                </div>

                <style>
                    @keyframes slideDown {
                        from {
                            opacity: 0;
                            transform: translateY(-10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    .swal2-select option {
                        padding: 10px;
                    }
                    
                    .swal2-select:hover {
                        border-color: #4caf50;
                    }
                    
                    .swal2-select:focus {
                        outline: none;
                        border-color: #4caf50;
                        box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
                    }
                </style>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
            confirmButtonText: '<i class="fas fa-save"></i> Asignar Proyecto',
            confirmButtonColor: '#4caf50',
            cancelButtonColor: '#d33',
            reverseButtons: true,
            width: '550px',
            padding: '1.5rem',
            preConfirm: () => {
                const proyectoId = document.getElementById('swal-proyectos').value;
                const rol = document.getElementById('swal-rol').value;
                
                if (!proyectoId) {
                    Swal.showValidationMessage('⚠️ Por favor, selecciona un proyecto');
                    return false;
                }
                
                if (!rol) {
                    Swal.showValidationMessage('⚠️ Por favor, selecciona un rol');
                    return false;
                }
                
                return { proyectoId, rol };
            },
            didOpen: () => {
                // Elementos del DOM
                const proyectoSelect = document.getElementById('swal-proyectos');
                const rolSelect = document.getElementById('swal-rol');
                const previewDiv = document.getElementById('proyecto-preview');
                const previewContent = document.getElementById('preview-content');
                const rolBadge = document.getElementById('rol-badge');
                const rolDescription = document.getElementById('rol-description');
                const rolInfoCard = document.getElementById('rol-info-card');
                
                // Función para actualizar preview del proyecto
                const updateProyectoPreview = () => {
                    const selectedOption = proyectoSelect.options[proyectoSelect.selectedIndex];
                    const proyectoId = proyectoSelect.value;
                    
                    if (proyectoId && selectedOption && selectedOption.value) {
                        const proyecto = proyectos.find(p => p.id == proyectoId);
                        if (proyecto) {
                            previewDiv.style.display = 'block';
                            const estadoColor = getEstadoColor(proyecto.estado);
                            previewContent.innerHTML = `
                                <div style="display: grid; gap: 8px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <i class="fas fa-tag" style="color: #666; width: 20px;"></i>
                                        <strong>Nombre:</strong> 
                                        <span>${escapeHtml(proyecto.nombre)}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <i class="fas fa-building" style="color: #666; width: 20px;"></i>
                                        <strong>Cliente:</strong> 
                                        <span>${escapeHtml(proyecto.cliente || 'N/A')}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <i class="fas fa-chart-line" style="color: #666; width: 20px;"></i>
                                        <strong>Estado:</strong> 
                                        <span style="color: ${estadoColor}; font-weight: 600;">
                                            ${proyecto.estado}
                                        </span>
                                    </div>
                                    ${proyecto.descripcion ? `
                                    <div style="display: flex; gap: 8px; margin-top: 5px;">
                                        <i class="fas fa-align-left" style="color: #666; width: 20px;"></i>
                                        <div>
                                            <strong>Descripción:</strong><br>
                                            <span style="font-size: 12px; color: #666;">
                                                ${escapeHtml(proyecto.descripcion.substring(0, 150))}${proyecto.descripcion.length > 150 ? '...' : ''}
                                            </span>
                                        </div>
                                    </div>
                                    ` : ''}
                                </div>
                            `;
                        }
                    } else {
                        previewDiv.style.display = 'none';
                    }
                };
                
                // Función para actualizar información del rol
                const updateRolInfo = () => {
                    const selectedRol = rolSelect.options[rolSelect.selectedIndex];
                    const rolValue = rolSelect.value;
                    const rolData = roles.find(r => r.value === rolValue);
                    
                    if (rolData) {
                        rolBadge.innerHTML = `<i class="fas ${rolData.icon}" style="color: ${rolData.color};"></i> Rol: ${rolData.label}`;
                        rolDescription.innerHTML = rolData.description;
                        rolInfoCard.style.background = `linear-gradient(135deg, ${rolData.color}10, ${rolData.color}05)`;
                        rolInfoCard.style.borderLeft = `3px solid ${rolData.color}`;
                    }
                };
                
                // Event listeners
                proyectoSelect.addEventListener('change', updateProyectoPreview);
                rolSelect.addEventListener('change', updateRolInfo);
                
                // Trigger inicial
                if (proyectoSelect.value) {
                    updateProyectoPreview();
                }
                updateRolInfo();
            }
        });

        // Procesar la asignación
        if (result && result.proyectoId) {
            const proyectoId = result.proyectoId;
            const rol = result.rol || 'miembro';
            
            // Mostrar loading mientras se asigna
            Swal.fire({
                title: 'Asignando proyecto...',
                text: 'Por favor espere',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            const assignResp = await fetch('./api/asignar_proyecto_usuario.php', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    usuario_id: userId, 
                    proyecto_id: proyectoId, 
                    rol_proyecto: rol 
                })
            });
            
            const assignData = await assignResp.json();
            
            if (assignData.success) {
                // Mostrar éxito con animación
                await Swal.fire({
                    icon: 'success',
                    title: '¡Proyecto asignado!',
                    html: `
                        <div style="text-align: center; padding: 10px;">
                            <i class="fas fa-check-circle" style="font-size: 64px; color: #4caf50; margin-bottom: 15px;"></i>
                            <p style="font-size: 16px; margin-bottom: 10px;">El proyecto ha sido asignado exitosamente</p>
                            <p style="font-size: 13px; color: #666;">
                                <i class="fas fa-user"></i> Usuario: ${escapeHtml(userName)}<br>
                                <i class="fas fa-tasks"></i> Rol: ${rol}
                            </p>
                        </div>
                    `,
                    confirmButtonText: '<i class="fas fa-check"></i> Aceptar',
                    confirmButtonColor: '#4caf50',
                    timer: 3000,
                    timerProgressBar: true
                });
                
                // Recargar la lista de usuarios
                if (typeof loadUsers === 'function') {
                    loadUsers();
                }
                
                // Actualizar contador de proyectos si existe la función
                if (typeof actualizarContadorProyectos === 'function') {
                    actualizarContadorProyectos(userId);
                }
            } else {
                throw new Error(assignData.error || assignData.message || 'Error al asignar proyecto');
            }
        }
    } catch (error) {
        console.error('Error en asignar proyecto:', error);
        
        // Mostrar error detallado
        await Swal.fire({
            icon: 'error',
            title: 'Error al asignar proyecto',
            html: `
                <div style="text-align: center; padding: 10px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #d33; margin-bottom: 15px;"></i>
                    <p style="font-size: 15px; margin-bottom: 10px;">${error.message || 'Ocurrió un error inesperado'}</p>
                    <p style="font-size: 13px; color: #666;">
                        <i class="fas fa-info-circle"></i> Verifica la conexión y vuelve a intentarlo
                    </p>
                </div>
            `,
            confirmButtonText: '<i class="fas fa-times"></i> Cerrar',
            confirmButtonColor: '#d33'
        });
    }
}

// Función auxiliar para obtener color según estado del proyecto
function getEstadoColor(estado) {
    const colores = {
        'Activo': '#4caf50',
        'Pausado': '#ff9800',
        'Completado': '#2196f3',
        'Cancelado': '#f44336'
    };
    return colores[estado] || '#666';
}

// Función auxiliar para escapar HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Alternar estado Activo del usuario
async function toggleUsuarioEstado(userId, nuevoEstado) {
    try {
        const form = new FormData();
        form.append('id', userId);
        form.append('Activo', nuevoEstado ? '1' : '0');

        const resp = await fetch(API_BASE, {
            method: 'POST',
            credentials: 'include',
            body: form
        });
        const data = await resp.json();
        if (data.success) {
            showSuccessToast(data.message || 'Estado actualizado');
            loadUsers();
        } else {
            throw new Error(data.error || 'Error al actualizar estado');
        }
    } catch (error) {
        console.error('Error toggle estado:', error);
        showErrorToast(error.message || 'Error al cambiar estado');
    }
}

// Función para escapar HTML (seguridad)
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Agregar eventos a los botones de acciones
function addUserActionsEvents() {
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            editUser(btn.dataset.id);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            deleteUser(btn.dataset.id);
        });
    });

    document.querySelectorAll('.btn-change-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof showChangePasswordModal === 'function') {
                const currentUser = JSON.parse(localStorage.getItem('user'));
                const isAdmin = currentUser && currentUser.role === 'admin';
                const targetUserId = btn.dataset.id;
                const isChangingOwnPassword = currentUser && currentUser.id == targetUserId;

                showChangePasswordModal(
                    targetUserId,
                    false,
                    isAdmin && !isChangingOwnPassword
                );
            } else {
                console.error('showChangePasswordModal no está definida');
                showErrorToast('Función de cambio de contraseña no disponible');
            }
        });

        // Botón de gestión de proyectos (aparece en la columna Acciones)
        document.querySelectorAll('.btn-projects').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                // Abrir la vista de proyectos; la función consultará si tiene o no proyectos
                abrirModalVerProyectos(id);
            });
        });
    });

    // Nuevos eventos para firma y credencial - ahora usando credenciales.js
    document.querySelectorAll('.btn-signature').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            generateSignatureFromCredenciales(btn.dataset.id);
        });
    });

    document.querySelectorAll('.btn-credential').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            generateCredentialFromCredenciales(btn.dataset.id);
        });
    });
}

// Mostrar notificación de error con SweetAlert2
function showErrorToast(message) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: message,
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true
        });
    } else {
        alert('Error: ' + message);
    }
}

// Funciones mejoradas de Toast
function showSuccessToast(message) {
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
    
    Toast.fire({
        icon: 'success',
        title: message,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        iconColor: 'white'
    });
}

function showErrorToast(message) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
    
    Toast.fire({
        icon: 'error',
        title: message,
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: 'white',
        iconColor: 'white'
    });
}


// Función para depurar datos del FormData
function debugFormData(formData) {
    
    for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
    }

}

// Inicializar eventos del formulario
function initFormEvents() {
    // Mostrar formulario para nuevo usuario en modal
    const showFormBtn = document.getElementById('show-user-form');
    if (showFormBtn) {
        showFormBtn.addEventListener('click', () => {
            const form = document.getElementById('user-form');
            const passwordInput = document.getElementById('user-password');
            const passwordLabel = document.querySelector('label[for="user-password"]');
            const passwordContainer = passwordInput ? passwordInput.closest('.form-group') : null;

            if (form) {
                form.reset();
                document.getElementById('photo-preview').innerHTML = '';
                
                // Configurar para NUEVO usuario
                form.dataset.mode = 'new';
                delete form.dataset.userId;
                
                // HABILITAR el campo de contraseña
                if (passwordInput) {
                    passwordInput.required = true;
                    passwordInput.disabled = false;
                    passwordInput.readOnly = false;
                    passwordInput.value = '';
                    passwordInput.placeholder = 'Ingrese una contraseña';
                    
                    // Asegurar que el contenedor esté visible
                    if (passwordContainer) {
                        passwordContainer.style.display = 'block';
                    }
                }

                // Actualizar título del modal
                document.getElementById('user-form-title').textContent = 'Crear Nuevo Usuario';

                // Establecer valor por defecto para el rol
                const roleSelect = document.getElementById('user-role');
                if (roleSelect) {
                    roleSelect.value = 'regular';
                }
                
                // Remover cualquier mensaje de advertencia
                const existingWarning = document.querySelector('.password-warning');
                if (existingWarning) existingWarning.remove();
            }

            // Mostrar modal
            document.getElementById('user-form-modal').style.display = 'block';
        });
    }

    // Cancelar formulario
    const cancelFormBtn = document.getElementById('cancel-user-form');
    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', () => {
            const form = document.getElementById('user-form');
            if (form) {
                delete form.dataset.userId;
            }
            // Ocultar modal
            document.getElementById('user-form-modal').style.display = 'none';
        });
    }

    // Vista previa de foto
    const photoInput = document.getElementById('user-photo');
    if (photoInput) {
        photoInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            const preview = document.getElementById('photo-preview');
            preview.innerHTML = '';

            if (file) {
                const validTypes = ['image/jpeg', 'image/png'];
                if (!validTypes.includes(file.type)) {
                    showErrorToast('Solo se permiten imágenes JPG o PNG');
                    e.target.value = '';
                    return;
                }

                if (file.size > 2 * 1024 * 1024) {
                    showErrorToast('La imagen no puede superar los 2MB');
                    e.target.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = function (event) {
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    img.style.maxHeight = '150px';
                    img.style.maxWidth = '150px';
                    img.style.borderRadius = '5px';
                    preview.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Enviar formulario de usuario
    const userForm = document.getElementById('user-form');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const form = document.getElementById('user-form');
            const isEdit = form.dataset.mode === 'edit';
            const userId = form.dataset.userId;

            // Verificar que los elementos existen antes de usarlos
            const formElements = {
                phone: document.getElementById('user-phone'),
                expiration: document.getElementById('user-expiration'),
                name: document.getElementById('user-name'),
                email: document.getElementById('user-email'),
                password: document.getElementById('user-password'),
                role: document.getElementById('user-role'),
                position: document.getElementById('user-position'),
                department: document.getElementById('user-department'),
                photo: document.getElementById('user-photo'),
                cedula: document.getElementById('user-cedula'),
                bloodType: document.getElementById('user-blood-type'),
                allergies: document.getElementById('user-allergies'),
                medicines: document.getElementById('user-medicines'),
                active: document.getElementById('user-active'),
                changePassword: document.getElementById('user-change-password')
            };

            // Validar que todos los elementos existen
            for (const [key, element] of Object.entries(formElements)) {
                if (!element && !['photo', 'active', 'changePassword'].includes(key)) {
                    showErrorToast(`Error: Elemento ${key} no encontrado`);
                    return;
                }
            }

            // Validar teléfono
            const telefono = formElements.phone.value;
            if (!/^04\d{9}$/.test(telefono)) {
                showErrorToast('El teléfono debe comenzar con 04 y tener 11 dígitos');
                return;
            }

            // Validar cédula
            const cedula = formElements.cedula.value;
            if (cedula && !/^[VE]\d+$/i.test(cedula)) {
                showErrorToast('La cédula debe comenzar con V o E seguido de números');
                return;
            }

            // Validar fecha de vencimiento
            const expiration = new Date(formElements.expiration.value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (expiration < today) {
                showErrorToast('La fecha de vencimiento no puede ser anterior a hoy');
                return;
            }

            // Validar contraseña para nuevos usuarios
            const isNew = !isEdit;
            if (isNew && (!formElements.password.value || formElements.password.value.length < 8)) {
                showErrorToast('La contraseña es requerida y debe tener al menos 8 caracteres para nuevos usuarios');
                return;
            }

            // Si es edición y se proporcionó contraseña, validar longitud
            if (isEdit && formElements.password.value && formElements.password.value.length < 8) {
                showErrorToast('La contraseña debe tener al menos 8 caracteres');
                return;
            }

            // Preparar datos del formulario
            const formData = new FormData();
            formData.append('nombre', formElements.name.value);
            formData.append('email', formElements.email.value);
            formData.append('telefono', telefono);
            formData.append('fecha_vencimiento', formElements.expiration.value);
            formData.append('rol', formElements.role.value);
            formData.append('cargo', formElements.position.value);
            formData.append('departamento', formElements.department.value);
            formData.append('cedula', cedula);
            formData.append('TipoSangre', formElements.bloodType.value);
            formData.append('alergias', formElements.allergies.value);
            formData.append('medicinas', formElements.medicines.value);
            formData.append('Activo', formElements.active.checked ? '1' : '0');
            formData.append('debe_cambiar_password', formElements.changePassword.checked ? '1' : '0');

            // Solo agregar password si es nuevo usuario O si se ingresó una nueva contraseña en edición
            if (isNew) {
                // Nuevo usuario: contraseña obligatoria
                formData.append('password', formElements.password.value);
            } else if (formElements.password.value) {
                // Edición: solo si se proporcionó una nueva contraseña
                formData.append('password', formElements.password.value);
            }

            // Si es edición, agregar el ID del usuario
            if (isEdit) {
                formData.append('id', userId);
            }

            // Agregar foto si se seleccionó
            if (formElements.photo.files.length > 0) {
                formData.append('foto', formElements.photo.files[0]);
            }

            try {
                const response = await fetch(API_BASE, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                const responseText = await response.text();
                if (!response.ok) {
                    try {
                        const errorData = JSON.parse(responseText);
                        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                    } catch (e) {
                        throw new Error(`Error del servidor: ${response.status} - ${responseText.substring(0, 200)}`);
                    }
                }

                const data = JSON.parse(responseText);

                if (data.success) {
                    showSuccessToast(data.message || 'Usuario guardado correctamente');

                    // Ocultar modal
                    document.getElementById('user-form-modal').style.display = 'none';

                    delete form.dataset.userId;
                    loadUsers();
                } else {
                    throw new Error(data.error || 'Error al guardar usuario');
                }
            } catch (error) {
                console.error('Error completo:', error);
                console.error('Stack trace:', error.stack);
                showErrorToast(error.message);
            }
        });
    }
}

// Editar usuario (ahora en modal)
async function editUser(userId) {
    try {
        const response = await fetch(`${API_BASE}?id=${userId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            const user = result.data;

            // Verificar que los elementos existen antes de usarlos
            const elements = {
                name: document.getElementById('user-name'),
                email: document.getElementById('user-email'),
                phone: document.getElementById('user-phone'),
                role: document.getElementById('user-role'),
                position: document.getElementById('user-position'),
                department: document.getElementById('user-department'),
                expiration: document.getElementById('user-expiration'),
                preview: document.getElementById('photo-preview'),
                cedula: document.getElementById('user-cedula'),
                bloodType: document.getElementById('user-blood-type'),
                allergies: document.getElementById('user-allergies'),
                medicines: document.getElementById('user-medicines'),
                active: document.getElementById('user-active'),
                changePassword: document.getElementById('user-change-password'),
                password: document.getElementById('user-password')  // Añadido el campo password
            };

            // Validar que todos los elementos existen
            for (const [key, element] of Object.entries(elements)) {
                if (!element && !['preview', 'active', 'changePassword'].includes(key)) {
                    console.error(`Elemento ${key} no encontrado`);
                    showErrorToast(`Error: Elemento ${key} no encontrado`);
                    return;
                }
            }

            // Asignar valores
            elements.name.value = user.nombre || '';
            elements.email.value = user.email || '';
            elements.phone.value = user.telefono || '';

            if (elements.role) {
                elements.role.value = user.rol || '';
            }

            elements.position.value = user.cargo || '';
            elements.department.value = user.departamento || '';
            elements.expiration.value = user.fecha_vencimiento ? user.fecha_vencimiento.split(' ')[0] : '';
            elements.cedula.value = user.cedula || '';
            elements.bloodType.value = user.TipoSangre || '';
            elements.allergies.value = user.Alergias || '';
            elements.medicines.value = user.Medicinas || '';
            elements.active.checked = user.Activo == 1;
            elements.changePassword.checked = user.debe_cambiar_password == 1;
            
            // CONFIGURAR CAMPO DE CONTRASEÑA PARA EDICIÓN
            if (elements.password) {
                // Deshabilitar el campo de contraseña en edición (opcional)
                elements.password.required = false;
                elements.password.disabled = false;  // Lo dejamos habilitado pero no requerido
                elements.password.readOnly = false;
                elements.password.value = '';
                elements.password.placeholder = 'Dejar vacío para mantener la actual';
                
                // Mostrar un mensaje indicativo
                const passwordContainer = elements.password.closest('.form-group');
                if (passwordContainer) {
                    // Remover mensaje anterior si existe
                    const existingMsg = passwordContainer.querySelector('.password-edit-info');
                    if (existingMsg) existingMsg.remove();
                    
                    // Agregar mensaje informativo
                    const infoMsg = document.createElement('small');
                    infoMsg.className = 'password-edit-info';
                    infoMsg.style.color = '#3498db';
                    infoMsg.style.display = 'block';
                    infoMsg.style.marginTop = '5px';
                    infoMsg.innerHTML = '<i class="fas fa-info-circle"></i> Dejar vacío para mantener la contraseña actual. Solo completar si desea cambiarla.';
                    passwordContainer.appendChild(infoMsg);
                }
            }

            // Mostrar foto si existe
            if (user.foto_base64) {
                elements.preview.innerHTML = `<img src="${user.foto_base64}" style="max-height: 150px; max-width: 150px; border-radius: 5px;">`;
            } else {
                elements.preview.innerHTML = '<p>No hay foto cargada</p>';
            }

            // Mostrar modal y configurar para edición
            document.getElementById('user-form-modal').style.display = 'block';
            document.getElementById('user-form-title').textContent = 'Editar Usuario';

            // Establecer el ID del usuario en el formulario y el modo de edición
            const form = document.getElementById('user-form');
            form.dataset.mode = 'edit';
            form.dataset.userId = userId;

        } else {
            throw new Error(result.error || 'Error al cargar usuario');
        }
    } catch (error) {
        console.error('Error:', error);
        showErrorToast(error.message);
    }
}

// Eliminar usuario
async function deleteUser(userId) {
    const result = await Swal.fire({
        title: '¿Estás seguro de eliminar este usuario?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        customClass: {
            confirmButton: 'btn-danger',
            cancelButton: 'btn-cancel'
        }
    });

    if (!result.isConfirmed) return;

    try {
        const response = await fetch(`${API_BASE}?id=${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            showSuccessToast(data.message || 'Usuario eliminado correctamente');
            loadUsers();
        } else {
            throw new Error(data.error || 'Error al eliminar usuario');
        }
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        showErrorToast(error.message);
    }
}

// Función para limpiar el modal al cerrarlo
function cleanupUserFormModal() {
    const passwordInput = document.getElementById('user-password');
    if (passwordInput) {
        passwordInput.required = false;
        passwordInput.disabled = false;
        passwordInput.readOnly = false;
        passwordInput.value = '';
        passwordInput.placeholder = '';
    }
    
    // Remover mensajes informativos
    const infoMessages = document.querySelectorAll('.password-edit-info');
    infoMessages.forEach(msg => msg.remove());
}

// Modificar el evento de cierre del modal
const closeModalButtons = document.querySelectorAll('.close-modal, #cancel-user-form');
closeModalButtons.forEach(btn => {
    if (btn) {
        btn.addEventListener('click', () => {
            cleanupUserFormModal();
        });
    }
});

// Generar firma usando las funciones de credenciales.js
async function generateSignatureFromCredenciales(userId) {
    try {
        const response = await fetch(`${API_BASE}?id=${userId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            const userData = result.data;

            // Verificar que credenciales.js esté cargado
            if (typeof generateCredential !== 'function') {
                showErrorToast('La funcionalidad de credenciales no está disponible');
                return;
            }

            // Configurar el botón de descarga para este usuario específico
            const downloadBtn = document.getElementById('download-btn-usuarios');
            if (downloadBtn) {
                downloadBtn.onclick = () => {
                    if (typeof downloadCredential === 'function') {
                        downloadCredential(userData);
                    } else {
                        showErrorToast('Función de descarga no disponible');
                    }
                };
            }

            // Usar la función de credenciales.js para generar la firma
            generateCredential('signature', userData);

            // Mostrar el contenedor de preview
            document.getElementById('preview-container-usuarios').style.display = 'block';

        } else {
            throw new Error(result.error || 'Error al cargar usuario');
        }
    } catch (error) {
        console.error('Error:', error);
        showErrorToast(error.message);
    }
}

// Generar credencial usando las funciones de credenciales.js
async function generateCredentialFromCredenciales(userId) {
    try {
        const response = await fetch(`${API_BASE}?id=${userId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            const userData = result.data;

            // Verificar que credenciales.js esté cargado
            if (typeof generateCredential !== 'function') {
                showErrorToast('La funcionalidad de credenciales no está disponible');
                return;
            }

            // Configurar el botón de descarga para este usuario específico
            const downloadBtn = document.getElementById('download-btn-usuarios');
            if (downloadBtn) {
                downloadBtn.onclick = () => {
                    if (typeof downloadCredential === 'function') {
                        downloadCredential(userData);
                    } else {
                        showErrorToast('Función de descarga no disponible');
                    }
                };
            }

            // Usar la función de credenciales.js para generar la credencial
            generateCredential('card', userData);

            // Mostrar el contenedor de preview
            document.getElementById('preview-container-usuarios').style.display = 'block';

        } else {
            throw new Error(result.error || 'Error al cargar usuario');
        }
    } catch (error) {
        console.error('Error:', error);
        showErrorToast(error.message);
    }
}

// Inicializar la gestión de usuarios
function initUserManagement() {
    const user = JSON.parse(localStorage.getItem('user'));

    if (user && user.role === 'admin') {
        initFormEvents();
        loadUsers();
    } else {
        showErrorToast('No tienes permisos para acceder a esta página');
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 2000);
    }
}

// Hacer funciones globales para acceso desde HTML
window.initUserManagement = initUserManagement;
window.loadUsers = loadUsers;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.generateSignatureFromCredenciales = generateSignatureFromCredenciales;
window.generateCredentialFromCredenciales = generateCredentialFromCredenciales;
window.showErrorToast = showErrorToast;
window.showSuccessToast = showSuccessToast;

// Inicializar cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function () {
    // console.log('DOM completamente cargado, inicializando usuarios...');
});