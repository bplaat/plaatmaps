function to_radians(degrees) {
    return (degrees * Math.PI) / 180;
}
function to_degrees(radians) {
    return (radians * 180) / Math.PI;
}
function longitude_to_tile_x(longitude, zoom) {
    return Math.pow(2, zoom) * ((longitude + 180) / 360);
}
function latitude_to_tile_y(latitude, zoom) {
    return (
        (Math.pow(2, zoom) *
            (1 - Math.log(Math.tan(to_radians(latitude)) + 1 / Math.cos(to_radians(latitude))) / Math.PI)) /
        2
    );
}
function tile_x_to_longitude(x, zoom) {
    return (x / Math.pow(2, zoom)) * 360 - 180;
}
function tile_y_to_latitude(y, zoom) {
    return to_degrees(Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / Math.pow(2, zoom)))));
}
class LatLng {
    constructor(latitude, longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }
    distanceTo(b) {
        const earthRadiusKm = 6371000;
        return (
            earthRadiusKm *
            2 *
            Math.asin(
                Math.sqrt(
                    Math.pow(Math.sin((to_radians(b.latitude) - to_radians(this.latitude)) / 2), 2) +
                        Math.cos(to_radians(this.latitude)) *
                            Math.cos(to_radians(b.latitude)) *
                            Math.pow(Math.sin((to_radians(b.longitude) - to_radians(this.longitude)) / 2), 2),
                ),
            )
        );
    }
}
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let width, height, scale;
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    scale = window.devicePixelRatio;
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(scale, scale);
}
resize();
window.addEventListener('resize', resize);
const TILE_SIZE = 256;
const MAX_LATITUDE = 85.0511287798066;
const MAX_TILES = 256;
const center =
    localStorage.center != null
        ? new LatLng(parseFloat(localStorage.center.split(',')[0]), parseFloat(localStorage.center.split(',')[1]))
        : new LatLng(30, 0);
