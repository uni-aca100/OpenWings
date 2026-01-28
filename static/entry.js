/* leaflet setup */
const map = L.map('map').setView([46.868, 7.888], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);


// wrapper for bird map related functions, and data state
const speciesMapHandler = {
  lastScientificName: null,
  lastLayer: null,

  /* get the color style based on its season */
  getBirdStyle(feature) {
    switch (feature.properties.season) {
      case 'nonbreeding': return { color: "#800080", fillColor: "#800080", fillOpacity: 0.5 }; // Purple
      case 'breeding': return { color: "#FF0000", fillColor: "#FF0000", fillOpacity: 0.5 }; // Red
      case 'postbreeding_migration': return { color: "#0000FF", fillColor: "#0000FF", fillOpacity: 0.5 }; // Blue
      case 'prebreeding_migration': return { color: "#FFFF00", fillColor: "#FFFF00", fillOpacity: 0.5 }; // Yellow
      default: return { color: "#cccccc", fillOpacity: 0.2 };                       // Missing
    }
  },

  /* fetch and update the map data based on selected species and season */
  fetchAndUpdateGeoJsonData(speciesName, season) {
    // no need to refetch if the same data is already loaded
    if (this.lastGeoJsonData?.properties?.species_scientific_name === speciesName &&
      this.lastGeoJsonData?.properties?.season === season)
      return;

    // fetch and update the map data based on selected species and season
    fetch(`/api/species/geojson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ speciesName, season }),
    })
      .then(response => response.json())
      .then(data => {
        if (this.lastLayer) {
          map.removeLayer(this.lastLayer);
        }
        this.lastScientificName = data[0]?.properties?.species_scientific_name;
        this.lastLayer = L.geoJSON(data, {
          style: this.getBirdStyle
        })
        this.lastLayer.addTo(map);
      });
  },

  fetchAndUpdateSeasonGeoJsonData(season) {
    console.log(this.lastScientificName, season);
    this.fetchAndUpdateGeoJsonData(this.lastScientificName, season);
  },
};

// wrapper for species info related functions and data state
const speciesInfoHandler = {
  lastData: null,

  /* fetch and update the species info panel */
  fetchAndUpdateSpeciesInfo(speciesName) {
    // no need to refetch if the same data is already loaded
    if (this.lastData?.scientific_name === speciesName)
      return;

    // fetch and update the species info panel
    fetch(`/api/species/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ speciesName }),
    })
      .then(response => response.json())
      .then(data => {
        this.lastData = data;
        document.getElementById('js-common-name').innerText = data.common_name;
        document.getElementById('js-scientific-name').innerText = data.scientific_name;
        document.getElementById('js-family').innerText = data.family;
        document.getElementById('js-order').innerText = data.order_name;
        document.getElementById('js-diet').innerText = data.diet;
        document.getElementById('js-conservation').innerText = data.conservation_status;
      });
  }
};

const birdImgHandler = {
  /* fetch and update the bird images */
  fetchAndUpdateBirdImages(speciesName) {
    // fetch and update the bird images
    fetch(`/api/species/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ speciesName }),
    })
      .then(response => response.json())
      .then(data => {
        if (!data || data.length === 0) {
          console.log('No images found for species:', speciesName);
        }
        this.insertImages(data); // it will insert the default image if data is empty
      });
  },

  // data is an array of image information { URL, license, contributor }
  // insert the images into the image elements present in the HTML
  insertImages(data) {
    const wrapper = document.getElementById('js-bird-body-wrap');
    const imgElements = wrapper.querySelectorAll('.bird-img');
    imgElements.forEach((imgElement, index) => {
      if (imgElement) {
        imgElement.src = data[index]?.url ?? 'static/images/611-400x400-blur_2-grayscale.jpg'; // default image if not enough images
      }
    });
  }
};

// wrapper for handling the entire bird species information view
const birdSpeciesViewHandler = {
  /* update the entire view based on selected species and season */
  updateViewData(speciesName, season) {
    speciesMapHandler.fetchAndUpdateGeoJsonData(speciesName, season);
    speciesInfoHandler.fetchAndUpdateSpeciesInfo(speciesName);
    birdImgHandler.fetchAndUpdateBirdImages(speciesName);
  },
};

/* --- init page data section ---*/
birdSpeciesViewHandler.updateViewData('Coracias garrulus', 'breeding');

/* --- event listeners section ---*/
// on search button click find the species and update the view
document.getElementById('js-search-btn').addEventListener('click', (e) => {
  e.preventDefault();
  const speciesName = document.getElementById('js-search-input').value;
  // breeding season is default for new searches
  birdSpeciesViewHandler.updateViewData(speciesName, 'breeding');
});

// on season button click update the map data
document.getElementById('js-season-select').addEventListener('click', (e) => {
  if (e.target && e.target.matches('button.season-btn')) {
    const season = e.target.getAttribute('data-season');
    speciesMapHandler.fetchAndUpdateSeasonGeoJsonData(season);
  }
});