// Esperar a que el DOM esté completamente cargado
let map;
let capaActual = null;

// Inicializar el mapa cuando la página esté lista
document.addEventListener('DOMContentLoaded', function() {
    initMap();
});

function initMap() {
    // Crear el mapa
    map = L.map('map').setView([-16.5, -68.15], 13);
    
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    });
    
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap contributors',
        maxZoom: 17
    });
    
    const baseMaps = {
        "🗺️ Mapa": osm,
        "🛰️ Satélite": satellite,
        "⛰️ Topográfico": topo
    };
    
    L.control.layers(baseMaps).addTo(map);
    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);
    
    // Cargar la capa automáticamente después de 500ms
    setTimeout(cargarCapa, 500);
}

function toggleConfig() {
    const panel = document.getElementById('configPanel');
    const btn = event.target;
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        btn.textContent = '⚙️ Ocultar Configuración';
    } else {
        panel.style.display = 'none';
        btn.textContent = '⚙️ Mostrar Configuración';
    }
}

function crearIconoCamara(color) {
    const svgIcon = `
        <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="16" fill="#fafafa" stroke="#4a4a4a" stroke-width="2.5"/>
            <circle cx="20" cy="20" r="11.5" fill="none" stroke="${color}" stroke-width="2.5"/>
            <g transform="translate(20, 20)">
                <rect x="-7" y="-3.9" width="5" height="1.8" fill="${color}" rx="0.6"/>
                <rect x="2" y="-3.9" width="5" height="1.8" fill="${color}" rx="0.6"/>
                <rect x="-7" y="0" width="5" height="1.8" fill="${color}" rx="0.6"/>
                <rect x="2" y="0" width="5" height="1.8" fill="${color}" rx="0.6"/>
                <rect x="-7" y="3.9" width="5" height="1.8" fill="${color}" rx="0.6"/>
                <rect x="2" y="3.9" width="5" height="1.8" fill="${color}" rx="0.6"/>
            </g>
        </svg>
    `;
    
    return L.divIcon({
        html: svgIcon,
        className: 'custom-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });
}

function convertirGoogleDriveUrl(url) {
    if (!url) return '';
    let fileId = '';
    if (url.includes('/file/d/')) {
        fileId = url.split('/file/d/')[1].split('/')[0];
    } else if (url.includes('id=')) {
        fileId = url.split('id=')[1].split('&')[0];
    } else if (url.includes('/open?id=')) {
        fileId = url.split('/open?id=')[1].split('&')[0];
    }
    if (fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }
    return url;
}

async function cargarCapa() {
    const url = document.getElementById('url').value.trim();
    const key = document.getElementById('key').value.trim();
    const tabla = document.getElementById('tabla').value.trim();
    const geomField = document.getElementById('geomField').value.trim();
    
    if (!url || !key || !tabla) {
        mostrarStatus('error', '⚠️ Por favor completa todos los campos obligatorios');
        return;
    }
    
    mostrarStatus('info', '⏳ Cargando datos desde Supabase...');
    
    try {
        const query = `${url}/rest/v1/${tabla}?select=*,${geomField}`;
        const res = await fetch(query, {
            headers: { 
                'apikey': key, 
                'Authorization': `Bearer ${key}`,
                'Accept': 'application/json'
            }
        });
        
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || `Error HTTP ${res.status}`);
        }
        
        const data = await res.json();
        
        if (!data || data.length === 0) {
            mostrarStatus('error', '⚠️ No se encontraron datos en la tabla');
            return;
        }
        
        if (capaActual) {
            map.removeLayer(capaActual);
        }
        
        const puntos = [];
        let bounds = L.latLngBounds();
        let errores = 0;
        
        data.forEach((row, index) => {
            try {
                let lat, lng;
                
                if (row[geomField]) {
                    const geom = row[geomField];
                    
                    if (typeof geom === 'object' && geom.coordinates) {
                        lng = geom.coordinates[0];
                        lat = geom.coordinates[1];
                    }
                    else if (typeof geom === 'string' && geom.includes('POINT')) {
                        const coords = geom.match(/POINT\s*\(\s*([^\s]+)\s+([^\s]+)\s*\)/i);
                        if (coords) {
                            lng = parseFloat(coords[1]);
                            lat = parseFloat(coords[2]);
                        }
                    }
                    else if (typeof geom === 'string' && geom.includes(',')) {
                        const parts = geom.split(',').map(p => parseFloat(p.trim()));
                        if (Math.abs(parts[0]) > Math.abs(parts[1])) {
                            lat = parts[0];
                            lng = parts[1];
                        } else {
                            lng = parts[0];
                            lat = parts[1];
                        }
                    }
                }
                
                if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                        const color = getColor(row.accesibili);
                        const icon = crearIconoCamara(color);
                        const marker = L.marker([lat, lng], { icon: icon });
                        
                        let popupContent = `<div>`;
                        popupContent += `<div class="popup-title">${row.cod_cam || row.ca_id || row.codigo || row.id || `Punto ${index + 1}`}</div>`;
                        
                        const fotoCampo = row.foto_cam_d || row['foto cam d'] || row.foto_camd || row.foto || row.imagen || row.url_foto;
                        if (fotoCampo) {
                            const fotoUrl = convertirGoogleDriveUrl(fotoCampo);
                            popupContent += `<div class="popup-image-container">`;
                            popupContent += `<img src="${fotoUrl}" alt="Foto de cámara" class="popup-image" onerror="this.style.display='none'; this.parentElement.innerHTML='<small class=image-loading>❌ Imagen no disponible</small>'" />`;
                            popupContent += `</div>`;
                        }
                        
                        const camposImportantes = ['tipo_ca', 'tipo de ca', 'tipo', 'estado_ca', 'estado de', 'estado', 'accesibili', 'accesibilidad', 'observaciones', 'notas'];
                        const camposMostrados = new Set();
                        
                        camposImportantes.forEach(campo => {
                            if (row[campo] && !camposMostrados.has(campo.toLowerCase().replace(/[_\s]/g, ''))) {
                                const nombreCampo = campo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                popupContent += `<div class="popup-row">`;
                                popupContent += `<div class="popup-label">${nombreCampo}:</div>`;
                                popupContent += `<div class="popup-value">${row[campo]}</div>`;
                                popupContent += `</div>`;
                                camposMostrados.add(campo.toLowerCase().replace(/[_\s]/g, ''));
                            }
                        });
                        
                        popupContent += `<div class="popup-row">`;
                        popupContent += `<div class="popup-label">Coordenadas:</div>`;
                        popupContent += `<div class="popup-value">${lat.toFixed(6)}°, ${lng.toFixed(6)}°</div>`;
                        popupContent += `</div></div>`;
                        
                        marker.bindPopup(popupContent, { maxWidth: 350, className: 'custom-popup' });
                        puntos.push(marker);
                        bounds.extend([lat, lng]);
                    } else {
                        errores++;
                    }
                } else {
                    errores++;
                }
            } catch (e) {
                errores++;
                console.error('Error procesando punto:', e, row);
            }
        });
        
        if (puntos.length === 0) {
            mostrarStatus('error', `❌ No se pudieron cargar puntos válidos`);
            return;
        }
        
        capaActual = L.layerGroup(puntos).addTo(map);
        
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
        
        document.getElementById('btnLimpiar').style.display = 'block';
        document.getElementById('totalPuntos').textContent = puntos.length;
        document.getElementById('ultimaActualizacion').textContent = new Date().toLocaleString('es-BO');
        document.getElementById('infoPanel').style.display = 'block';
        
        let mensaje = `✅ ${puntos.length} puntos cargados correctamente`;
        if (errores > 0) mensaje += ` (${errores} con error)`;
        mostrarStatus('success', mensaje);
        
    } catch (e) {
        console.error('Error:', e);
        mostrarStatus('error', `❌ Error: ${e.message}`);
    }
}

