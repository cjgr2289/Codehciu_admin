// Configuración universal de rutas - compatible con localhost y hosting
function getBaseUrl() {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const currentPath = window.location.pathname;
    
    console.log('Debug - Hostname:', window.location.hostname);
    console.log('Debug - Pathname:', currentPath);
    
    // Siempre usar ruta relativa desde admin/js/
    if (currentPath.includes('/admin/')) {
        // Si la URL contiene /admin/, la API está en ../api/
        return './api/noticias.php';
    } else {
        // Si no contiene /admin/, asumir que estamos en la raíz de admin
        return 'api/noticias.php';
    }
}

const API_BASE = getBaseUrl();

console.log('API Base URL configurada:', API_BASE);

document.addEventListener('DOMContentLoaded', function() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    loadNews();

    document.getElementById('add-news-btn').addEventListener('click', function() {
        openEditor();
    });
});

function loadNews() {
    console.log('Cargando noticias desde:', API_BASE);
    
    fetch(API_BASE)
        .then(response => {
            console.log('Response status:', response.status, 'URL:', response.url);
            if (!response.ok) {
                throw new Error('Error HTTP: ' + response.status + ' - ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log('Datos recibidos:', data);
            
            if (!data.success) {
                throw new Error(data.error || 'Error al cargar noticias');
            }

            const noticias = data.data || [];
            const newsList = document.getElementById('news-list');
            newsList.innerHTML = '';

            if (noticias.length === 0) {
                newsList.innerHTML = '<div class="no-news">No hay noticias disponibles.</div>';
                return;
            }

            noticias.forEach(noticia => {
                const newsItem = document.createElement('div');
                newsItem.className = 'news-item';
                
                // Usar imagen base64 directamente
                const imagenSrc = noticia.imagen_url || (noticia.imagen_base64 ? 'data:image/jpeg;base64,' + noticia.imagen_base64 : '../IMAGES/default-news.jpg');
                
                newsItem.innerHTML = `
                    <div class="news-header">
                        <img class="news-thumb" src="${imagenSrc}" alt="Imagen noticia" style="width:70px;height:70px;object-fit:cover;border-radius:6px;margin-right:16px;">
                        <div>
                            <h3>${noticia.titulo}</h3>
                            <span class="news-date">${new Date(noticia.fecha).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <p class="news-summary">${noticia.resumen}</p>
                    <div class="news-actions">
                        <button class="btn-icon btn-edit" data-id="${noticia.id}">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn-icon btn-delete" data-id="${noticia.id}">
                            <i class="fas fa-trash-alt"></i> Eliminar
                        </button>
                    </div>
                `;
                newsList.appendChild(newsItem);
            });

            // Agregar event listeners para los botones
            document.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', function() {
                    const newsId = this.getAttribute('data-id');
                    openEditor(newsId);
                });
            });

            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', function() {
                    const newsId = this.getAttribute('data-id');
                    if (confirm('¿Estás seguro de eliminar esta noticia?')) {
                        deleteNews(newsId);
                    }
                });
            });
        })
        .catch(err => {
            console.error('Error en loadNews:', err);
            document.getElementById('news-list').innerHTML = `
                <div class="no-news">
                    <p>Error al cargar las noticias</p>
                    <p><small>URL intentada: ${API_BASE}</small></p>
                    <button onclick="loadNews()" class="btn">Reintentar</button>
                </div>
            `;
        });
}

function openEditor(newsId = null) {
    const url = newsId ? `editor.html?id=${newsId}` : 'editor.html';
    window.location.href = url;
}

function deleteNews(newsId) {
    if (!confirm('¿Estás seguro de eliminar esta noticia?')) return;

    fetch(`${API_BASE}?id=${newsId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error HTTP: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            loadNews();
        } else {
            throw new Error(data.error || 'Error al eliminar la noticia');
        }
    })
    .catch(err => {
        console.error('Error en deleteNews:', err);
        alert('Error al eliminar la noticia: ' + err.message);
    });
}