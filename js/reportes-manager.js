/**
 * ReportesManager.js - Conectado a la base de datos real
 * Usa la API PHP para obtener datos de la base de datos
 */

(function () {
    'use strict';

    class ReportesManager {
        constructor() {
            //console.log('📊 ReportesManager construido');
            // RUTA CORREGIDA: apunta a /api/reportes.php
            this.apiUrl = './api/reportes.php';
            this.datosProyecto = null;
            this.proyectoId = null;
            this.debugMode = true;
            this.initEventos();
        }

        initEventos() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setupEventos());
            } else {
                this.setupEventos();
            }
        }

        setupEventos() {
           // console.log('🔧 Configurando eventos...');

            // Botón para abrir modal
            const btnReporte = document.getElementById('btn-generar-reporte');
            if (btnReporte) {
             //   console.log('✅ Botón de reporte encontrado');
                btnReporte.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.mostrarModalReporte();
                });
            } else {
               // console.warn('⚠️ Botón de reporte NO encontrado');
            }

            // Botones de descarga en el modal
            const btnExcel = document.getElementById('btn-descargar-excel');
            const btnPDF = document.getElementById('btn-descargar-pdf');

            if (btnExcel) {
                btnExcel.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.generarExcelCSV();
                });
            }

            if (btnPDF) {
                btnPDF.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.generarPDFHtml();
                });
            }

            // Botón para probar conexión
            const btnTest = document.getElementById('btn-test-api');
            if (btnTest) {
                btnTest.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.probarConexionAPI();
                });
            }
        }

        obtenerProyectoId() {
            if (this.proyectoId) {
               // console.log('📋 Usando proyecto ID almacenado:', this.proyectoId);
                return this.proyectoId;
            }

            // console.log('🔍 Buscando ID del proyecto...');

            // 1. Desde URL
            const urlParams = new URLSearchParams(window.location.search);
            const proyectoIdUrl = urlParams.get('proyecto_id');
            if (proyectoIdUrl) {
                this.proyectoId = parseInt(proyectoIdUrl);
               // console.log('🌐 ID desde URL:', this.proyectoId);
                return this.proyectoId;
            }

            // 2. Desde controlFlujo
            if (window.controlFlujo && window.controlFlujo.proyectos) {
                const proyectoId = window.controlFlujo.proyectos.proyectoId;
                if (proyectoId) {
                    this.proyectoId = proyectoId;
                 //   console.log('💾 ID desde controlFlujo:', this.proyectoId);
                    return this.proyectoId;
                }
            }

            // 3. Desde elementos del DOM
            const proyectoIdElement = document.querySelector('[data-proyecto-id]');
            if (proyectoIdElement) {
                this.proyectoId = parseInt(proyectoIdElement.dataset.proyectoId);
                // console.log('🏷️ ID desde data attribute:', this.proyectoId);
                return this.proyectoId;
            }

            // 4. Desde input hidden
            const inputProyectoId = document.querySelector('input[name="proyecto_id"], input[name="id_proyecto"]');
            if (inputProyectoId && inputProyectoId.value) {
                this.proyectoId = parseInt(inputProyectoId.value);
                //console.log('📝 ID desde input hidden:', this.proyectoId);
                return this.proyectoId;
            }

            // 5. Desde el título
            const tituloDashboard = document.getElementById('titulo-dashboard');
            if (tituloDashboard) {
                const texto = tituloDashboard.textContent;
                const match = texto.match(/ID:\s*(\d+)/) || texto.match(/Proyecto\s*#?\s*(\d+)/);
                if (match) {
                    this.proyectoId = parseInt(match[1]);
                   // console.log('📄 ID desde título:', this.proyectoId);
                    return this.proyectoId;
                }
            }

            console.warn('❌ No se pudo determinar el ID del proyecto');
            return null;
        }

        async mostrarModalReporte() {
            try {
                //console.log('🔄 Abriendo modal de reportes...');
                const modalElement = document.getElementById('modal-generar-reporte');
                if (!modalElement) {
                    console.error('❌ Modal no encontrado');
                    Swal.fire('Error', 'El modal de reportes no está disponible', 'error');
                    return;
                }

                // Obtener proyecto ID
                this.proyectoId = this.obtenerProyectoId();
                if (!this.proyectoId) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Proyecto no seleccionado',
                        text: 'Por favor, seleccione un proyecto primero',
                        confirmButtonText: 'Entendido'
                    });
                    return;
                }

                // console.log('🎯 Proyecto ID para reporte:', this.proyectoId);

                // Actualizar nombre del proyecto en el modal
                const tituloDashboard = document.getElementById('titulo-dashboard');
                if (tituloDashboard) {
                    const nombreProyecto = this.extraerNombreProyecto(tituloDashboard.textContent);
                    const nombreElement = document.getElementById('nombre-proyecto-reporte');
                    if (nombreElement) {
                        nombreElement.textContent = `Reporte: ${nombreProyecto}`;
                        nombreElement.dataset.proyectoId = this.proyectoId;
                    }
                }

                // Mostrar el modal
                const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
                modal.show();

                // Cargar datos al abrir el modal
                this.cargarDatosProyecto().then(datos => {
                    if (datos) {
                    //    console.log('✅ Datos cargados para reporte:', datos);
                        this.actualizarVistaPrevia(datos);
                    } else {
                        this.mostrarMensajeError();
                    }
                }).catch(error => {
                    console.error('❌ Error cargando datos:', error);
                    this.mostrarMensajeError();
                });

            } catch (error) {
                console.error('❌ Error mostrando modal:', error);
                Swal.fire('Error', 'No se pudo abrir el modal de reportes: ' + error.message, 'error');
            }
        }

        mostrarMensajeError() {
            const vistaPrevia = document.getElementById('vista-previa-reporte');
            if (vistaPrevia) {
                vistaPrevia.innerHTML = `
                    <div class="alert alert-danger">
                        <h6><i class="fas fa-exclamation-triangle"></i> Error de conexión</h6>
                        <p class="mb-0">No se pudieron cargar los datos del proyecto. Por favor, verifica:</p>
                        <ul class="mt-2 mb-0">
                            <li>Que el servidor de API esté funcionando</li>
                            <li>Que el proyecto exista en la base de datos</li>
                            <li>Que tengas permisos para acceder a los datos</li>
                        </ul>
                    </div>
                `;
            }
        }

        extraerNombreProyecto(texto) {
            if (!texto) return 'Proyecto';

            if (texto.includes(':')) {
                return texto.split(':')[1]?.trim() || 'Proyecto';
            }
            if (texto.includes('-')) {
                return texto.split('-')[1]?.trim() || 'Proyecto';
            }
            return texto.replace('Dashboard del Proyecto', '').trim() || 'Proyecto';
        }

        async cargarDatosProyecto() {
            try {
                const proyectoId = this.obtenerProyectoId();
                if (!proyectoId) {
                    throw new Error('No hay proyecto seleccionado');
                }

               // console.log(`📥 Cargando datos para proyecto ID: ${proyectoId}`);

                // Obtener datos reales directamente desde la API
                const url = `${this.apiUrl}?action=obtener_datos_reporte&proyecto_id=${proyectoId}&t=${Date.now()}`;
               // console.log('📡 Solicitando datos desde:', url);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                });

                // Verificar respuesta HTTP
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`❌ Error HTTP ${response.status}:`, errorText);
                    throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
                }

                // Intentar parsear JSON
                let result;
                try {
                    result = await response.json();
                } catch (jsonError) {
                    console.error('❌ Error parseando JSON:', jsonError);
                    throw new Error('La respuesta del servidor no es un JSON válido');
                }

                // Verificar estructura de respuesta
                if (!result || typeof result !== 'object') {
                    throw new Error('Respuesta inválida del servidor');
                }

                if (!result.success) {
                    const errorMsg = result.error || 'Error desconocido al obtener datos';
                    console.error('❌ Error en respuesta:', errorMsg);
                    throw new Error(errorMsg);
                }

                // Verificar que hay datos
                if (!result.data) {
                    throw new Error('No se encontraron datos para este proyecto');
                }

                this.datosProyecto = result.data;
               // console.log('✅ Datos cargados correctamente desde API');
                return this.datosProyecto;

            } catch (error) {
                console.error('❌ Error cargando datos desde API:', error);

                // Mostrar error al usuario
                Swal.fire({
                    icon: 'error',
                    title: 'Error cargando datos',
                    html: `No se pudieron cargar los datos del proyecto.<br><br>
                          <small>Error: ${error.message}</small>`,
                    confirmButtonText: 'Entendido'
                });

                // NO retornar datos de prueba - retornar null para indicar error
                return null;
            }
        }

        actualizarVistaPrevia(datos) {
            if (!datos) {
                console.error('❌ No hay datos para mostrar en la vista previa');
                this.mostrarMensajeError();
                return;
            }

           // console.log('🔄 Actualizando vista previa...');

            // Actualizar información básica - SOLO si los elementos existen
            const elementos = {
                'preview-nombre-proyecto': datos.proyecto?.nombre || 'Proyecto',
                'preview-cliente': datos.proyecto?.cliente || 'No especificado',
                'preview-presupuesto': datos.proyecto?.presupuesto ? `$${parseFloat(datos.proyecto.presupuesto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD` : '$0.00 USD',
                'preview-abonos': datos.resumen?.abonos_recibidos ? `$${parseFloat(datos.resumen.abonos_recibidos).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD` : '$0.00 USD',
                'preview-gastos': datos.resumen?.gastos_realizados ? `$${parseFloat(datos.resumen.gastos_realizados).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD` : '$0.00 USD',
                'preview-saldo': datos.resumen?.saldo_disponible ? `$${parseFloat(datos.resumen.saldo_disponible).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD` : '$0.00 USD'
            };

            for (const [id, valor] of Object.entries(elementos)) {
                const elemento = document.getElementById(id);
                if (elemento) {
                    elemento.textContent = valor;
                } else {
                    // Solo mostrar warning en debug mode
                    if (this.debugMode) {
                      //  console.log(`⚠️ Elemento ${id} no encontrado en el DOM`);
                    }
                }
            }

            // Actualizar contadores - SOLO si los elementos existen
            const contadores = {
                'preview-num-partidas': datos.partidas_principales ?
                    datos.partidas_principales.reduce((total, partida) =>
                        total + 1 + (partida.subpartidas?.length || 0), 0) : 0,
                'preview-num-transacciones': datos.egresos_totales?.length || 0,
                'preview-num-abonos': datos.abonos?.length || 0
            };

            for (const [id, valor] of Object.entries(contadores)) {
                const elemento = document.getElementById(id);
                if (elemento) {
                    elemento.textContent = valor;
                } else if (this.debugMode) {
                  //  console.log(`⚠️ Elemento ${id} no encontrado en el DOM`);
                }
            }

           // console.log('✅ Vista previa actualizada');
        }

        async generarExcelCSV() {
            try {
                Swal.fire({
                    title: 'Generando Excel...',
                    html: 'Por favor espera mientras se genera el reporte',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });

                const proyectoId = this.obtenerProyectoId();
                if (!proyectoId) {
                    throw new Error('No hay proyecto seleccionado');
                }

                // Usar FormData para mejor compatibilidad
                const formData = new FormData();
                formData.append('action', 'generar_excel');
                formData.append('proyecto_id', proyectoId);

                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
                }

                // Verificar el tipo de contenido
                const contentType = response.headers.get('content-type') || '';

                if (contentType.includes('text/csv') || contentType.includes('application/octet-stream')) {
                    // Es un archivo CSV, descargarlo directamente
                    const blob = await response.blob();

                    // Obtener nombre de archivo del header o usar uno por defecto
                    let filename = 'reporte_egresos.csv';
                    const contentDisposition = response.headers.get('content-disposition');
                    if (contentDisposition) {
                        const match = contentDisposition.match(/filename="(.+?)"/);
                        if (match) {
                            filename = match[1];
                        }
                    }

                    // Crear URL para el blob
                    const url = window.URL.createObjectURL(blob);

                    // Crear enlace de descarga
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    link.style.display = 'none';

                    // Descargar
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // Liberar URL
                    setTimeout(() => window.URL.revokeObjectURL(url), 100);

                    Swal.close();

                    Swal.fire({
                        icon: 'success',
                        title: 'Excel generado',
                        text: 'El reporte CSV se ha descargado correctamente.',
                        confirmButtonText: 'Entendido'
                    });

                    return;
                }

                // Si no es CSV, intentar parsear como JSON (para retrocompatibilidad)
                const resultText = await response.text();
                let result;

                try {
                    result = JSON.parse(resultText);
                } catch (jsonError) {
                    console.error('❌ Error parseando JSON:', jsonError);
                    throw new Error('El servidor devolvió una respuesta inesperada');
                }

                if (!result.success) {
                    throw new Error(result.error || 'Error al generar el reporte');
                }

                // Si el resultado JSON tiene URL, intentar descargarla
                if (result.url) {
                   // console.log('📥 Descargando archivo desde URL:', result.url);
                    // Abrir en nueva pestaña para descargar
                    window.open(result.url, '_blank');
                }

                Swal.close();

                Swal.fire({
                    icon: 'success',
                    title: 'Excel generado',
                    text: 'El reporte se ha generado correctamente.',
                    confirmButtonText: 'Entendido'
                });

            } catch (error) {
                Swal.close();
                console.error('❌ Error generando Excel:', error);

                Swal.fire({
                    icon: 'error',
                    title: 'Error generando Excel',
                    text: 'No se pudo generar el archivo Excel: ' + error.message,
                    confirmButtonText: 'Entendido'
                });
            }
        }

        async generarPDFHtml() {
            try {
                Swal.fire({
                    title: 'Generando Reporte HTML...',
                    html: 'Por favor espera mientras se genera el reporte',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });

                const proyectoId = this.obtenerProyectoId();
                if (!proyectoId) {
                    throw new Error('No hay proyecto seleccionado');
                }

                // Usar FormData
                const formData = new FormData();
                formData.append('action', 'generar_pdf');
                formData.append('proyecto_id', proyectoId);

                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
                }

                // Verificar el tipo de contenido
                const contentType = response.headers.get('content-type') || '';

                if (contentType.includes('text/html')) {
                    // Es HTML, descargarlo directamente
                    const blob = await response.blob();

                    // Obtener nombre de archivo del header
                    let filename = 'reporte_egresos.html';
                    const contentDisposition = response.headers.get('content-disposition');
                    if (contentDisposition) {
                        const match = contentDisposition.match(/filename="(.+?)"/);
                        if (match) {
                            filename = match[1];
                        }
                    }

                    // Crear URL para el blob
                    const url = window.URL.createObjectURL(blob);

                    // Crear enlace de descarga
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    link.style.display = 'none';

                    // Descargar
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // Liberar URL
                    setTimeout(() => window.URL.revokeObjectURL(url), 100);

                    Swal.close();

                    Swal.fire({
                        icon: 'success',
                        title: 'Reporte generado',
                        text: 'El reporte HTML se ha descargado correctamente.',
                        confirmButtonText: 'Entendido'
                    });

                    return;
                }

                // Si no es HTML, intentar parsear como JSON (para retrocompatibilidad)
                const resultText = await response.text();
                console.warn('⚠️ La respuesta no es HTML, intentando parsear como JSON...');

                let result;
                try {
                    result = JSON.parse(resultText);
                } catch (jsonError) {
                    console.error('❌ Error parseando JSON:', jsonError);
                    throw new Error('El servidor devolvió una respuesta inesperada');
                }

                if (!result.success) {
                    throw new Error(result.error || 'Error al generar el reporte');
                }

                // Si el resultado JSON tiene URL, intentar descargarla
                if (result.url) {
                   // console.log('📥 Descargando archivo desde URL:', result.url);
                    // Abrir en nueva pestaña para descargar
                    window.open(result.url, '_blank');
                }

                Swal.close();

                Swal.fire({
                    icon: 'success',
                    title: 'Reporte generado',
                    text: 'El reporte se ha generado correctamente.',
                    confirmButtonText: 'Entendido'
                });

            } catch (error) {
                Swal.close();
                console.error('❌ Error generando reporte:', error);

                Swal.fire({
                    icon: 'error',
                    title: 'Error generando reporte',
                    html: 'No se pudo generar el reporte HTML.<br><br>' +
                        '<small>Error: ' + error.message + '</small><br><br>' +
                        '<small>Por favor, intenta generar el reporte como Excel primero.</small>',
                    confirmButtonText: 'Entendido'
                });
            }
        }

        async probarConexionAPI() {
            try {
                Swal.fire({
                    title: 'Probando conexión...',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });

               // console.log('🔗 Probando conexión a:', this.apiUrl);

                // Primero probar si el archivo existe
                const headResponse = await fetch(this.apiUrl, { method: 'HEAD' });

                if (!headResponse.ok) {
                    throw new Error(`El archivo API no existe o no es accesible (${headResponse.status})`);
                }

                // Probar endpoint de test
                const testResponse = await fetch(`${this.apiUrl}?action=test&t=${Date.now()}`);
                let testResult = null;

                try {
                    const text = await testResponse.text();
                    testResult = JSON.parse(text);
                } catch (e) {
                    console.warn('⚠️ La respuesta test no es JSON válido:', e.message);
                    testResult = { success: false, error: 'Respuesta no es JSON' };
                }

                if (!testResult.success) {
                    console.warn('⚠️ Endpoint test no responde correctamente');
                }

                // Probar también el endpoint de datos
                const proyectoId = this.obtenerProyectoId() || 1;
                const dataUrl = `${this.apiUrl}?action=obtener_datos_reporte&proyecto_id=${proyectoId}&t=${Date.now()}`;

               // console.log('🔗 Probando endpoint de datos:', dataUrl);

                const dataResponse = await fetch(dataUrl);
                let dataResult = null;

                try {
                    const text = await dataResponse.text();
                    dataResult = JSON.parse(text);
                } catch (e) {
                    console.warn('⚠️ La respuesta de datos no es JSON válido:', e.message);
                    dataResult = { success: false, error: 'Respuesta no es JSON' };
                }

                Swal.fire({
                    icon: testResult.success && dataResult.success ? 'success' : 'warning',
                    title: testResult.success && dataResult.success ? '✅ API Funcionando' : '⚠️ API con Advertencias',
                    html: `Conexión establecida con el servidor.<br><br>
                  <small>Endpoints probados:</small><br>
                  <small>• Test: ${testResult.success ? '✓ Funcionando' : '✗ Problemas'}</small><br>
                  <small>• Datos: ${dataResult.success ? '✓ Funcionando' : '✗ Problemas'}</small><br><br>
                  ${!testResult.success || !dataResult.success ?
                            '<small><em>Nota: Algunos endpoints tienen problemas, pero la conexión básica funciona.</em></small>' : ''}`,
                    timer: 4000,
                    showConfirmButton: true
                });

            } catch (error) {
                console.error('❌ Error de conexión:', error);
                Swal.fire({
                    icon: 'error',
                    title: '❌ Error de conexión',
                    html: `No se pudo conectar con el servidor de reportes.<br><br>
                  <small>Error: ${error.message}</small><br>
                  <small>URL: ${this.apiUrl}</small><br><br>
                  <small><em>Verifica que el archivo reportes.php exista en la carpeta /api/</em></small>`,
                    confirmButtonText: 'Entendido'
                });
            }
        }

        // Función para mostrar errores de manera consistente
        mostrarErrorDetallado(titulo, error, contexto = '') {
            console.error(`❌ ${titulo}:`, error);

            let mensaje = error.message || 'Error desconocido';

            // Si el error parece ser de PHP, mostrar información específica
            if (mensaje.includes('PHP') || mensaje.includes('Notice') || mensaje.includes('Warning')) {
                mensaje += '\n\n🔧 Recomendación: Verifica los logs de PHP en el servidor.';
            }

            Swal.fire({
                icon: 'error',
                title: titulo,
                html: `${mensaje}<br><br>
              <small>Contexto: ${contexto || 'General'}</small><br>
              <small>Hora: ${new Date().toLocaleTimeString()}</small>`,
                confirmButtonText: 'Entendido',
                width: '600px'
            });
        }
    }

    // Inicializar cuando la página esté lista
    window.addEventListener('load', function () {
       // console.log('🚀 Inicializando ReportesManager...');

        setTimeout(() => {
            try {
                window.reportesManager = new ReportesManager();
                //console.log('✅ ReportesManager inicializado correctamente');
                //console.log('🔗 URL de API:', window.reportesManager.apiUrl);

            } catch (error) {
                console.error('❌ Error inicializando ReportesManager:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error de inicialización',
                    text: 'No se pudo inicializar el sistema de reportes: ' + error.message
                });
            }
        }, 500);
    });

})();