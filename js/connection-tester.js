// js/connection-tester.js - Diagnóstico de conexión
class ConnectionTester {
    constructor() {
        this.initialize();
    }

    initialize() {
       // console.log('🔌 ConnectionTester inicializado');
        this.setupFetchInterceptor();
        this.testConnectionOnLoad();
    }

    setupFetchInterceptor() {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            const method = args[1]?.method || 'GET';
            
           // console.log(`🌐 Fetch [${method}]:`, url);
            
            const startTime = Date.now();
            const result = originalFetch.apply(this, args);
            
            result.then(response => {
                const duration = Date.now() - startTime;
                //console.log(`✅ Fetch completado en ${duration}ms:`, response.status, url);
            }).catch(error => {
                const duration = Date.now() - startTime;
                console.error(`❌ Fetch falló en ${duration}ms:`, error.message, url);
                
                // Detectar error de extensión
                if (error.message.includes('establish connection') || 
                    error.message.includes('Failed to fetch')) {
                    console.warn('⚠️ ERROR POSIBLE DE EXTENSIÓN DETECTADO');
                    console.warn('Solución: Desactive AdBlock/uBlock y pruebe en modo incógnito');
                }
            });
            
            return result;
        };
    }

    async testConnection() {
       // console.log('🔍 Probando conexión con el servidor...');
        
        try {
            const response = await fetch('api/abonos-proyecto.php?action=crear', {
                method: 'OPTIONS',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const status = response.status;
            const success = status >= 200 && status < 300;
            
           // console.log(success ? '✅ Conexión exitosa' : '⚠️ Conexión con advertencia', 'Status:', status);
            
            return { success, status };
        } catch (error) {
            console.error('❌ No se pudo conectar con el servidor:', error.message);
            
            // Ofrecer ayuda específica
            this.sugerirSoluciones(error);
            
            return { success: false, error: error.message };
        }
    }

    sugerirSoluciones(error) {
        const solutions = document.createElement('div');
        solutions.className = 'alert alert-warning mt-3';
        solutions.innerHTML = `
            <h5><i class="fas fa-exclamation-triangle"></i> Problema de conexión detectado</h5>
            <p><strong>Error:</strong> ${error.message}</p>
            <h6>Posibles soluciones:</h6>
            <ul>
                <li><strong>1. Desactive extensiones del navegador</strong> (AdBlock, uBlock, etc.)</li>
                <li><strong>2. Intente en modo incógnito</strong> (Ctrl+Shift+N)</li>
                <li><strong>3. Verifique que el servidor esté funcionando</strong></li>
                <li><strong>4. Contacte al administrador del sistema</strong></li>
            </ul>
        `;
        
        // Insertar después del header si existe
        const header = document.querySelector('.header-section');
        if (header) {
            header.parentNode.insertBefore(solutions, header.nextSibling);
            
            // Auto-eliminar después de 30 segundos
            setTimeout(() => {
                if (solutions.parentNode) {
                    solutions.parentNode.removeChild(solutions);
                }
            }, 30000);
        }
    }

    testConnectionOnLoad() {
        // Esperar a que la página cargue completamente
        window.addEventListener('load', () => {
            setTimeout(() => {
                // Solo probar si estamos en la página de control de flujo
                if (document.querySelector('.control-flujo-container')) {
                    this.testConnection();
                }
            }, 3000);
        });
    }
}

// Inicializar automáticamente
document.addEventListener('DOMContentLoaded', () => {
    window.connectionTester = new ConnectionTester();
});