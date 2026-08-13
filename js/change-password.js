// change-password.js - Gestión del modal de cambio de contraseña

const PASSWORD_API_BASE = './api/cambio-password.php';

// Función específica para inicializar botones de visualización SOLO para el modal de cambio de contraseña
function initTogglePasswordButtons() {
    const modal = document.getElementById('change-password-modal');
    if (!modal) return;
    
    const toggleButtons = modal.querySelectorAll('.toggle-password');
    
    toggleButtons.forEach(btn => {
        // Remover event listeners existentes para evitar duplicados
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const targetId = this.dataset.target;
            const input = document.getElementById(targetId);
            const icon = this.querySelector('i');
            
            if (input && icon) {
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                    this.setAttribute('title', 'Ocultar contraseña');
                } else {
                    input.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                    this.setAttribute('title', 'Mostrar contraseña');
                }
            }
        });
    });
}

// Función para mostrar el modal de cambio de contraseña
function showChangePasswordModal(userId = null, isFirstTime = false, isAdminAction = false) {
    const modal = document.getElementById('change-password-modal');
    const form = document.getElementById('change-password-form');
    const currentPasswordField = document.getElementById('current-password');
    const currentPasswordContainer = currentPasswordField ? currentPasswordField.closest('.form-group') : null;
    
    if (!modal || !form) {
        console.error('Modal o formulario no encontrado');
        if (typeof showErrorToast === 'function') {
            showErrorToast('Error: No se pudo cargar el formulario de cambio de contraseña');
        }
        return;
    }
    
    // Eliminar mensajes informativos previos
    const existingAdminInfo = modal.querySelector('.admin-info');
    if (existingAdminInfo) existingAdminInfo.remove();
    const existingRecoveryInfo = modal.querySelector('.recovery-info');
    if (existingRecoveryInfo) existingRecoveryInfo.remove();
    
    // Configurar para diferentes escenarios
    if (isFirstTime || isAdminAction) {
        if (isAdminAction) {
            modal.querySelector('h3').textContent = 'Restablecer Contraseña (Admin)';
        } else {
            modal.querySelector('h3').textContent = 'Establecer Nueva Contraseña';
        }
        
        if (currentPasswordContainer) currentPasswordContainer.style.display = 'none';
        
        if (isAdminAction) {
            const adminInfo = document.createElement('div');
            adminInfo.className = 'admin-info';
            adminInfo.innerHTML = '<p style="color: #3498db; font-size: 14px; margin-bottom: 15px;"><i class="fas fa-info-circle"></i> Como administrador, está restableciendo la contraseña del usuario. Se le solicitará cambiarla en su próximo inicio de sesión.</p>';
            const modalHeader = modal.querySelector('.modal-header');
            if (modalHeader) {
                modalHeader.parentNode.insertBefore(adminInfo, modalHeader.nextSibling);
            }
        }
    } else {
        modal.querySelector('h3').textContent = 'Cambiar Contraseña';
        
        if (currentPasswordContainer) currentPasswordContainer.style.display = 'none';
        
        const recoveryInfo = document.createElement('div');
        recoveryInfo.className = 'recovery-info';
        recoveryInfo.innerHTML = '<p style="color: #3498db; font-size: 14px; margin-bottom: 15px;"><i class="fas fa-info-circle"></i> Establezca su nueva contraseña.</p>';
        
        const modalHeader = modal.querySelector('.modal-header');
        if (modalHeader) {
            modalHeader.parentNode.insertBefore(recoveryInfo, modalHeader.nextSibling);
        }
    }
    
    const currentUser = JSON.parse(localStorage.getItem('user'));
    form.dataset.userId = userId || (currentUser ? currentUser.id : null);
    form.dataset.isFirstTime = isFirstTime;
    form.dataset.isAdminAction = isAdminAction;
    
    // Resetear formulario
    form.reset();
    const matchIndicator = document.getElementById('password-match');
    if (matchIndicator) matchIndicator.classList.add('hidden');
    
    const strengthBar = modal.querySelector('.strength-bar');
    const strengthText = modal.querySelector('.strength-text');
    if (strengthBar) strengthBar.style.width = '0%';
    if (strengthText) strengthText.textContent = 'Seguridad: Débil';
    
    // Asegurar que los campos de nueva contraseña estén visibles
    const newPasswordContainer = modal.querySelector('label[for="new-password"]')?.closest('.form-group');
    const confirmPasswordContainer = modal.querySelector('label[for="confirm-password"]')?.closest('.form-group');
    
    if (newPasswordContainer) newPasswordContainer.style.display = 'block';
    if (confirmPasswordContainer) confirmPasswordContainer.style.display = 'block';
    
    modal.style.display = 'block';
    
    // Re-inicializar los botones de visualización después de mostrar el modal
    initTogglePasswordButtons();
}

