// Variables globales
let map;
let capaActual = null;
let userLocation = null;
let routeLayer = null;
let origenMarker = null;
let destinoMarker = null;
let seleccionandoPunto = null;
let currentRoute = null;

// Iconos personalizados para marcadores de ruta
const origenIcon = L.divIcon({
    className: 'route-marker',
    html: '<div style="background: #28a745; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(0,0,0,0.3); font-size: 18px;">📍</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

const destinoIcon = L.divIcon({
    className: 'route-marker',
    html: '<div style="background: #dc3545; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(0,0,0,0.3); font-size: 18px;">🏁</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

// Inicializar mapa
function initMap() {
    // Crear mapa centrado en La Paz, Bolivia
    map = L.map('map').setView([-16.5000, -68.1500], 13);
    
    // Capa base de OpenStreetMap
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    });
    
    // Capa de satélite de Esri
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    });
    
    // Añadir capa base por defecto
    osmLayer.addTo(map);
    
    // Control de capas
    const baseLayers = {
        "Mapa de Calles": osmLayer,
        "Vista Satelital": satelliteLayer
    };
    
    L.control.layers(baseLayers).addTo(map);
    
    // Inicializar paneles en móvil
    initPanels();
    
    // Event listener para selección de puntos en el mapa
    map.on('click', function(e) {
        if (seleccionandoPunto) {
            agregarPuntoSeleccionado(e.latlng);
        }
    });
}

// Función de estilo para cámaras
function getStyle(feature) {
    const estado = feature.properties?.estado?.toLowerCase() || 'otro';
    
    const estilos = {
        'accesible operativo': { color: '#28a745', fillColor: '#28a745' },
        'accesible con dificultad': { color: '#ffc107', fillColor: '#ffc107' },
        'inferido': { color: '#6c757d', fillColor: '#6c757d' },
        'no accesible': { color: '#dc3545', fillColor: '#dc3545' }
    };
    
    return {
        radius: 8,
        fillColor: estilos[estado]?.fillColor || '#17a2b8',
        color: estilos[estado]?.color || '#17a2b8',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    };
}

