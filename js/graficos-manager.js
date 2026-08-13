// graficos-manager.js - Gestión de gráficos - VERSIÓN CORREGIDA - SOLO PARTIDAS PRINCIPALES
class GraficosManager {
    constructor(controlFlujo) {
        this.cf = controlFlujo;
    }

    async cargarGraficos() {
        if (!this.cf.proyectoActual) return;

        try {
            // Usar la nueva API específica para gráficos de partidas principales
            const response = await fetch(`api/partidas.php?action=graficos-principales&proyecto_id=${this.cf.proyectoActual.id}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.success && (data.graficos?.distribucion?.data?.length > 0 || data.graficos?.gastos?.data?.length > 0)) {
                this.renderizarGraficos(data.graficos);
            } else {
                this.mostrarMensajeSinDatos();
            }
        } catch (error) {
            console.error('Error cargando gráficos:', error);
            this.mostrarMensajeSinDatos();
        }
    }

    mostrarMensajeSinDatos() {
        const container = document.querySelector('.graficos-container');
        if (!container) return;

        container.innerHTML = `
            <div class="no-data-message">
                <div class="mb-4">
                    <i class="fas fa-chart-pie fa-4x text-muted"></i>
                </div>
                <h4 class="text-muted mb-3">No hay datos para mostrar</h4>
                <p class="text-muted mb-4">
                    Crea <strong>partidas principales</strong> y registra transacciones para ver los gráficos.
                </p>
                <div class="d-flex flex-wrap justify-content-center gap-3">
                    <button class="btn btn-primary" onclick="window.controlFlujo.partidas.mostrarModalCrearPartida()">
                        <i class="fas fa-plus-circle"></i> Crear Partida Principal
                    </button>
                    <button class="btn btn-success" onclick="window.controlFlujo.ui.mostrarModalRegistrarIngreso()">
                        <i class="fas fa-money-bill-wave"></i> Registrar Ingreso
                    </button>
                </div>
            </div>
        `;
    }

    renderizarGraficos(graficos) {
        // Destruir gráficos existentes
        this.destruirGraficos();
        this.cf.charts = {};

        const container = document.querySelector('.graficos-container');
        if (!container) return;

        // Limpiar y resetear
        container.innerHTML = '';
        container.classList.remove('single-chart');

        const tieneDistribucion = graficos?.distribucion?.data?.length > 0;
        const tieneGastos = graficos?.gastos?.data?.length > 0;

        if (!tieneDistribucion && !tieneGastos) {
            this.mostrarMensajeSinDatos();
            return;
        }

        // 1. GRÁFICO DE DISTRIBUCIÓN (ARRIBA) - SOLO PARTIDAS PRINCIPALES
        if (tieneDistribucion) {
            const distribucionDiv = document.createElement('div');
            distribucionDiv.className = 'grafico-card';
            distribucionDiv.innerHTML = `
                <h4><i class="fas fa-chart-pie mr-2"></i>Distribución por Partida Principal</h4>
                <div class="chart-container">
                    <canvas id="grafico-partidas"></canvas>
                </div>
            `;
            container.appendChild(distribucionDiv);

            // Dar tiempo al DOM para renderizar
            setTimeout(() => {
                const ctx = document.getElementById('grafico-partidas');
                if (ctx) {
                    this.crearGraficoDistribucion(ctx, graficos.distribucion);
                }
            }, 50);
        }

        // 2. GRÁFICO DE GASTOS (ABAJO) - SOLO PARTIDAS PRINCIPALES
        if (tieneGastos) {
            const gastosDiv = document.createElement('div');
            gastosDiv.className = 'grafico-card';
            gastosDiv.innerHTML = `
                <h4><i class="fas fa-chart-bar mr-2"></i>Gastos por Partida Principal</h4>
                <div class="chart-container">
                    <canvas id="grafico-gastos"></canvas>
                </div>
            `;
            container.appendChild(gastosDiv);

            // Dar tiempo al DOM para renderizar
            setTimeout(() => {
                const ctx = document.getElementById('grafico-gastos');
                if (ctx) {
                    this.crearGraficoGastos(ctx, graficos.gastos);
                }
            }, 100);
        }

        // Si solo hay un gráfico, ajustar layout
        if ((tieneDistribucion && !tieneGastos) || (!tieneDistribucion && tieneGastos)) {
            container.classList.add('single-chart');
        }
    }

    crearGraficoDistribucion(ctx, datos) {
        try {
            // Configurar colores
            const colores = this.generarColores(datos.data.length);

            this.cf.charts.partidas = new Chart(ctx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: datos.labels,
                    datasets: [{
                        data: datos.data,
                        backgroundColor: colores,
                        borderColor: colores.map(color => this.oscurecerColor(color)),
                        borderWidth: 2,
                        hoverOffset: 15
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 2,
                    cutout: '50%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                padding: 20,
                                boxWidth: 15,
                                boxHeight: 15,
                                font: {
                                    size: 12,
                                    family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                                },
                                color: '#333',
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#007bff',
                            borderWidth: 1,
                            cornerRadius: 6,
                            callbacks: {
                                label: function (context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                    return `${label}: $${value.toLocaleString('es-ES')} (${percentage}%)`;
                                },
                                afterLabel: function (context) {
                                    return 'Partida Principal';
                                }
                            }
                        },
                        // Agregar subtítulo
                        subtitle: {
                            display: true,
                            text: 'Presupuesto asignado a partidas principales',
                            color: '#666',
                            font: {
                                size: 12
                            },
                            padding: {
                                bottom: 10
                            }
                        }
                    },
                    layout: {
                        padding: {
                            top: 10,
                            right: 10,
                            bottom: 30, // Más espacio para el subtítulo
                            left: 10
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creando gráfico de distribución:', error);
            ctx.parentElement.innerHTML = `
                <div class="grafico-error">
                    <i class="fas fa-exclamation-triangle text-warning fa-2x mb-3"></i>
                    <p class="text-muted">Error al crear el gráfico de distribución</p>
                </div>
            `;
        }
    }

    crearGraficoGastos(ctx, datos) {
        try {
            // Configurar colores para las barras
            const colores = this.generarColores(datos.data.length);

            this.cf.charts.gastos = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: datos.labels,
                    datasets: [{
                        label: 'Gastos Partidas Principales ($)',
                        data: datos.data,
                        backgroundColor: colores,
                        borderColor: colores.map(color => this.oscurecerColor(color)),
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false,
                        barPercentage: 0.7,
                        categoryPercentage: 0.8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 2.5,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#007bff',
                            borderWidth: 1,
                            cornerRadius: 6,
                            callbacks: {
                                label: function (context) {
                                    return `Gastos totales: $${context.raw.toLocaleString('es-ES')}`;
                                },
                                afterLabel: function (context) {
                                    return 'Incluye gastos de subpartidas';
                                }
                            }
                        },
                        subtitle: {
                            display: true,
                            text: 'Gastos acumulados de partidas principales (incluye subpartidas)',
                            color: '#666',
                            font: {
                                size: 12
                            },
                            padding: {
                                bottom: 10
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)',
                                drawBorder: false
                            },
                            ticks: {
                                color: '#666',
                                font: {
                                    size: 11
                                },
                                callback: function (value) {
                                    return '$' + value.toLocaleString('es-ES');
                                },
                                padding: 10
                            },
                            title: {
                                display: true,
                                text: 'Monto Gastado ($)',
                                color: '#666',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                },
                                padding: {
                                    top: 10,
                                    bottom: 20
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false,
                                drawBorder: false
                            },
                            ticks: {
                                color: '#666',
                                font: {
                                    size: 11
                                },
                                maxRotation: 45,
                                minRotation: 0,
                                padding: 5,
                                autoSkip: true,
                                maxTicksLimit: 10,
                                callback: function (value, index, values) {
                                    // Acortar etiquetas si son muy largas
                                    const label = this.getLabelForValue(value);
                                    return label.length > 30 ? label.substring(0, 30) + '...' : label;
                                }
                            },
                            title: {
                                display: true,
                                text: 'Partidas Principales',
                                color: '#666',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                },
                                padding: {
                                    top: 20,
                                    bottom: 10
                                }
                            }
                        }
                    },
                    layout: {
                        padding: {
                            top: 30, // Más espacio para el subtítulo
                            right: 20,
                            bottom: 30,
                            left: 20
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creando gráfico de gastos:', error);
            ctx.parentElement.innerHTML = `
                <div class="grafico-error">
                    <i class="fas fa-exclamation-triangle text-warning fa-2x mb-3"></i>
                    <p class="text-muted">Error al crear el gráfico de gastos</p>
                </div>
            `;
        }
    }

    generarColores(cantidad) {
        const coloresBase = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#8AC926', '#1982C4',
            '#6A4C93', '#F72585', '#7209B7', '#3A86FF',
            '#FF595E', '#FFCA3A', '#8AC926', '#1982C4',
            '#6A4C93', '#F72585', '#7209B7', '#3A86FF'
        ];

        if (cantidad <= coloresBase.length) {
            return coloresBase.slice(0, cantidad);
        }

        // Generar colores complementarios si necesitamos más
        const colores = [...coloresBase];
        for (let i = coloresBase.length; i < cantidad; i++) {
            const hue = (i * 137.508) % 360; // Ángulo dorado para distribución uniforme
            colores.push(`hsl(${hue}, 70%, 60%)`);
        }
        return colores;
    }

    oscurecerColor(color) {
        if (color.startsWith('hsl')) {
            const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
            if (match) {
                const h = parseInt(match[1]);
                const s = parseInt(match[2]);
                const l = Math.max(20, parseInt(match[3]) * 0.7); // Oscurecer 30%
                return `hsl(${h}, ${s}%, ${l}%)`;
            }
        } else if (color.startsWith('#')) {
            // Convertir hex a rgb, oscurecer y volver a hex
            const r = Math.floor(parseInt(color.slice(1, 3), 16) * 0.7);
            const g = Math.floor(parseInt(color.slice(3, 5), 16) * 0.7);
            const b = Math.floor(parseInt(color.slice(5, 7), 16) * 0.7);
            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        } else if (color.startsWith('rgb')) {
            const match = color.match(/(\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                const r = Math.floor(parseInt(match[1]) * 0.7);
                const g = Math.floor(parseInt(match[2]) * 0.7);
                const b = Math.floor(parseInt(match[3]) * 0.7);
                return `rgb(${r}, ${g}, ${b})`;
            }
        }
        return color;
    }

    destruirGraficos() {
        Object.values(this.cf.charts || {}).forEach(chart => {
            if (chart && chart.destroy) chart.destroy();
        });
        this.cf.charts = {};
    }
}