let zoom = localStorage.zoom != null ? parseInt(localStorage.zoom) : 3;
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
function setCenter(newCenter) {
    center.latitude = Math.min(Math.max(newCenter.latitude, -MAX_LATITUDE), MAX_LATITUDE);
    center.longitude = Math.min(Math.max(newCenter.longitude, -180), 180);
    localStorage.center = `${center.latitude},${center.longitude}`;
}
function setZoom(newZoom) {
    zoom = Math.min(Math.max(newZoom, 2), 19);
    localStorage.zoom = zoom;
}
const scaleMaxWidth = 100;
const attributionText = '© OpenStreetMap contributors';
const attributionUrl = 'https://www.openstreetmap.org/copyright';
const iconNormal = new Image();
iconNormal.src = 'assets/icon-48x48.png';
const iconHiDpi = new Image();
iconHiDpi.src = 'assets/icon-96x96.png';
let peoplesWidth, peoplesHeight;
let attributionWidth, attributionHeight;
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});
canvas.addEventListener('mousedown', (e) => {
    if (e.button == 0) {
        if (e.clientX >= width - peoplesWidth && e.clientY < peoplesHeight) {
            return;
        }
        if (e.clientX >= width - attributionWidth && e.clientY >= height - attributionHeight) {
            return;
        }
        for (const btn of getButtons()) {
            if (isInButton(btn, e.clientX, e.clientY)) return;
        }
        isDragging = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grab';
    }
});
canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        setCenter(
            new LatLng(
                tile_y_to_latitude(latitude_to_tile_y(center.latitude, zoom) - deltaY / TILE_SIZE, zoom),
                tile_x_to_longitude(longitude_to_tile_x(center.longitude, zoom) - deltaX / TILE_SIZE, zoom),
            ),
        );
        lastMousePos = { x: e.clientX, y: e.clientY };
        return;
    }
    if (e.clientX >= width - peoplesWidth && e.clientY < peoplesHeight) {
        canvas.style.cursor = 'pointer';
    } else if (e.clientX >= width - attributionWidth && e.clientY >= height - attributionHeight) {
        canvas.style.cursor = 'pointer';
    } else if (getButtons().some((btn) => isInButton(btn, e.clientX, e.clientY))) {
        canvas.style.cursor = 'pointer';
    } else {
        canvas.style.cursor = 'default';
    }
});
canvas.addEventListener('mouseup', (e) => {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'default';
        return;
    }
    if (e.button == 0) {
        for (const btn of getButtons()) {
            if (isInButton(btn, e.clientX, e.clientY)) {
                if (btn.action === 'zoom-in') setZoom(Math.min(zoom + 1, 19));
                else if (btn.action === 'zoom-out') setZoom(Math.max(zoom - 1, 2));
                else if (btn.action === 'geo') toggleGeo();
                return;
            }
        }
        if (e.clientX >= width - peoplesWidth && e.clientY < peoplesHeight) {
            window.open('https://github.com/SerenityOS/user-map', '_blank');
            return;
        }
        if (e.clientX >= width - attributionWidth && e.clientY >= height - attributionHeight) {
            window.open(attributionUrl, '_blank');
            return;
        }
    }
});
canvas.addEventListener('dblclick', (e) => {
    const newZoom = zoom + 1;
    if (newZoom < 2 || newZoom > 19) return;
    setCenter(
        new LatLng(
            tile_y_to_latitude(
                latitude_to_tile_y(center.latitude, newZoom) + (e.clientY - height / 2) / TILE_SIZE,
                newZoom,
            ),
            tile_x_to_longitude(
                longitude_to_tile_x(center.longitude, newZoom) + (e.clientX - width / 2) / TILE_SIZE,
                newZoom,
            ),
        ),
    );
    setZoom(newZoom);
});
const WHEEL_ZOOM_THRESHOLD = 120;
let wheelAccumulator = 0;
canvas.addEventListener(
    'wheel',
    (e) => {
        e.preventDefault();
        wheelAccumulator += e.deltaY;
        if (Math.abs(wheelAccumulator) < WHEEL_ZOOM_THRESHOLD) return;
        const steps = Math.trunc(wheelAccumulator / WHEEL_ZOOM_THRESHOLD);
        wheelAccumulator -= steps * WHEEL_ZOOM_THRESHOLD;
        const newZoom = Math.min(Math.max(zoom - steps, 2), 19);
        if (newZoom === zoom) return;
        if (newZoom < zoom) {
            setCenter(
                new LatLng(
                    tile_y_to_latitude(
                        latitude_to_tile_y(center.latitude, zoom) - (e.clientY - height / 2) / TILE_SIZE,
                        zoom,
                    ),
                    tile_x_to_longitude(
                        longitude_to_tile_x(center.longitude, zoom) - (e.clientX - width / 2) / TILE_SIZE,
                        zoom,
                    ),
                ),
            );
        } else {
            setCenter(
                new LatLng(
                    tile_y_to_latitude(
                        latitude_to_tile_y(center.latitude, newZoom) + (e.clientY - height / 2) / TILE_SIZE,
                        newZoom,
                    ),
                    tile_x_to_longitude(
                        longitude_to_tile_x(center.longitude, newZoom) + (e.clientX - width / 2) / TILE_SIZE,
                        newZoom,
                    ),
                ),
            );
        }
        setZoom(newZoom);
    },
    { passive: false },
);
const tiles = [];
function getTile(x, y, tileZoom) {
    for (const tile of tiles) if (tile.x == x && tile.y == y && tile.zoom == tileZoom) return tile;
    const image = new Image();
    image.src = `https://c.tile.openstreetmap.org/${tileZoom}/${x}/${y}.png`;
    const tile = { x, y, zoom: tileZoom, image };
    if (tiles.length > MAX_TILES) tiles.shift();
    tiles.push(tile);
    return tile;
}
function paintMap() {
    const hiDpi = scale >= 2 && zoom < 19;
    const renderZoom = hiDpi ? zoom + 1 : zoom;
    const renderTileSize = hiDpi ? TILE_SIZE / 2 : TILE_SIZE;

    const centerTileX = Math.floor(longitude_to_tile_x(center.longitude, zoom));
    const centerTileY = Math.floor(latitude_to_tile_y(center.latitude, zoom));
    const offsetX = (longitude_to_tile_x(center.longitude, zoom) - centerTileX) * TILE_SIZE;
    const offsetY = (latitude_to_tile_y(center.latitude, zoom) - centerTileY) * TILE_SIZE;

    const renderCenterTileX = Math.floor(longitude_to_tile_x(center.longitude, renderZoom));
    const renderCenterTileY = Math.floor(latitude_to_tile_y(center.latitude, renderZoom));
    const renderOffsetX = (longitude_to_tile_x(center.longitude, renderZoom) - renderCenterTileX) * renderTileSize;
    const renderOffsetY = (latitude_to_tile_y(center.latitude, renderZoom) - renderCenterTileY) * renderTileSize;

    const gridWidth = Math.ceil(width / renderTileSize);
    const gridHeight = Math.ceil(height / renderTileSize);
    const dxMin = -Math.floor(gridWidth / 2) - 1;
    const dxMax = Math.floor(gridWidth / 2) + 1;
    const dyMin = -Math.floor(gridHeight / 2) - 1;
    const dyMax = Math.floor(gridHeight / 2) + 1;
    const tileCoords = [];
    for (let dy = dyMin; dy <= dyMax; dy++) {
        for (let dx = dxMin; dx <= dxMax; dx++) {
            tileCoords.push({ dx, dy });
        }
    }
    tileCoords.sort((a, b) => a.dx * a.dx + a.dy * a.dy - (b.dx * b.dx + b.dy * b.dy));
    const maxTileIndex = Math.pow(2, renderZoom) - 1;
    for (const { dx, dy } of tileCoords) {
        const tileX = renderCenterTileX + dx;
        const tileY = renderCenterTileY + dy;
        if (tileX < 0 || tileY < 0 || tileX > maxTileIndex || tileY > maxTileIndex) continue;
        const tile = getTile(tileX, tileY, renderZoom);
        if (tile.image.width != 0)
            ctx.drawImage(
                tile.image,
                width / 2 + dx * renderTileSize - renderOffsetX,
                height / 2 + dy * renderTileSize - renderOffsetY,
                renderTileSize,
                renderTileSize,
            );
    }
    if (userLocation) {
        const userX =
            (longitude_to_tile_x(userLocation.longitude, zoom) - centerTileX) * TILE_SIZE - offsetX + width / 2;
        const userY =
            (latitude_to_tile_y(userLocation.latitude, zoom) - centerTileY) * TILE_SIZE - offsetY + height / 2;
        const tileWidthMeters =
            (360 / Math.pow(2, zoom)) * Math.cos(to_radians(center.latitude)) * (Math.PI / 180) * 6371000;
        const accuracyRadius = Math.max(8, (userLocation.accuracy * TILE_SIZE) / tileWidthMeters);
        ctx.fillStyle = 'rgba(66, 133, 244, 0.15)';
        ctx.beginPath();
        ctx.arc(userX, userY, accuracyRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(userX, userY, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4285F4';
        ctx.beginPath();
        ctx.arc(userX, userY, 7, 0, Math.PI * 2);
        ctx.fill();
    }
}
const PANEL_PADDING_X = 6;
const PANEL_PADDING_Y = 4;
const BUTTON_SIZE = 30;
const BUTTON_GAP = 2;
const BUTTON_MARGIN_X = 8;
const BUTTON_MARGIN_BOTTOM = 28;
let geoWatchId = null;
let userLocation = null;
function getButtons() {
    const x = width - BUTTON_MARGIN_X - BUTTON_SIZE;
    return [
        { x, y: height - BUTTON_MARGIN_BOTTOM - 3 * BUTTON_SIZE - 2 * BUTTON_GAP, action: 'zoom-in' },
        { x, y: height - BUTTON_MARGIN_BOTTOM - 2 * BUTTON_SIZE - BUTTON_GAP, action: 'zoom-out' },
        { x, y: height - BUTTON_MARGIN_BOTTOM - BUTTON_SIZE, action: 'geo' },
    ];
}
function isInButton(btn, cx, cy) {
    return cx >= btn.x && cx < btn.x + BUTTON_SIZE && cy >= btn.y && cy < btn.y + BUTTON_SIZE;
}
function toggleGeo() {
    if (geoWatchId !== null) {
        navigator.geolocation.clearWatch(geoWatchId);
        geoWatchId = null;
        userLocation = null;
    } else {
        let firstFix = true;
        geoWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                userLocation = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                };
                if (firstFix) {
                    setCenter(new LatLng(userLocation.latitude, userLocation.longitude));
                    setZoom(17);
                    firstFix = false;
                }
            },
            () => {
                geoWatchId = null;
                userLocation = null;
            },
            { enableHighAccuracy: true },
        );
    }
}
function niceRoundNumber(number) {
    const pow10 = Math.pow(10, Math.floor(Math.log10(Math.floor(number))));
    const d = number / pow10;
    return pow10 * (d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1);
}
function paintScaleLine(label, x, y, width, height) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, 1, height);
    ctx.fillRect(x + width - 1, y, 1, height);
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + PANEL_PADDING_X, y + PANEL_PADDING_Y);
}
function paintScale() {
    const maxMeters = center.distanceTo(
        new LatLng(
            center.latitude,
            tile_x_to_longitude(longitude_to_tile_x(center.longitude, zoom) + scaleMaxWidth / TILE_SIZE, zoom),
        ),
    );
    const marginX = 8;
    const marginY = 8;
    const lineHeight = PANEL_PADDING_Y + 12 + PANEL_PADDING_Y;
    const meters = niceRoundNumber(maxMeters);
    const metricWidth = scaleMaxWidth * (meters / maxMeters);
    paintScaleLine(
        meters < 1000 ? `${meters} m` : `${meters / 1000} km`,
        marginX,
        height - marginY - lineHeight * 2,
        metricWidth,
        lineHeight,
    );
    const maxFeet = maxMeters * 3.28084;
    const feet = niceRoundNumber(maxFeet);
    const maxMiles = maxFeet / 5280;
    const miles = niceRoundNumber(maxMiles);
    const imperialWidth = scaleMaxWidth * (feet < 5280 ? feet / maxFeet : miles / maxMiles);
    paintScaleLine(
        feet < 5280 ? `${feet} ft` : `${miles} mi`,
        marginX,
        height - marginY - lineHeight,
        imperialWidth,
        lineHeight,
    );
    ctx.fillRect(marginX, height - marginY - lineHeight, Math.max(metricWidth, imperialWidth), 1, lineHeight);
}
function paintAttribution() {
    ctx.font = '12px sans-serif';
    attributionWidth = PANEL_PADDING_X + ctx.measureText(attributionText).width + PANEL_PADDING_X;
    attributionHeight = PANEL_PADDING_Y + 12 + PANEL_PADDING_Y;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(width - attributionWidth, height - attributionHeight, attributionWidth, attributionHeight);
    ctx.fillStyle = '#222';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(attributionText, width - PANEL_PADDING_X, height - 12 - PANEL_PADDING_Y);
}
function paintButtons() {
    for (const btn of getButtons()) {
        const active = btn.action === 'geo' && geoWatchId !== null;
        ctx.fillStyle = active ? 'rgba(66, 133, 244, 0.85)' : 'rgba(255, 255, 255, 0.85)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, BUTTON_SIZE, BUTTON_SIZE, 4);
        ctx.fill();
        ctx.stroke();
        const midX = btn.x + BUTTON_SIZE / 2;
        const midY = btn.y + BUTTON_SIZE / 2;
        if (btn.action === 'zoom-in' || btn.action === 'zoom-out') {
            ctx.fillStyle = '#222';
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(btn.action === 'zoom-in' ? '+' : '−', midX, midY + 1);
        } else {
            const r = BUTTON_SIZE * 0.22;
            const arm = BUTTON_SIZE * 0.16;
            const color = active ? '#fff' : '#222';
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(midX, midY, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(midX, midY, r * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(midX, midY - r - arm);
            ctx.lineTo(midX, midY - r + 1);
            ctx.moveTo(midX, midY + r - 1);
            ctx.lineTo(midX, midY + r + arm);
            ctx.moveTo(midX - r - arm, midY);
            ctx.lineTo(midX - r + 1, midY);
            ctx.moveTo(midX + r - 1, midY);
            ctx.lineTo(midX + r + arm, midY);
            ctx.stroke();
        }
    }
}
function paintHeader() {
    const icon = scale >= 2 ? iconHiDpi : iconNormal;
    const iconSize = 48;
    const padding = 8;
    const text = 'PlaatMaps';
    ctx.font = 'bold 24px sans-serif';
    const textWidth = ctx.measureText(text).width;
    const panelHeight = padding * 3 + iconSize;
    if (icon.width != 0) ctx.drawImage(icon, padding, padding, iconSize, iconSize);
    ctx.fillStyle = '#222';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, padding + iconSize + padding, panelHeight / 2);
}
function paint() {
    ctx.fillStyle = '#ddd';
    ctx.fillRect(0, 0, width, height);
    paintMap();
    paintScale();
    paintAttribution();
    paintButtons();
    paintHeader();
}
function loop() {
    window.requestAnimationFrame(loop);
    paint();
}
loop();
