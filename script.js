// Variables globales
let map;
let capaActual = null;
let userLocation = null;
let routeLayers = []; // Array para múltiples rutas
let origenMarker = null;
let destinoMarker = null;
let seleccionandoPunto = null;
let currentRoutes = []; // Array para guardar múltiples rutas

// Función para convertir URLs de Google Drive a URLs de imagen directa
function convertDriveUrl(url) {
    if (!url || typeof url !== 'string') return url;
    
    let fileId = null;
    
    // Patrón 1: https://drive.google.com/file/d/FILE_ID/view...
    let match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
        fileId = match[1];
    }
    
    // Patrón 2: https://drive.google.com/open?id=FILE_ID
    if (!fileId) {
        match = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
        if (match) {
            fileId = match[1];
        }
    }
    
    // Patrón 3: id=FILE_ID en cualquier parte de la URL (funciona para uc?export=download&id=XXX)
    if (!fileId) {
        match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match) {
            fileId = match[1];
        }
    }
    
    // Patrón 4: ID directo (solo letras, números, guiones y guiones bajos, min 20 chars)
    if (!fileId && /^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) {
        fileId = url.trim();
    }
    
    // Si encontramos un ID, devolver URL de imagen directa
    if (fileId) {
        console.log('ID encontrado:', fileId);
        // Usar thumbnail de Google Drive con tamaño grande
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    
    // Si no coincide con ningún patrón de Drive, devolver URL original
    return url;
}

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
    // Crear mapa centrado en Oruro, Bolivia
    map = L.map('map').setView([-17.9647, -67.1064], 14);
    
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

// Función de estilo para cámaras basado en campo "accesibili"
function getStyle(feature) {
    const accesibili = feature.properties?.accesibili?.toLowerCase() || 'otro';
    
    const estilos = {
        'accesible operativo': { color: '#28a745', fillColor: '#28a745' },
        'accesible con dificultad': { color: '#ffc107', fillColor: '#ffc107' },
        'inferido': { color: '#6c757d', fillColor: '#6c757d' },
        'no accesible': { color: '#dc3545', fillColor: '#dc3545' }
    };
    
    return {
        radius: 8,
        fillColor: estilos[accesibili]?.fillColor || '#17a2b8',
        color: estilos[accesibili]?.color || '#17a2b8',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    };
}

