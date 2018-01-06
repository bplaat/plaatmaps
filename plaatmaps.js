var map = L.map('map'), marker;
map.attributionControl.setPrefix('');
map.zoomControl.setPosition('bottomright');
L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
}).addTo(map);
L.control.scale().addTo(map);

var searchForm = document.getElementById('search-form');
var searchInput = document.getElementById('search-input');
var searchButton = document.getElementById('search-button');

var locationButton = document.createElement('a');
locationButton.id = 'location-button';
locationButton.href = '#';
locationButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>';
map.zoomControl.getContainer().appendChild(locationButton);

function doSearch(changeView) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
        var data = JSON.parse(xhr.responseText)[0];
        if (data) {
            if (changeView) map.fitBounds([[data.boundingbox[0], data.boundingbox[2]], [data.boundingbox[1], data.boundingbox[3]]]);
            if (!marker) {
                marker = L.marker([data.lat, data.lon]).addTo(map);
            } else {
                marker.setLatLng([data.lat, data.lon]);
            }
            marker.off('click').on('click', function () {
                map.fitBounds([[data.boundingbox[0], data.boundingbox[2]], [data.boundingbox[1], data.boundingbox[3]]]);
            });
        } else {
            alert('Place not found!');
        }
    };
    xhr.open('GET', 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(searchInput.value) + '&format=json&limit=1');
    xhr.send();
}

if (window.location.hash !== '') {
    var query = {}, vars = window.location.hash.substring(1).split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        query[pair[0]] = pair[1];
    }

    var loc = query.map.split('/');
    map.setView([loc[0], loc[1]], loc[2]);

    if (query.search) {
        searchInput.value = decodeURIComponent(query.search);
        doSearch(false);
    }
} else {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
        var data = JSON.parse(xhr.responseText);
        map.setView([data.latitude, data.longitude], 13);
    };
    xhr.open('GET', 'https://ipapi.co/json');
    xhr.send();
}

map.on('moveend', function () {
    window.location.hash = 'map=' + map.getCenter().lat.toFixed(4) + '/' + map.getCenter().lng.toFixed(4) + '/' + map.getZoom() +
        (searchInput.value !== '' ? ('&search=' + encodeURIComponent(searchInput.value)) : '');
});

searchForm.addEventListener('submit', function (event) {
    event.preventDefault();
    searchInput.blur();
    searchButton.blur();
    doSearch(true);
});

locationButton.addEventListener('click', function (event) {
    event.preventDefault();
    map.locate({ setView: true });
});

map.on('locationfound', function (event) {
    if (!marker) {
        marker = L.marker(event.latlng).addTo(map);
    } else {
        marker.setLatLng(event.latlng);
    }
    marker.off('click').on('click', function () {
        map.fitBounds(event.bounds);
    });
});

map.on('locationerror', function (error) {
    alert('Location errror: ' + error.message);
})