// js/session-validator.js

/**
 * Valida si el usuario tiene sesión activa.
 * @param {string[]} [allowedRoles] - Lista de roles permitidos (opcional).
 * @param {string} [redirectUrl='index.html'] - URL a redirigir si falla.
 * @returns {object|null} - Objeto user si es válido, null si no.
 */
function validateSession(allowedRoles = null, redirectUrl = 'index.html') {
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user) {
        Swal.fire({
            icon: 'error',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            willClose: () => { window.location.href = redirectUrl; }
        }).catch(() => { window.location.href = redirectUrl; });
        return null;
    }
    
    if (allowedRoles && allowedRoles.length > 0) {
        const userRole = user.role?.toLowerCase();
        const hasRole = allowedRoles.some(role => userRole === role.toLowerCase());
        if (!hasRole) {
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta página.',
                willClose: () => { window.location.href = 'inicio.html'; }
            });
            return null;
        }
    }
    
    return user;
}

// Opcional: Si quieres que la sesión expire después de X tiempo (ej. 8 horas)
function checkSessionExpiration(expirationHours = 8) {
    const loginTime = localStorage.getItem('login_timestamp');
    if (loginTime) {
        const now = Date.now();
        const expired = now - parseInt(loginTime) > expirationHours * 60 * 60 * 1000;
        if (expired) {
            localStorage.removeItem('user');
            localStorage.removeItem('login_timestamp');
            validateSession(); // redirige al login
            return false;
        }
    }
    return true;
}