// Crear icono SVG para marcadores
function createCustomIcon(estado) {
    const colorMap = {
        'accesible operativo': '#28a745',
        'accesible con dificultad': '#ffc107',
        'inferido': '#6c757d',
        'no accesible': '#dc3545'
    };
    
    const color = colorMap[estado?.toLowerCase()] || '#17a2b8';
    
    return L.divIcon({
        className: 'custom-marker',
        html: `
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="13" fill="#fafafa" stroke="#4a4a4a" stroke-width="2"/>
                <circle cx="16" cy="16" r="9.5" fill="none" stroke="${color}" stroke-width="2"/>
                <g transform="translate(16, 16)">
                    <rect x="-6" y="-3" width="4.5" height="1.5" fill="${color}" rx="0.5"/>
                    <rect x="1.5" y="-3" width="4.5" height="1.5" fill="${color}" rx="0.5"/>
                    <rect x="-6" y="0" width="4.5" height="1.5" fill="${color}" rx="0.5"/>
                    <rect x="1.5" y="0" width="4.5" height="1.5" fill="${color}" rx="0.5"/>
                    <rect x="-6" y="3" width="4.5" height="1.5" fill="${color}" rx="0.5"/>
                    <rect x="1.5" y="3" width="4.5" height="1.5" fill="${color}" rx="0.5"/>
                </g>
            </svg>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
}

// Cargar capa desde Supabase
async function cargarCapa() {
    const url = document.getElementById('url').value.trim();
    const key = document.getElementById('key').value.trim();
    const tabla = document.getElementById('tabla').value.trim();
    const geomField = document.getElementById('geomField').value.trim();
    
    if (!url || !key || !tabla) {
        mostrarEstado('Por favor completa todos los campos', 'error');
        return;
    }
    
    mostrarEstado('Cargando datos...', 'info');
    
    try {
        const response = await fetch(`${url}/rest/v1/${tabla}?select=*`, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        
        if (!response.ok) throw new Error('Error al cargar datos');
        
        const data = await response.json();
        
        if (data.length === 0) {
            mostrarEstado('No se encontraron datos en la tabla', 'error');
            return;
        }
        
        // Limpiar capa anterior
        if (capaActual) {
            map.removeLayer(capaActual);
        }
        
        // Crear capa de marcadores
        capaActual = L.layerGroup();
        
        data.forEach(feature => {
            if (feature[geomField]) {
                try {
                    const geom = typeof feature[geomField] === 'string' 
                        ? JSON.parse(feature[geomField]) 
                        : feature[geomField];
                    
                    if (geom.type === 'Point') {
                        const [lon, lat] = geom.coordinates;
                        const estado = feature.estado || 'Otro estado';
                        
                        const marker = L.marker([lat, lon], {
                            icon: createCustomIcon(estado)
                        });
                        
                        // Crear popup
                        let popupContent = `<div class="popup-title">📍 ${feature.nombre || 'Cámara Pluvial'}</div>`;
                        
                        Object.keys(feature).forEach(key => {
                            if (key !== geomField && feature[key] !== null && feature[key] !== '') {
                                if (key.toLowerCase().includes('img') || key.toLowerCase().includes('foto') || key.toLowerCase().includes('imagen')) {
                                    popupContent += `
                                        <div class="popup-image-container">
                                            <img src="${feature[key]}" class="popup-image" alt="Imagen" 
                                                 onerror="this.style.display='none'" 
                                                 onclick="window.open('${feature[key]}', '_blank')">
                                        </div>
                                    `;
                                } else {
                                    popupContent += `
                                        <div class="popup-row">
                                            <span class="popup-label">${key}:</span>
                                            <span class="popup-value">${feature[key]}</span>
                                        </div>
                                    `;
                                }
                            }
                        });
                        
                        marker.bindPopup(popupContent);
                        marker.addTo(capaActual);
                    }
                } catch (e) {
                    console.error('Error al procesar geometría:', e);
                }
            }
        });
        
        capaActual.addTo(map);
        
        // Ajustar vista a los datos
        if (capaActual.getLayers().length > 0) {
            map.fitBounds(capaActual.getBounds(), { padding: [50, 50] });
        }
        
        // Actualizar UI
        document.getElementById('btnLimpiar').style.display = 'block';
        document.getElementById('totalPuntos').textContent = data.length;
        document.getElementById('ultimaActualizacion').textContent = new Date().toLocaleString('es-BO');
        document.getElementById('infoPanel').style.display = 'block';
        
        mostrarEstado(`✅ Se cargaron ${data.length} puntos correctamente`, 'success');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarEstado('❌ Error al cargar los datos: ' + error.message, 'error');
    }
}

// Limpiar capa
function limpiarCapa() {
    if (capaActual) {
        map.removeLayer(capaActual);
        capaActual = null;
        document.getElementById('btnLimpiar').style.display = 'none';
        document.getElementById('infoPanel').style.display = 'none';
        mostrarEstado('Capa limpiada correctamente', 'info');
    }
}

// Obtener ubicación del usuario
function obtenerUbicacion() {
    if (!navigator.geolocation) {
        mostrarEstado('Tu navegador no soporta geolocalización', 'error');
        return;
    }
    
    mostrarEstado('Obteniendo tu ubicación...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            userLocation = [lat, lon];
            
            // Actualizar display de coordenadas
            document.getElementById('coordenadas').textContent = 
                `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`;
            document.getElementById('locationInfo').style.display = 'block';
            
            // Centrar mapa en ubicación
            map.setView([lat, lon], 16);
            
            // Agregar marcador de ubicación
            if (window.userMarker) {
                map.removeLayer(window.userMarker);
            }
            
            window.userMarker = L.marker([lat, lon], {
                icon: L.divIcon({
                    className: 'user-location-marker',
                    html: '<div style="background: #007bff; color: white; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            }).addTo(map);
            
            window.userMarker.bindPopup('📍 Tu ubicación actual').openPopup();
            
            mostrarEstado('✅ Ubicación obtenida correctamente', 'success');
        },
        (error) => {
            let mensaje = 'Error al obtener ubicación';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    mensaje = 'Permiso de ubicación denegado';
                    break;
                case error.POSITION_UNAVAILABLE:
                    mensaje = 'Ubicación no disponible';
                    break;
                case error.TIMEOUT:
                    mensaje = 'Tiempo de espera agotado';
                    break;
            }
            mostrarEstado('❌ ' + mensaje, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Mostrar estado
function mostrarEstado(mensaje, tipo) {
    const status = document.getElementById('status');
    status.textContent = mensaje;
    status.className = 'status ' + tipo;
    
    setTimeout(() => {
        status.style.display = 'none';
    }, 5000);
}

// Mostrar estado de ruta
function mostrarEstadoRuta(mensaje, tipo) {
    const status = document.getElementById('routeStatus');
    status.textContent = mensaje;
    status.className = tipo;
    
    setTimeout(() => {
        status.style.display = 'none';
    }, 5000);
}

// Alternar visibilidad de configuración
function toggleConfig() {
    const panel = document.getElementById('configPanel');
    const btn = document.querySelector('.show-config');
    
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
        btn.textContent = '⚙️ Mostrar Configuración';
    } else {
        panel.style.display = 'block';
        btn.textContent = '⚙️ Ocultar Configuración';
    }
}

// Alternar paneles
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    const toggleBtn = document.getElementById(panelId.replace('Panel', 'ToggleBtn'));
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        if (toggleBtn) toggleBtn.classList.add('visible');
    } else {
        panel.classList.add('hidden');
        if (toggleBtn) toggleBtn.classList.remove('visible');
    }
}

// Inicializar paneles - todos retráctiles por defecto
function initPanels() {
    // Ocultar todos los paneles al inicio
    document.getElementById('controlPanel').classList.add('hidden');
    document.getElementById('legendPanel').classList.add('hidden');
    document.getElementById('creditsPanel').classList.add('hidden');
    document.getElementById('routePanel').classList.add('hidden');
    
    // Mostrar todos los botones de toggle
    document.getElementById('panelToggleBtn').classList.add('visible');
    document.getElementById('legendToggleBtn').classList.add('visible');
    document.getElementById('creditsToggleBtn').classList.add('visible');
    document.getElementById('routeToggleBtn').classList.add('visible');
    
    // Mostrar botones de cierre en todos los paneles
    document.querySelectorAll('.panel-close').forEach(btn => {
        btn.classList.add('visible');
    });
}

// FUNCIONES DE RUTEO

// Usar ubicación actual como origen
function usarUbicacionActual(tipo) {
    if (!userLocation) {
        obtenerUbicacion();
        setTimeout(() => {
            if (userLocation) {
                document.getElementById('origenLat').value = userLocation[0].toFixed(6);
                document.getElementById('origenLon').value = userLocation[1].toFixed(6);
            }
        }, 2000);
    } else {
        if (tipo === 'origen') {
            document.getElementById('origenLat').value = userLocation[0].toFixed(6);
            document.getElementById('origenLon').value = userLocation[1].toFixed(6);
            mostrarEstadoRuta('✅ Ubicación actual establecida como origen', 'success');
        }
    }
}

// Seleccionar punto en el mapa
function seleccionarEnMapa(tipo) {
    seleccionandoPunto = tipo;
    mostrarEstadoRuta(`🎯 Haz clic en el mapa para seleccionar el punto ${tipo === 'origen' ? 'de origen' : 'de destino'}`, 'info');
    
    // Cambiar cursor del mapa
    document.getElementById('map').style.cursor = 'crosshair';
}

// Agregar punto seleccionado
function agregarPuntoSeleccionado(latlng) {
    if (!seleccionandoPunto) return;
    
    const lat = latlng.lat;
    const lon = latlng.lng;
    
    if (seleccionandoPunto === 'origen') {
        document.getElementById('origenLat').value = lat.toFixed(6);
        document.getElementById('origenLon').value = lon.toFixed(6);
        
        // Agregar marcador visual
        if (origenMarker) map.removeLayer(origenMarker);
        origenMarker = L.marker([lat, lon], { icon: origenIcon }).addTo(map);
        origenMarker.bindPopup('📍 Punto de origen').openPopup();
        
        mostrarEstadoRuta('✅ Punto de origen seleccionado', 'success');
    } else if (seleccionandoPunto === 'destino') {
        document.getElementById('destinoLat').value = lat.toFixed(6);
        document.getElementById('destinoLon').value = lon.toFixed(6);
        
        // Agregar marcador visual
        if (destinoMarker) map.removeLayer(destinoMarker);
        destinoMarker = L.marker([lat, lon], { icon: destinoIcon }).addTo(map);
        destinoMarker.bindPopup('🏁 Punto de destino').openPopup();
        
        mostrarEstadoRuta('✅ Punto de destino seleccionado', 'success');
    }
    
    // Restaurar cursor
    document.getElementById('map').style.cursor = '';
    seleccionandoPunto = null;
}

// Calcular ruta usando OpenRouteService
async function calcularRuta() {
    const origenLat = parseFloat(document.getElementById('origenLat').value);
    const origenLon = parseFloat(document.getElementById('origenLon').value);
    const destinoLat = parseFloat(document.getElementById('destinoLat').value);
    const destinoLon = parseFloat(document.getElementById('destinoLon').value);
    const profile = document.getElementById('routeProfile').value;
    
    // Validar coordenadas
    if (isNaN(origenLat) || isNaN(origenLon) || isNaN(destinoLat) || isNaN(destinoLon)) {
        mostrarEstadoRuta('❌ Por favor ingresa coordenadas válidas para origen y destino', 'error');
        return;
    }
    
    mostrarEstadoRuta('🔄 Calculando ruta...', 'info');
    
    try {
        // Usar API de OpenRouteService (necesitas obtener una API key gratuita)
        // Para este ejemplo, usaremos OSRM que es público
        const url = `https://router.project-osrm.org/route/v1/${profile === 'driving-car' ? 'driving' : profile === 'cycling-regular' ? 'cycling' : 'foot'}/${origenLon},${origenLat};${destinoLon},${destinoLat}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error al calcular ruta');
        
        const data = await response.json();
        
        if (data.code !== 'Ok') {
            throw new Error('No se pudo encontrar una ruta');
        }
        
        const route = data.routes[0];
        currentRoute = route;
        
        // Limpiar ruta anterior
        if (routeLayer) {
            map.removeLayer(routeLayer);
        }
        
        // Dibujar ruta en el mapa
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        
        routeLayer = L.polyline(coordinates, {
            color: '#667eea',
            weight: 5,
            opacity: 0.7,
            smoothFactor: 1
        }).addTo(map);
        
        // Agregar marcadores de origen y destino si no existen
        if (!origenMarker) {
            origenMarker = L.marker([origenLat, origenLon], { icon: origenIcon }).addTo(map);
            origenMarker.bindPopup('📍 Origen');
        }
        
        if (!destinoMarker) {
            destinoMarker = L.marker([destinoLat, destinoLon], { icon: destinoIcon }).addTo(map);
            destinoMarker.bindPopup('🏁 Destino');
        }
        
        // Ajustar vista a la ruta
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
        
        // Mostrar información de la ruta
        const distanceKm = (route.distance / 1000).toFixed(2);
        const durationMin = Math.round(route.duration / 60);
        
        document.getElementById('routeDistance').textContent = `${distanceKm} km`;
        document.getElementById('routeDuration').textContent = `${durationMin} minutos`;
        document.getElementById('routeType').textContent = getProfileName(profile);
        document.getElementById('routeInfo').style.display = 'block';
        document.getElementById('btnLimpiarRuta').style.display = 'block';
        
        mostrarEstadoRuta(`✅ Ruta calculada: ${distanceKm} km, ${durationMin} min`, 'success');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarEstadoRuta('❌ Error al calcular ruta: ' + error.message, 'error');
    }
}

// Obtener nombre del perfil de ruta
function getProfileName(profile) {
    const profiles = {
        'driving-car': '🚗 Auto',
        'cycling-regular': '🚴 Bicicleta',
        'foot-walking': '🚶 A pie'
    };
    return profiles[profile] || profile;
}

// Limpiar ruta
function limpiarRuta() {
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
    
    if (origenMarker) {
        map.removeLayer(origenMarker);
        origenMarker = null;
    }
    
    if (destinoMarker) {
        map.removeLayer(destinoMarker);
        destinoMarker = null;
    }
    
    document.getElementById('origenLat').value = '';
    document.getElementById('origenLon').value = '';
    document.getElementById('destinoLat').value = '';
    document.getElementById('destinoLon').value = '';
    document.getElementById('routeInfo').style.display = 'none';
    document.getElementById('btnLimpiarRuta').style.display = 'none';
    
    currentRoute = null;
    
    mostrarEstadoRuta('🗑️ Ruta limpiada', 'info');
}

// Inicializar aplicación al cargar
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    
    // Ajustar responsive en cambio de tamaño de ventana
    window.addEventListener('resize', function() {
        // Los paneles siempre son retráctiles en cualquier tamaño de pantalla
        // Solo ajustamos el posicionamiento si es necesario
        if (window.innerWidth <= 768) {
            // Asegurar que los controles estén en la posición correcta para móvil
            const zoomControl = document.querySelector('.leaflet-control-zoom');
            if (zoomControl) {
                zoomControl.style.top = '20%';
                zoomControl.style.right = '10px';
            }
        }
    });
});
