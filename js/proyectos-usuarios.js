// ============================================
// PROYECTOS - USUARIOS
// Archivo: js/proyectos-usuarios.js
// Versión: 2.0
// Descripción: Gestión completa de proyectos asignados a usuarios
// ============================================

// ============================================
// VARIABLES GLOBALES
// ============================================
let usuarioProyectosActual = null;
let proyectosAsignadosLista = [];
let proyectosDisponiblesGlobal = [];

// ============================================
// FUNCIONES PRINCIPALES - MODAL PROYECTOS ASIGNADOS
// ============================================

/**
 * Abre el modal de proyectos asignados para un usuario
 * @param {number} usuarioId - ID del usuario
 * @param {string} usuarioNombre - Nombre del usuario
 * @param {string} usuarioEmail - Email del usuario (opcional)
 */
async function abrirModalProyectosAsignados(usuarioId, usuarioNombre, usuarioEmail = '') {
    usuarioProyectosActual = usuarioId;
    
    // Mostrar información del usuario
    const userInfoDiv = document.getElementById('proyectos-user-info');
    if (userInfoDiv) {
        userInfoDiv.innerHTML = `
            <div class="user-avatar-large">
                <i class="fas fa-user-circle"></i>
            </div>
            <div class="user-info-details">
                <h4>${escapeHtml(usuarioNombre)}</h4>
                <p><i class="fas fa-envelope"></i> ${escapeHtml(usuarioEmail) || 'Email no registrado'}</p>
                <p><i class="fas fa-id-card"></i> ID: ${usuarioId}</p>
            </div>
        `;
    }
    
    // Cargar proyectos asignados
    await cargarProyectosAsignados(usuarioId);
    
    // Mostrar modal
    const modal = document.getElementById('proyectos-asignados-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Carga los proyectos asignados a un usuario desde el servidor
 * @param {number} usuarioId - ID del usuario
 */
async function cargarProyectosAsignados(usuarioId) {
    const container = document.getElementById('proyectos-lista');
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Cargando proyectos...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`./api/get_proyectos_usuario.php?usuario_id=${usuarioId}`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) throw new Error('Error al cargar proyectos');
        
        const data = await response.json();
        
        if (data.success && data.proyectos && data.proyectos.length > 0) {
            proyectosAsignadosLista = data.proyectos;
            mostrarProyectosAsignados(data.proyectos);
            
            // Actualizar estadísticas
            const totalProyectosSpan = document.getElementById('total-proyectos');
            const totalColaboradoresSpan = document.getElementById('total-colaboradores');
            
            if (totalProyectosSpan) totalProyectosSpan.textContent = data.proyectos.length;
            
            const rolesUnicos = [...new Set(data.proyectos.map(p => p.rol_proyecto))];
            if (totalColaboradoresSpan) totalColaboradoresSpan.textContent = rolesUnicos.length;
        } else {
            container.innerHTML = `
                <div class="empty-state-proyectos">
                    <i class="fas fa-folder-open"></i>
                    <h4>No hay proyectos asignados</h4>
                    <p>Este usuario aún no tiene proyectos asignados.</p>
                    <button class="btn-assign-new" onclick="abrirModalAsignarProyectoDesdeAsignados()">
                        <i class="fas fa-plus-circle"></i> Asignar primer proyecto
                    </button>
                </div>
            `;
            
            const totalProyectosSpan = document.getElementById('total-proyectos');
            const totalColaboradoresSpan = document.getElementById('total-colaboradores');
            
            if (totalProyectosSpan) totalProyectosSpan.textContent = '0';
            if (totalColaboradoresSpan) totalColaboradoresSpan.textContent = '0';
        }
    } catch (error) {
        console.error('Error cargando proyectos:', error);
        container.innerHTML = `
            <div class="empty-state-proyectos error">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Error al cargar proyectos</h4>
                <p>No se pudieron cargar los proyectos asignados.</p>
                <button class="btn-retry" onclick="cargarProyectosAsignados(${usuarioId})">
                    <i class="fas fa-sync-alt"></i> Reintentar
                </button>
            </div>
        `;
    }
}

/**
 * Muestra los proyectos asignados en el modal
 * @param {Array} proyectos - Lista de proyectos asignados
 */