// Función para validar fortaleza de contraseña
function checkPasswordStrength(password) {
    let strength = 0;
    const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        numbers: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };
    
    strength = Object.values(requirements).filter(Boolean).length;
    
    return {
        strength: strength,
        requirements: requirements,
        percentage: (strength / 5) * 100
    };
}

// Función para actualizar la barra de fortaleza
function updatePasswordStrength(password) {
    const modal = document.getElementById('change-password-modal');
    if (!modal) return;
    
    const strengthInfo = checkPasswordStrength(password);
    const strengthBar = modal.querySelector('.strength-bar');
    const strengthText = modal.querySelector('.strength-text');
    
    if (!strengthBar || !strengthText) return;
    
    strengthBar.style.width = strengthInfo.percentage + '%';
    strengthBar.style.transition = 'all 0.3s ease';
    
    if (strengthInfo.strength <= 1) {
        strengthBar.style.backgroundColor = '#e74c3c';
        strengthText.textContent = 'Seguridad: Muy Débil';
    } else if (strengthInfo.strength <= 2) {
        strengthBar.style.backgroundColor = '#e74c3c';
        strengthText.textContent = 'Seguridad: Débil';
    } else if (strengthInfo.strength <= 3) {
        strengthBar.style.backgroundColor = '#f39c12';
        strengthText.textContent = 'Seguridad: Regular';
    } else if (strengthInfo.strength <= 4) {
        strengthBar.style.backgroundColor = '#3498db';
        strengthText.textContent = 'Seguridad: Buena';
    } else {
        strengthBar.style.backgroundColor = '#2ecc71';
        strengthText.textContent = 'Seguridad: Excelente';
    }
}

// Función para validar requisitos de contraseña
function validatePasswordRequirements(password) {
    const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        numbers: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };
    
    const missing = [];
    if (!requirements.length) missing.push('mínimo 8 caracteres');
    if (!requirements.uppercase) missing.push('una letra mayúscula');
    if (!requirements.lowercase) missing.push('una letra minúscula');
    if (!requirements.numbers) missing.push('un número');
    if (!requirements.special) missing.push('un carácter especial');
    
    return {
        isValid: Object.values(requirements).every(Boolean),
        missing: missing
    };
}

// Función para mostrar notificación de error
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

// Función para mostrar notificación de éxito
function showSuccessToast(message) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: message,
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
    } else {
        alert('Éxito: ' + message);
    }
}

