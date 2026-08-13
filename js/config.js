// admin/js/config.js
window.APP_CONFIG = {
    IS_LOCALHOST: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    BASE_PATH: window.location.pathname.includes('/admin/') ? '../' : './',
    API_BASE: function() {
        return this.IS_LOCALHOST ? 'api/noticias.php' : '../api/noticias.php';
    }
};