function mostrarProyectosAsignados(proyectos) {
    const container = document.getElementById('proyectos-lista');
    if (!container) return;
    
    if (!proyectos || proyectos.length === 0) {
        container.innerHTML = `
            <div class="empty-state-proyectos">
                <i class="fas fa-folder-open"></i>
                <h4>No hay proyectos asignados</h4>
                <p>Este usuario aún no tiene proyectos asignados.</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="proyectos-grid">';
    
    proyectos.forEach(proyecto => {
        const estadoIcon = getEstadoIcon(proyecto.estado);
        const estadoColor = getEstadoColor(proyecto.estado);
        
        html += `
            <div class="proyecto-card-modern" data-proyecto-id="${proyecto.id}">
                <div class="proyecto-header-modern">
                    <div class="proyecto-titulo">
                        <i class="fas ${estadoIcon}" style="color: ${estadoColor};"></i>
                        <h4>${escapeHtml(proyecto.nombre)}</h4>
                    </div>
                    <span class="rol-badge-modern rol-badge-${proyecto.rol_proyecto}">
                        <i class="fas ${getRolIcon(proyecto.rol_proyecto)}"></i>
                        ${getRolText(proyecto.rol_proyecto)}
                    </span>
                </div>
                
                <div class="proyecto-body-modern">
                    <div class="proyecto-detalles">
                        <div class="detalle-item">
                            <i class="fas fa-building"></i>
                            <strong>Cliente:</strong> ${escapeHtml(proyecto.cliente || 'N/A')}
                        </div>
                        <div class="detalle-item">
                            <i class="fas fa-chart-line"></i>
                            <strong>Estado:</strong>
                            <span class="estado-badge-modern estado-${proyecto.estado.toLowerCase()}" style="background: ${estadoColor}20; color: ${estadoColor};">
                                <i class="fas ${estadoIcon}"></i> ${proyecto.estado}
                            </span>
                        </div>
                        <div class="detalle-item">
                            <i class="fas fa-calendar-alt"></i>
                            <strong>Asignado:</strong> ${formatFecha(proyecto.fecha_asignacion)}
                        </div>
                        ${proyecto.descripcion ? `
                        <div class="detalle-item descripcion">
                            <i class="fas fa-align-left"></i>
                            <strong>Descripción:</strong>
                            <span>${escapeHtml(proyecto.descripcion.substring(0, 100))}${proyecto.descripcion.length > 100 ? '...' : ''}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="proyecto-footer-modern">
                    <button onclick="verDetallesProyecto(${proyecto.id})" class="btn-action btn-view-details" title="Ver detalles del proyecto">
                        <i class="fas fa-info-circle"></i> Detalles
                    </button>
                    <button onclick="editarRolProyecto(${usuarioProyectosActual}, ${proyecto.id}, '${proyecto.rol_proyecto}')" class="btn-action btn-edit-proyecto" title="Editar rol del usuario">
                        <i class="fas fa-edit"></i> Editar rol
                    </button>
                    <button onclick="removerProyectoAsignado(${usuarioProyectosActual}, ${proyecto.id}, '${escapeHtml(proyecto.nombre)}')" class="btn-action btn-remove-proyecto" title="Remover proyecto">
                        <i class="fas fa-trash-alt"></i> Remover
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// ============================================
// FUNCIÓN PARA REMOVER PROYECTO (VERSIÓN MEJORADA)
// ============================================

/**
 * Remueve un proyecto asignado a un usuario con confirmación
 * @param {number} usuarioId - ID del usuario
 * @param {number} proyectoId - ID del proyecto
 * @param {string} proyectoNombre - Nombre del proyecto
 */
async function removerProyectoAsignado(usuarioId, proyectoId, proyectoNombre) {
    // Mostrar confirmación con SweetAlert2
    const result = await Swal.fire({
        title: '¿Remover proyecto?',
        html: `
            <div style="text-align: center; padding: 10px;">
                <div style="background: linear-gradient(135deg, #dc3545, #c82333); 
                    width: 80px; height: 80px; border-radius: 50%; 
                    display: flex; align-items: center; justify-content: center; 
                    margin: 0 auto 20px;
                    animation: pulse 0.5s ease;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 40px; color: white;"></i>
                </div>
                <h3 style="color: #333; margin-bottom: 10px;">¿Estás seguro?</h3>
                <p style="color: #666; margin-bottom: 15px;">
                    Estás a punto de remover el proyecto <strong style="color: #dc3545;">"${escapeHtml(proyectoNombre)}"</strong>
                </p>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin-top: 15px;">
                    <p style="margin: 0; font-size: 13px; color: #666;">
                        <i class="fas fa-info-circle"></i> Esta acción eliminará al usuario de este proyecto.
                        Los datos no se perderán permanentemente.
                    </p>
                </div>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fas fa-trash-alt"></i> Sí, remover proyecto',
        cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
        reverseButtons: true,
        showClass: {
            popup: 'animate__animated animate__fadeInDown'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp'
        }
    });
    
    if (result.isConfirmed) {
        // Mostrar loading
        Swal.fire({
            title: 'Removiendo proyecto...',
            html: `
                <div style="text-align: center;">
                    <div class="spinner" style="margin: 20px auto;"></div>
                    <p style="color: #666;">Por favor espere, esto puede tomar unos segundos</p>
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false
        });
        
        try {
            const response = await fetch('./api/remover_proyecto_usuario.php', {
                method: 'POST',
                credentials: 'include',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ 
                    usuario_id: usuarioId, 
                    proyecto_id: proyectoId 
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                await Swal.fire({
                    icon: 'success',
                    title: '¡Proyecto removido!',
                    html: `
                        <div style="text-align: center; padding: 10px;">
                            <div style="background: linear-gradient(135deg, #28a745, #20c997); 
                                width: 80px; height: 80px; border-radius: 50%; 
                                display: flex; align-items: center; justify-content: center; 
                                margin: 0 auto 20px;">
                                <i class="fas fa-check" style="font-size: 40px; color: white;"></i>
                            </div>
                            <h4 style="color: #333; margin-bottom: 10px;">Operación exitosa</h4>
                            <p style="color: #666;">El proyecto ha sido removido correctamente</p>
                        </div>
                    `,
                    confirmButtonText: '<i class="fas fa-check"></i> Aceptar',
                    confirmButtonColor: '#28a745',
                    timer: 2000,
                    timerProgressBar: true
                });
                
                // Recargar la lista
                await cargarProyectosAsignados(usuarioId);
                await actualizarContadorProyectosEnTabla(usuarioId);
            } else {
                throw new Error(data.message || 'Error al remover el proyecto');
            }
        } catch (error) {
            console.error('Error:', error);
            await Swal.fire({
                icon: 'error',
                title: 'Error al remover proyecto',
                html: `
                    <div style="text-align: center; padding: 10px;">
                        <div style="background: linear-gradient(135deg, #dc3545, #c82333); 
                            width: 80px; height: 80px; border-radius: 50%; 
                            display: flex; align-items: center; justify-content: center; 
                            margin: 0 auto 20px;">
                            <i class="fas fa-exclamation-circle" style="font-size: 40px; color: white;"></i>
                        </div>
                        <h4 style="color: #333; margin-bottom: 10px;">No se pudo completar la operación</h4>
                        <p style="color: #dc3545; margin-bottom: 15px;">${error.message}</p>
                    </div>
                `,
                confirmButtonText: '<i class="fas fa-times"></i> Cerrar',
                confirmButtonColor: '#dc3545'
            });
        }
    }
}

// ============================================
// FUNCIONES PARA ASIGNAR PROYECTOS
// ============================================

/**
 * Abre el modal para asignar un proyecto a un usuario
 * @param {number} userId - ID del usuario
 * @param {string} userName - Nombre del usuario
 * @param {string} userEmail - Email del usuario
 */
async function abrirModalAsignarProyecto(userId, userName, userEmail = '') {
    try {
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
        Swal.close();
        
        if (proyectos.length === 0) {
            await Swal.fire({
                title: 'No hay proyectos disponibles',
                html: `
                    <div style="text-align: center; padding: 20px;">
                        <i class="fas fa-folder-open" style="font-size: 64px; color: #ffc107; margin-bottom: 20px;"></i>
                        <h4 style="color: #666;">No hay proyectos activos disponibles</h4>
                        <p style="color: #999;">No se encontraron proyectos para asignar a este usuario.</p>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        const options = proyectos.map(p => 
            `<option value="${p.id}" data-cliente="${escapeHtml(p.cliente || 'Sin cliente')}" data-estado="${p.estado}">
                🚀 ${escapeHtml(p.nombre)} - ${escapeHtml(p.cliente || 'Sin cliente')} (${p.estado})
            </option>`
        ).join('');

        const roles = [
            { value: 'manager', label: 'Manager', icon: 'fa-crown', color: '#ff9800', description: 'Control total del proyecto' },
            { value: 'miembro', label: 'Miembro', icon: 'fa-user-friends', color: '#4caf50', description: 'Participación activa' },
            { value: 'observador', label: 'Observador', icon: 'fa-eye', color: '#9e9e9e', description: 'Solo visualización' }
        ];

        const rolOptions = roles.map(rol => 
            `<option value="${rol.value}">
                <i class="fas ${rol.icon}" style="color: ${rol.color};"></i> ${rol.label}
            </option>`
        ).join('');

        const { value: result } = await Swal.fire({
            title: `
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <i class="fas fa-project-diagram" style="color: #4caf50; font-size: 28px;"></i>
                    <span>Asignar Proyecto</span>
                </div>
            `,
            html: `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    border-radius: 12px; padding: 15px; margin: 15px 0; color: white;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="background: rgba(255,255,255,0.2); width: 50px; height: 50px; 
                            border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-user-circle" style="font-size: 30px;"></i>
                        </div>
                        <div style="text-align: left; flex: 1;">
                            <strong style="font-size: 16px;">${escapeHtml(userName)}</strong>
                            <small style="display: block; opacity: 0.9;">ID: ${userId}</small>
                        </div>
                    </div>
                </div>

                <div style="margin: 20px 0; text-align: left;">
                    <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #333;">
                        <i class="fas fa-project-diagram" style="color: #4caf50;"></i> Proyecto a asignar
                    </label>
                    <select id="swal-proyectos" class="swal2-select" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;">
                        <option value="" disabled selected>-- Seleccione un proyecto --</option>
                        ${options}
                    </select>
                </div>

                <div style="margin: 20px 0; text-align: left;">
                    <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #333;">
                        <i class="fas fa-user-tag" style="color: #4caf50;"></i> Rol en el proyecto
                    </label>
                    <select id="swal-rol" class="swal2-select" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;">
                        ${rolOptions}
                    </select>
                    <div id="rol-descripcion" style="margin-top: 10px; padding: 8px; background: #e3f2fd; border-radius: 6px; font-size: 12px; color: #1976d2;">
                        <i class="fas fa-info-circle"></i> Los miembros pueden ver y editar tareas
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
            confirmButtonText: '<i class="fas fa-save"></i> Asignar Proyecto',
            confirmButtonColor: '#4caf50',
            cancelButtonColor: '#d33',
            preConfirm: () => {
                const proyectoId = document.getElementById('swal-proyectos').value;
                const rol = document.getElementById('swal-rol').value;
                
                if (!proyectoId) {
                    Swal.showValidationMessage('Por favor, selecciona un proyecto');
                    return false;
                }
                return { proyectoId, rol };
            },
            didOpen: () => {
                const rolSelect = document.getElementById('swal-rol');
                const descDiv = document.getElementById('rol-descripcion');
                const descripciones = {
                    manager: 'Control total: puede gestionar miembros, tareas y configuraciones',
                    miembro: 'Participación activa: puede ver y editar tareas',
                    observador: 'Solo visualización: puede ver el progreso pero no realizar cambios'
                };
                
                rolSelect.addEventListener('change', () => {
                    const desc = descripciones[rolSelect.value];
                    descDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${desc}`;
                });
            }
        });

        if (result && result.proyectoId) {
            Swal.fire({
                title: 'Asignando proyecto...',
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
                    proyecto_id: result.proyectoId, 
                    rol_proyecto: result.rol 
                })
            });
            
            const assignData = await assignResp.json();
            
            if (assignData.success) {
                await Swal.fire({
                    icon: 'success',
                    title: '¡Proyecto asignado!',
                    text: 'El proyecto ha sido asignado exitosamente',
                    confirmButtonText: 'Aceptar',
                    confirmButtonColor: '#4caf50',
                    timer: 2000
                });
                
                if (typeof loadUsers === 'function') {
                    loadUsers();
                }
                if (usuarioProyectosActual === userId) {
                    await cargarProyectosAsignados(userId);
                }
            } else {
                throw new Error(assignData.message || 'Error al asignar proyecto');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al asignar proyecto',
            confirmButtonColor: '#d33'
        });
    }
}