// Función para inicializar eventos del modal
function initChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    const form = document.getElementById('change-password-form');
    
    if (!modal || !form) {
        console.error('Modal de cambio de contraseña no encontrado en el DOM');
        return;
    }
    
    const closeBtn = modal.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancel-password-change');
    const newPasswordInput = modal.querySelector('#new-password');
    const confirmPasswordInput = modal.querySelector('#confirm-password');
    
    // Cerrar modal
    function closeModal() {
        modal.style.display = 'none';
        if (form) form.reset();
        
        const matchIndicator = document.getElementById('password-match');
        if (matchIndicator) matchIndicator.classList.add('hidden');
        
        const strengthBar = modal.querySelector('.strength-bar');
        const strengthText = modal.querySelector('.strength-text');
        if (strengthBar) strengthBar.style.width = '0%';
        if (strengthText) strengthText.textContent = 'Seguridad: Débil';
        
        // Eliminar mensajes informativos si existen
        const adminInfo = modal.querySelector('.admin-info');
        if (adminInfo) {
            adminInfo.remove();
        }
        const recoveryInfo = modal.querySelector('.recovery-info');
        if (recoveryInfo) {
            recoveryInfo.remove();
        }
        
        // Restaurar campo de contraseña actual
        const currentPasswordContainer = document.getElementById('current-password')?.closest('.form-group');
        if (currentPasswordContainer) {
            currentPasswordContainer.style.display = 'block';
        }
    }
    
    // Eventos para cerrar modal
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
    
    // Cerrar al hacer clic fuera del modal
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Cerrar con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });
    
    // Inicializar botones de visualización
    initTogglePasswordButtons();
    
    // Validar fortaleza en tiempo real
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', (e) => {
            updatePasswordStrength(e.target.value);
        });
    }
    
    // Validar coincidencia de contraseñas en tiempo real
    if (confirmPasswordInput && newPasswordInput) {
        confirmPasswordInput.addEventListener('input', (e) => {
            const matchIndicator = document.getElementById('password-match');
            if (matchIndicator) {
                if (e.target.value !== newPasswordInput.value && e.target.value.length > 0) {
                    matchIndicator.classList.remove('hidden');
                } else {
                    matchIndicator.classList.add('hidden');
                }
            }
        });
        
        newPasswordInput.addEventListener('input', () => {
            const matchIndicator = document.getElementById('password-match');
            if (matchIndicator && confirmPasswordInput.value.length > 0) {
                if (confirmPasswordInput.value !== newPasswordInput.value) {
                    matchIndicator.classList.remove('hidden');
                } else {
                    matchIndicator.classList.add('hidden');
                }
            }
        });
    }
    
    // Enviar formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPassword = modal.querySelector('#new-password')?.value || '';
        const confirmPassword = modal.querySelector('#confirm-password')?.value || '';
        const userId = form.dataset.userId;
        const isFirstTime = form.dataset.isFirstTime === 'true';
        const isAdminAction = form.dataset.isAdminAction === 'true';
        
        if (!userId) {
            showErrorToast('Error: ID de usuario no válido');
            return;
        }
        
        if (!newPassword || !confirmPassword) {
            showErrorToast('Por favor, complete todos los campos');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showErrorToast('Las contraseñas no coinciden');
            return;
        }
        
        const passwordValidation = validatePasswordRequirements(newPassword);
        if (!passwordValidation.isValid) {
            showErrorToast(`La contraseña debe contener: ${passwordValidation.missing.join(', ')}`);
            return;
        }
        
        const submitBtn = document.getElementById('submit-password-change');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Cambiando...';
        submitBtn.disabled = true;
        
        try {
            const requestBody = {
                user_id: parseInt(userId),
                new_password: newPassword,
                is_first_time: isFirstTime,
                is_admin_action: isAdminAction
            };
            
            const response = await fetch(PASSWORD_API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                credentials: 'include'
            });
            
            const responseText = await response.text();
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (jsonError) {
                console.error('Error parseando JSON:', jsonError);
                throw new Error('Error en la respuesta del servidor');
            }
            
            if (!response.ok) {
                throw new Error(data.error || `Error: ${response.status} ${response.statusText}`);
            }
            
            if (data.success) {
                showSuccessToast(data.message || 'Contraseña cambiada exitosamente');
                
                const currentUser = JSON.parse(localStorage.getItem('user'));
                if (currentUser && currentUser.id == userId) {
                    currentUser.debe_cambiar_password = false;
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    
                    if (isFirstTime) {
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    } else {
                        closeModal();
                    }
                } else {
                    closeModal();
                }
            } else {
                throw new Error(data.error || 'Error al cambiar contraseña');
            }
            
        } catch (error) {
            console.error('Error cambiando contraseña:', error);
            
            let errorMessage = error.message;
            
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage = 'Error de conexión. Verifique su internet.';
            } else if (error.message.includes('401') || error.message.includes('No autorizado') || error.message.includes('inicie sesión')) {
                errorMessage = 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.';
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else if (error.message.includes('Solo puede cambiar su propia contraseña')) {
                errorMessage = 'No tiene permisos para cambiar esta contraseña.';
            } else if (error.message.includes('al menos 8 caracteres')) {
                errorMessage = 'La contraseña debe tener al menos 8 caracteres.';
            }
            
            showErrorToast(errorMessage);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Verificar si el usuario debe cambiar la contraseña al iniciar sesión
function checkPasswordChangeRequired() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        
        if (user && user.debe_cambiar_password) {
            setTimeout(() => {
                if (typeof showChangePasswordModal === 'function') {
                    showChangePasswordModal(user.id, true);
                }
            }, 1000);
        }
    } catch (error) {
        console.error('Error verificando cambio de contraseña:', error);
    }
}

// Función para forzar el cambio de contraseña (pública)
function forcePasswordChange(userId) {
    if (typeof showChangePasswordModal === 'function') {
        showChangePasswordModal(userId, true);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('change-password-modal')) {
        initChangePasswordModal();
        
        if (window.location.pathname.includes('admin.html') || 
            window.location.pathname.includes('dashboard.html') ||
            window.location.pathname === '/' ||
            window.location.pathname.includes('index.html')) {
            
            setTimeout(checkPasswordChangeRequired, 1500);
        }
    }
});

// Funciones globales
window.showChangePasswordModal = showChangePasswordModal;
window.forcePasswordChange = forcePasswordChange;
window.checkPasswordChangeRequired = checkPasswordChangeRequired;
window.initTogglePasswordButtons = initTogglePasswordButtons;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showChangePasswordModal,
        forcePasswordChange,
        checkPasswordChangeRequired,
        validatePasswordRequirements,
        checkPasswordStrength,
        initTogglePasswordButtons
    };
}