function limpiarCapa() {
    if (capaActual) {
        map.removeLayer(capaActual);
        capaActual = null;
        document.getElementById('btnLimpiar').style.display = 'none';
        document.getElementById('infoPanel').style.display = 'none';
        mostrarStatus('info', '🗑️ Capa eliminada');
        map.setView([-16.5, -68.15], 13);
    }
}

function mostrarStatus(tipo, mensaje) {
    const status = document.getElementById('status');
    status.className = `status ${tipo}`;
    status.textContent = mensaje;
    status.style.display = 'block';
    if (tipo === 'success' || tipo === 'info') {
        setTimeout(() => { status.style.display = 'none'; }, 5000);
    }
}

function getColor(accesibilidad) {
    if (!accesibilidad) return '#808080';
    const acc = accesibilidad.toString().toUpperCase();
    if (acc.includes('ACCESIBLE OPERATIVO') || acc.includes('OPERATIVO')) return '#28a745';
    if (acc.includes('ACCESIBLE CON DIFICULTAD') || acc.includes('CON DIFICULTAD') || acc.includes('DIFICULTAD')) return '#ffc107';
    if (acc.includes('NO ACCESIBLE') || acc.includes('INACCESIBLE')) return '#dc3545';
    if (acc.includes('INFERIDO')) return '#6c757d';
    return '#17a2b8';
}