// ============================================
// FUNCIONES AUXILIARES Y UTILERÍAS
// ============================================

/**
 * Abre el modal de asignación desde el modal de proyectos
 */
function abrirModalAsignarProyectoDesdeAsignados() {
    if (usuarioProyectosActual) {
        const userInfoDiv = document.getElementById('proyectos-user-info');
        let userName = 'Usuario';
        if (userInfoDiv) {
            const nameElement = userInfoDiv.querySelector('h4');
            if (nameElement) userName = nameElement.textContent;
        }
        cerrarModalProyectosAsignados();
        abrirModalAsignarProyecto(usuarioProyectosActual, userName, '');
    }
}

/**
 * Cierra el modal de proyectos asignados
 */
function cerrarModalProyectosAsignados() {
    const modal = document.getElementById('proyectos-asignados-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        usuarioProyectosActual = null;
    }
}

/**
 * Muestra los detalles de un proyecto
 * @param {number} proyectoId - ID del proyecto
 */
function verDetallesProyecto(proyectoId) {
    const proyecto = proyectosAsignadosLista.find(p => p.id === proyectoId);
    if (proyecto) {
        Swal.fire({
            title: proyecto.nombre,
            html: `
                <div style="text-align: left;">
                    <p><strong><i class="fas fa-building"></i> Cliente:</strong> ${escapeHtml(proyecto.cliente || 'N/A')}</p>
                    <p><strong><i class="fas fa-chart-line"></i> Estado:</strong> ${proyecto.estado}</p>
                    <p><strong><i class="fas fa-calendar-alt"></i> Fecha inicio:</strong> ${formatFecha(proyecto.fecha_inicio) || 'N/A'}</p>
                    <p><strong><i class="fas fa-calendar-check"></i> Fecha fin:</strong> ${formatFecha(proyecto.fecha_fin) || 'N/A'}</p>
                    ${proyecto.presupuesto ? `<p><strong><i class="fas fa-dollar-sign"></i> Presupuesto:</strong> $${proyecto.presupuesto}</p>` : ''}
                    ${proyecto.descripcion ? `<p><strong><i class="fas fa-align-left"></i> Descripción:</strong><br>${escapeHtml(proyecto.descripcion)}</p>` : ''}
                </div>
            `,
            icon: 'info',
            confirmButtonText: '<i class="fas fa-check"></i> Cerrar',
            confirmButtonColor: '#17a2b8'
        });
    }
}

