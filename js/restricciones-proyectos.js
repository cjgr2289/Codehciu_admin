// js/restricciones-proyectos.js
// Archivo para restringir botones específicos en proyectos

document.addEventListener('DOMContentLoaded', function() {
    // Función para deshabilitar botones de cerrar/reabrir proyecto
    function deshabilitarBotonesProyecto() {
        // Buscar botones de cerrar proyecto
        const botonesCerrar = document.querySelectorAll('button[onclick*="cerrarProyecto"]');
        const botonesReabrir = document.querySelectorAll('button[onclick*="reabrirProyecto"]');
        
        botonesCerrar.forEach(boton => {
            boton.style.display = 'none';
            boton.disabled = true;
        });
        
        botonesReabrir.forEach(boton => {
            boton.style.display = 'none';
            boton.disabled = true;
        });
    }
    
    // Ejecutar inicialmente
    setTimeout(deshabilitarBotonesProyecto, 2000);
    
    // Observar cambios en el DOM
    const observer = new MutationObserver(function(mutations) {
        let hayCambios = false;
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length > 0) {
                hayCambios = true;
            }
        });
        
        if (hayCambios) {
            setTimeout(deshabilitarBotonesProyecto, 500);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // También observar cuando se carga un proyecto específico
    document.addEventListener('proyectoCargado', function() {
        setTimeout(deshabilitarBotonesProyecto, 1000);
    });
});

// Monkey patch para proyectos-manager.js
(function() {
    // Esperar a que se cargue el módulo
    setTimeout(function() {
        if (typeof controlFlujo !== 'undefined' && controlFlujo.proyectos) {
            // Guardar referencia original
            const originalCargarProyectos = controlFlujo.proyectos.cargarProyectos;
            const originalCargarProyecto = controlFlujo.proyectos.cargarProyecto;
            
            // Sobrescribir cargarProyectos
            if (originalCargarProyectos) {
                controlFlujo.proyectos.cargarProyectos = function() {
                    const resultado = originalCargarProyectos.call(this);
                    
                    // Después de cargar proyectos, deshabilitar botones
                    setTimeout(function() {
                        const botonesCerrar = document.querySelectorAll('button[onclick*="cerrarProyecto"], button[onclick*="reabrirProyecto"]');
                        botonesCerrar.forEach(boton => {
                            boton.style.display = 'none';
                            boton.disabled = true;
                        });
                    }, 1500);
                    
                    return resultado;
                };
            }
            
            // Sobrescribir cargarProyecto
            if (originalCargarProyecto) {
                controlFlujo.proyectos.cargarProyecto = function(proyectoId) {
                    const resultado = originalCargarProyecto.call(this, proyectoId);
                    
                    // Después de cargar proyecto, deshabilitar botones
                    setTimeout(function() {
                        const botonesCerrar = document.querySelectorAll('button[onclick*="cerrarProyecto"], button[onclick*="reabrirProyecto"]');
                        botonesCerrar.forEach(boton => {
                            boton.style.display = 'none';
                            boton.disabled = true;
                        });
                    }, 1500);
                    
                    return resultado;
                };
            }
        }
    }, 3000);
})();