// Crear icono SVG para marcadores basado en campo "accesibili"
function createCustomIcon(accesibili) {
    const colorMap = {
        'accesible operativo': '#28a745',
        'accesible con dificultad': '#ffc107',
        'inferido': '#6c757d',
        'no accesible': '#dc3545'
    };
    
    const color = colorMap[accesibili?.toLowerCase()] || '#17a2b8';
    
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
        
        // Crear capa de marcadores (featureGroup para poder usar getBounds)
        capaActual = L.featureGroup();
        
        let puntoNumero = 0; // Contador de puntos
        
        data.forEach(feature => {
            if (feature[geomField]) {
                try {
                    const geom = typeof feature[geomField] === 'string' 
                        ? JSON.parse(feature[geomField]) 
                        : feature[geomField];
                    
                    if (geom.type === 'Point') {
                        puntoNumero++; // Incrementar contador
                        
                        const [lon, lat] = geom.coordinates;
                        const accesibili = feature.accesibili || 'Otro estado';
                        
                        const marker = L.marker([lat, lon], {
                            icon: createCustomIcon(accesibili)
                        });
                        
                        // Crear popup con título
                        let popupContent = `<div class="popup-title">📍 Cámara ${feature.cod_cam || puntoNumero}</div>`;
                        
                        // Debug: mostrar todos los campos disponibles
                        console.log('Campos disponibles:', Object.keys(feature));
                        console.log('Valor fot_cam_q:', feature.fot_cam_q);
                        
                        // 1. FOTO al inicio - buscar en varios campos posibles
                        let fotoUrl = feature.fot_cam_q || feature.fot_cam_d || feature.foto || feature.imagen || feature.img;
                        
                        // Buscar cualquier campo que contenga 'fot' o 'img'
                        if (!fotoUrl) {
                            for (let key of Object.keys(feature)) {
                                if ((key.toLowerCase().includes('fot') || key.toLowerCase().includes('img')) && feature[key]) {
                                    fotoUrl = feature[key];
                                    console.log('Campo de foto encontrado:', key, '=', fotoUrl);
                                    break;
                                }
                            }
                        }
                        
                        if (fotoUrl) {
                            const imageUrl = convertDriveUrl(fotoUrl);
                            console.log('URL convertida:', imageUrl);
                            popupContent += `
                                <div class="popup-image-container">
                                    <img src="${imageUrl}" class="popup-image" alt="Foto de cámara" 
                                         onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='block';" 
                                         onclick="window.open('${fotoUrl}', '_blank')">
                                    <a href="${fotoUrl}" target="_blank" class="popup-image-link" style="display:none;">📷 Ver imagen en Drive</a>
                                </div>
                            `;
                        }
                        
                        // 2. Código de cámara
                        if (feature.cod_cam) {
                            popupContent += `
                                <div class="popup-row">
                                    <span class="popup-label">Código Cámara:</span>
                                    <span class="popup-value">${feature.cod_cam}</span>
                                </div>
                            `;
                        }
                        
                        // 3. Accesibilidad
                        if (feature.accesibili) {
                            popupContent += `
                                <div class="popup-row">
                                    <span class="popup-label">Accesibilidad:</span>
                                    <span class="popup-value">${feature.accesibili}</span>
                                </div>
                            `;
                        }
                        
                        // 4. Localización
                        if (feature.localizaci) {
                            popupContent += `
                                <div class="popup-row">
                                    <span class="popup-label">Localización:</span>
                                    <span class="popup-value">${feature.localizaci}</span>
                                </div>
                            `;
                        }
                        
                        // 5. Rasante
                        if (feature.rasante) {
                            popupContent += `
                                <div class="popup-row">
                                    <span class="popup-label">Rasante:</span>
                                    <span class="popup-value">${feature.rasante}</span>
                                </div>
                            `;
                        }
                        
                        // 6. Estado
                        if (feature.estado) {
                            popupContent += `
                                <div class="popup-row">
                                    <span class="popup-label">Estado:</span>
                                    <span class="popup-value">${feature.estado}</span>
                                </div>
                            `;
                        }
                        
                        // 7. Coordenadas (del campo si existe)
                        if (feature.coordenadas) {
                            popupContent += `
                                <div class="popup-row">
                                    <span class="popup-label">Coordenadas:</span>
                                    <span class="popup-value">${feature.coordenadas}</span>
                                </div>
                            `;
                        }
                        
                        // 8. Latitud y Longitud (calculadas de la geometría)
                        popupContent += `
                            <div class="popup-row">
                                <span class="popup-label">Latitud:</span>
                                <span class="popup-value">${lat.toFixed(6)}</span>
                            </div>
                            <div class="popup-row">
                                <span class="popup-label">Longitud:</span>
                                <span class="popup-value">${lon.toFixed(6)}</span>
                            </div>
                        `;
                        
                        // Envolver contenido en un div con scroll
                        popupContent = `<div class="popup-scroll-container">${popupContent}</div>`;
                        
                        marker.bindPopup(popupContent, {
                            maxWidth: 350,
                            maxHeight: 400,
                            autoPan: true,
                            className: 'custom-popup'
                        });
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
        document.getElementById('totalPuntos').textContent = puntoNumero;
        document.getElementById('ultimaActualizacion').textContent = new Date().toLocaleString('es-BO');
        document.getElementById('infoPanel').style.display = 'block';
        
        mostrarEstado(`✅ Se cargaron ${puntoNumero} puntos correctamente`, 'success');
        
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
    
    if (panel.classList.contains('hidden')) {
        // Abrir panel
        panel.classList.remove('hidden');
    } else {
        // Cerrar panel
        panel.classList.add('hidden');
    }
    
    // Los botones siempre permanecen visibles
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

// Calcular ruta usando OpenRouteService con rutas alternativas
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
    
    mostrarEstadoRuta('🔄 Calculando rutas alternativas...', 'info');
    
    try {
        // Convertir perfil para OSRM
        const osrmProfile = profile === 'driving-car' ? 'driving' : profile === 'cycling-regular' ? 'cycling' : 'foot';
        
        // Solicitar rutas alternativas
        const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${origenLon},${origenLat};${destinoLon},${destinoLat}?overview=full&geometries=geojson&alternatives=true&steps=true`;
        
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error al calcular ruta');
        
        const data = await response.json();
        
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('No se pudo encontrar una ruta');
        }
        
        const routes = data.routes;
        currentRoutes = routes;
        
        // Limpiar rutas anteriores
        routeLayers.forEach(layer => map.removeLayer(layer));
        routeLayers = [];
        
        // Colores para diferentes rutas
        const routeColors = [
            { color: '#667eea', name: 'Ruta Principal', weight: 6, opacity: 0.8 },
            { color: '#28a745', name: 'Ruta Alternativa 1', weight: 5, opacity: 0.7 },
            { color: '#ffc107', name: 'Ruta Alternativa 2', weight: 5, opacity: 0.7 }
        ];
        
        // Dibujar todas las rutas en el mapa
        routes.forEach((route, index) => {
            if (index < 3) { // Máximo 3 rutas
                const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                const style = routeColors[index];
                
                const routeLayer = L.polyline(coordinates, {
                    color: style.color,
                    weight: style.weight,
                    opacity: style.opacity,
                    smoothFactor: 1
                }).addTo(map);
                
                // Agregar popup con información de la ruta
                const distanceKm = (route.distance / 1000).toFixed(2);
                const durationMin = Math.round(route.duration / 60);
                
                routeLayer.bindPopup(`
                    <div style="text-align: center;">
                        <strong>${style.name}</strong><br>
                        📏 ${distanceKm} km<br>
                        ⏱️ ${durationMin} min
                    </div>
                `);
                
                routeLayers.push(routeLayer);
            }
        });
        
        // Agregar marcadores de origen y destino si no existen
        if (!origenMarker) {
            origenMarker = L.marker([origenLat, origenLon], { icon: origenIcon }).addTo(map);
            origenMarker.bindPopup('📍 Origen');
        }
        
        if (!destinoMarker) {
            destinoMarker = L.marker([destinoLat, destinoLon], { icon: destinoIcon }).addTo(map);
            destinoMarker.bindPopup('🏁 Destino');
        }
        
        // Ajustar vista a todas las rutas
        const allCoordinates = [];
        routes.forEach(route => {
            route.geometry.coordinates.forEach(coord => {
                allCoordinates.push([coord[1], coord[0]]);
            });
        });
        
        if (allCoordinates.length > 0) {
            const bounds = L.latLngBounds(allCoordinates);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
        
        // Mostrar información de todas las rutas
        mostrarInformacionRutas(routes, profile);
        
        document.getElementById('btnLimpiarRuta').style.display = 'block';
        
        const numRutas = Math.min(routes.length, 3);
        mostrarEstadoRuta(`✅ Se encontraron ${numRutas} ruta(s) alternativa(s)`, 'success');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarEstadoRuta('❌ Error al calcular ruta: ' + error.message, 'error');
    }
}

// Mostrar información de múltiples rutas
function mostrarInformacionRutas(routes, profile) {
    const routeInfoDiv = document.getElementById('routeInfo');
    routeInfoDiv.innerHTML = '<h4>📊 Rutas Encontradas</h4>';
    
    const routeNames = ['Principal', 'Alternativa 1', 'Alternativa 2'];
    const routeColors = ['#667eea', '#28a745', '#ffc107'];
    
    routes.forEach((route, index) => {
        if (index < 3) {
            const distanceKm = (route.distance / 1000).toFixed(2);
            const durationMin = Math.round(route.duration / 60);
            
            routeInfoDiv.innerHTML += `
                <div class="route-detail" style="border-left: 4px solid ${routeColors[index]}; padding-left: 10px; margin: 10px 0;">
                    <strong style="color: ${routeColors[index]};">Ruta ${routeNames[index]}</strong><br>
                    📏 Distancia: <span>${distanceKm} km</span><br>
                    ⏱️ Tiempo: <span>${durationMin} minutos</span><br>
                    🚀 Tipo: <span>${getProfileName(profile)}</span>
                </div>
            `;
        }
    });
    
    routeInfoDiv.style.display = 'block';
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
    // Limpiar todas las rutas
    routeLayers.forEach(layer => map.removeLayer(layer));
    routeLayers = [];
    
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
    
    currentRoutes = [];
    
    mostrarEstadoRuta('🗑️ Rutas limpiadas', 'info');
}

// Inicializar aplicación al cargar
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    
    // Cargar capa automáticamente al iniciar
    setTimeout(() => {
        cargarCapa();
    }, 500);
    
    // Ajustar responsive en cambio de tamaño de ventana
    window.addEventListener('resize', function() {
        // Los paneles siempre son retráctiles en cualquier tamaño de pantalla
        // Ajustamos el posicionamiento del zoom para que esté centrado verticalmente
        const zoomControl = document.querySelector('.leaflet-control-zoom');
        if (zoomControl) {
            zoomControl.style.position = 'fixed';
            zoomControl.style.top = '50%';
            zoomControl.style.transform = 'translateY(-50%)';
            
            if (window.innerWidth <= 768) {
                zoomControl.style.right = '10px';
            } else {
                zoomControl.style.right = '20px';
            }
        }
    });
});