/**
 * Edita el rol de un usuario en un proyecto
 * @param {number} usuarioId - ID del usuario
 * @param {number} proyectoId - ID del proyecto
 * @param {string} rolActual - Rol actual del usuario
 */
async function editarRolProyecto(usuarioId, proyectoId, rolActual) {
    const roles = [
        { value: 'manager', label: 'Manager', icon: 'fa-crown', color: '#ff9800', desc: 'Control total del proyecto' },
        { value: 'miembro', label: 'Miembro', icon: 'fa-user-friends', color: '#4caf50', desc: 'Participación activa' },
        { value: 'observador', label: 'Observador', icon: 'fa-eye', color: '#9e9e9e', desc: 'Solo visualización' }
    ];

    const { value: nuevoRol } = await Swal.fire({
        title: 'Editar rol en el proyecto',
        html: `
            <div style="margin: 20px 0;">
                <label style="display: block; font-weight: 600; margin-bottom: 10px;">
                    <i class="fas fa-user-tag"></i> Seleccionar nuevo rol
                </label>
                <select id="nuevo-rol" class="swal2-select" style="width: 100%; padding: 12px; border-radius: 8px;">
                    ${roles.map(rol => `
                        <option value="${rol.value}" ${rolActual === rol.value ? 'selected' : ''}>
                            <i class="fas ${rol.icon}"></i> ${rol.label}
                        </option>
                    `).join('')}
                </select>
                <div id="rol-desc" style="margin-top: 10px; padding: 8px; background: #f8f9fa; border-radius: 6px; font-size: 13px;">
                    ${roles.find(r => r.value === rolActual)?.desc || ''}
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#ffc107',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fas fa-save"></i> Guardar cambios',
        cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
        preConfirm: () => {
            const rol = document.getElementById('nuevo-rol').value;
            return { rol };
        },
        didOpen: () => {
            const select = document.getElementById('nuevo-rol');
            const descDiv = document.getElementById('rol-desc');
            
            select.addEventListener('change', () => {
                const rol = roles.find(r => r.value === select.value);
                if (rol) descDiv.innerHTML = rol.desc;
            });
        }
    });
    
    if (nuevoRol && nuevoRol.rol !== rolActual) {
        Swal.fire({
            title: 'Actualizando rol...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        try {
            const response = await fetch('./api/actualizar_rol_proyecto.php', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuario_id: usuarioId,
                    proyecto_id: proyectoId,
                    rol_proyecto: nuevoRol.rol
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Rol actualizado',
                    text: 'El rol ha sido actualizado exitosamente',
                    confirmButtonColor: '#28a745',
                    timer: 1500
                });
                await cargarProyectosAsignados(usuarioId);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'No se pudo actualizar el rol',
                confirmButtonColor: '#dc3545'
            });
        }
    }
}

/**
 * Actualiza el contador de proyectos en la tabla principal
 * @param {number} usuarioId - ID del usuario
 */
async function actualizarContadorProyectosEnTabla(usuarioId) {
    try {
        const response = await fetch(`./api/get_proyectos_usuario.php?usuario_id=${usuarioId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        const count = data.success ? data.proyectos.length : 0;
        
        const botonGestion = document.querySelector(`button[onclick*="abrirModalProyectosAsignados(${usuarioId},"]`);
        if (botonGestion) {
            botonGestion.innerHTML = `<i class="fas fa-tasks"></i> Proyectos (${count})`;
        }
    } catch (error) {
        console.error('Error actualizando contador:', error);
    }
}

// ============================================
// FUNCIONES DE UTILERÍA
// ============================================

/**
 * Escapa caracteres HTML para prevenir XSS
 * @param {string} text - Texto a escapar
 * @returns {string}
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Obtiene el icono según el estado del proyecto
 * @param {string} estado - Estado del proyecto
 * @returns {string}
 */
function getEstadoIcon(estado) {
    const iconos = {
        'Activo': 'fa-play-circle',
        'Pausado': 'fa-pause-circle',
        'Completado': 'fa-check-circle',
        'Cancelado': 'fa-times-circle'
    };
    return iconos[estado] || 'fa-circle';
}

/**
 * Obtiene el color según el estado del proyecto
 * @param {string} estado - Estado del proyecto
 * @returns {string}
 */
function getEstadoColor(estado) {
    const colores = {
        'Activo': '#4caf50',
        'Pausado': '#ff9800',
        'Completado': '#2196f3',
        'Cancelado': '#f44336'
    };
    return colores[estado] || '#666';
}

/**
 * Obtiene el icono según el rol del usuario
 * @param {string} rol - Rol del usuario
 * @returns {string}
 */
function getRolIcon(rol) {
    const iconos = {
        'manager': 'fa-crown',
        'miembro': 'fa-user-friends',
        'observador': 'fa-eye'
    };
    return iconos[rol] || 'fa-user';
}

/**
 * Obtiene el texto según el rol del usuario
 * @param {string} rol - Rol del usuario
 * @returns {string}
 */
function getRolText(rol) {
    const textos = {
        'manager': 'Manager',
        'miembro': 'Miembro',
        'observador': 'Observador'
    };
    return textos[rol] || rol;
}

/**
 * Formatea una fecha para mostrar
 * @param {string} fechaString - Fecha en formato ISO
 * @returns {string}
 */
function formatFecha(fechaString) {
    if (!fechaString) return 'N/A';
    try {
        const fecha = new Date(fechaString);
        return fecha.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return fechaString;
    }
}

// ============================================
// EVENTOS GLOBALES
// ============================================

// Cerrar modal al hacer clic fuera
document.addEventListener('click', function(e) {
    const modal = document.getElementById('proyectos-asignados-modal');
    if (modal && e.target === modal) {
        cerrarModalProyectosAsignados();
    }
});

// Cerrar con tecla ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('proyectos-asignados-modal');
        if (modal && modal.style.display === 'block') {
            cerrarModalProyectosAsignados();
        }
    }
});

// ============================================
// EXPORTAR FUNCIONES (si se usa como módulo)
// ============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        abrirModalProyectosAsignados,
        cargarProyectosAsignados,
        removerProyectoAsignado,
        abrirModalAsignarProyecto,
        cerrarModalProyectosAsignados,
        verDetallesProyecto,
        editarRolProyecto
    };
}