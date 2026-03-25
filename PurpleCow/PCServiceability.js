const DEFAULT_ADDRESS = "61 Raddall Avenue, Dartmouth, NS, Canada";
const DEFAULT_LAT  = 44.701519;
const DEFAULT_LNG  = -63.586197;

const WEIRD_SHEET_ID = "1pQmdCH4r2LDkOKAiBgFXL3diZzgOTY3PQgaPHp4WgMk";
const WEIRD_CSV_URL  = `https://docs.google.com/spreadsheets/d/${WEIRD_SHEET_ID}/export?format=csv&gid=0`;

const CITY_SHEET_ID = "1d3ww34fNYMcDfJE0hCoXMExc7yCeMwnvA4LI5bFQowI";
const CITY_CSV_URL  = `https://docs.google.com/spreadsheets/d/${CITY_SHEET_ID}/export?format=csv&gid=0`;

const PROVINCE_COLS = {
  NS: { yes: 0, no: 1 },
  PE: { yes: 2, no: 3 },
  NL: { yes: 4, no: 5 },
};

const SERVICEABLE_PROVINCES = ["NS", "PE", "NL"];

// Full name → abbreviation (all lowercase for comparison)
const ROAD_ABBREVIATIONS = {
  "avenue": "ave", "boulevard": "blvd", "circle": "cir", "close": "cl",
  "court": "ct", "crescent": "cres", "drive": "dr", "expressway": "expy",
  "freeway": "fwy", "gardens": "gdns", "gate": "gt", "grove": "grv",
  "heights": "hts", "highway": "hwy", "lane": "ln", "loop": "loop",
  "park": "pk", "parkway": "pkwy", "place": "pl", "plaza": "plaza",
  "road": "rd", "route": "rte", "run": "run", "square": "sq",
  "street": "st", "terrace": "terr", "trail": "trl", "way": "way",
};

// Reverse: abbreviation → full name
const ROAD_ABBREV_TO_FULL = Object.fromEntries(
  Object.entries(ROAD_ABBREVIATIONS).map(([full, abbr]) => [abbr, full])
);

// Direction full → abbreviation
const DIRECTION_ABBREVIATIONS = {
  "east": "e", "west": "w", "north": "n", "south": "s",
  "northeast": "ne", "northwest": "nw", "southeast": "se", "southwest": "sw",
};

// Direction abbreviation → full
const DIRECTION_ABBREV_TO_FULL = Object.fromEntries(
  Object.entries(DIRECTION_ABBREVIATIONS).map(([full, abbr]) => [abbr, full])
);

let map, marker, autocomplete;
let blocklistData = [];
let cityData      = [];
let lastAddressParts = null;

// ── Sheet loading ─────────────────────────────────────────────────────────────

async function loadSheets() {
  await Promise.all([loadBlocklist(), loadCitySheet()]);
}

async function loadBlocklist() {
  try {
    const res  = await fetch(WEIRD_CSV_URL);
    if (!res.ok) throw new Error();
    const text = await res.text();
    const lines = text.trim().split("\n");
    blocklistData = [];
    for (let i = 1; i < lines.length; i++) {
      const c = splitCSVLine(lines[i]);
      if (c.length < 4) continue;
      blocklistData.push({
        streetNumber: norm(c[0]),
        streetName:   norm(c[1]),
        city:         norm(c[2]),
        province:     (c[3] || "").trim().toUpperCase(),
        reason:       (c[4] || "").trim(),
      });
    }
  } catch { console.warn("Could not load blocklist sheet"); }
}

async function loadCitySheet() {
  try {
    const res  = await fetch(CITY_CSV_URL);
    if (!res.ok) throw new Error();
    const text = await res.text();
    const lines = text.trim().split("\n");
    cityData = [];
    for (let i = 1; i < lines.length; i++) {
      const c = splitCSVLine(lines[i]);
      cityData.push(c.map(v => norm(v)));
    }
  } catch { console.warn("Could not load city sheet"); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function norm(s) { return (s || "").trim().toLowerCase(); }

function splitCSVLine(line) {
  const result = [];
  let field = "", inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(field); field = ""; }
    else { field += ch; }
  }
  result.push(field);
  return result;
}

function setBadge(id, status, text) {
  const el = document.getElementById(id);
  el.className = "badge " + status;
  el.textContent = text;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Converts a street name to display format with proper abbreviations.
// "Main Street East" → "Main St E", "South Park Street" → "South Park St"
function shortenStreetName(fullName) {
  if (!fullName) return "";
  const words = fullName.trim().split(" ");

  const last = words[words.length - 1].toLowerCase();
  const hasTrailingDirection = !!DIRECTION_ABBREVIATIONS[last];

  if (hasTrailingDirection) {
    words[words.length - 1] = DIRECTION_ABBREVIATIONS[last].toUpperCase();
    if (words.length >= 2) {
      const roadWord = words[words.length - 2].toLowerCase();
      if (ROAD_ABBREVIATIONS[roadWord]) {
        words[words.length - 2] = capitalize(ROAD_ABBREVIATIONS[roadWord]);
      }
    }
  } else {
    if (ROAD_ABBREVIATIONS[last]) {
      words[words.length - 1] = capitalize(ROAD_ABBREVIATIONS[last]);
    }
  }

  return words.join(" ");
}

// Expands all abbreviations in a street name to full words for comparison.
// "marketway ln" → "marketway lane", "main st e" → "main street east"
// This means sheet entries can be written in any form and still match.
function expandStreetName(name) {
  if (!name) return "";
  const words = name.trim().toLowerCase().split(" ");

  // Expand trailing direction abbreviation (e.g. "e" → "east")
  const last = words[words.length - 1];
  const lastExpanded = DIRECTION_ABBREV_TO_FULL[last] || null;
  if (lastExpanded) {
    words[words.length - 1] = lastExpanded;
  }

  // Expand road type — second-to-last if direction was found, otherwise last
  const roadIdx = lastExpanded ? words.length - 2 : words.length - 1;
  if (roadIdx >= 0) {
    const roadWord = words[roadIdx];
    if (ROAD_ABBREV_TO_FULL[roadWord]) {
      words[roadIdx] = ROAD_ABBREV_TO_FULL[roadWord];
    }
  }

  return words.join(" ");
}

// ── Address display ───────────────────────────────────────────────────────────

function updateAddressDisplay(components) {
  const getComp = type => (components.find(c => c.types.includes(type)) || {});

  const streetNumber = (getComp("street_number").long_name  || "").trim();
  const streetName   = shortenStreetName(getComp("route").long_name || "");
  const city         = (getComp("locality").long_name       || "").trim();
  const province     = (getComp("administrative_area_level_1").short_name || "").trim();
  const postalCode   = (getComp("postal_code").long_name    || "").trim();

  lastAddressParts = { streetNumber, streetName, city, province, postalCode };

  document.getElementById("addr-line1").textContent = `${streetNumber} ${streetName}`.trim();
  document.getElementById("addr-line2").textContent = city;
  document.getElementById("addr-line3").textContent = province;
  document.getElementById("addr-line4").textContent = postalCode;

  document.getElementById("address-display").style.display = "block";
}

function copyAddress() {
  if (!lastAddressParts) return;
  const { streetNumber, streetName, city, province, postalCode } = lastAddressParts;
  const text = [streetNumber, streetName, city, province, postalCode]
    .filter(Boolean)
    .join(" ");
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("copy-btn");
    const original = btn.innerHTML;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.innerHTML = original; }, 1500);
  });
}

// ── Serviceability checks ─────────────────────────────────────────────────────

function provinceCheck(province) {
  if (!province) return { status: "yellow", label: "Unknown" };
  if (SERVICEABLE_PROVINCES.includes(province)) return { status: "green", label: "Serviceable" };
  return { status: "red", label: "Not Serviceable" };
}

function cityCheck(city, province) {
  if (province && !SERVICEABLE_PROVINCES.includes(province)) {
    return { status: "red", label: "Parent Not Serviceable" };
  }
  if (!city || !province || !PROVINCE_COLS[province]) {
    return { status: "yellow", label: "Unknown Serviceability" };
  }
  const cols = PROVINCE_COLS[province];
  if (cityData.some(row => row[cols.yes] === city)) return { status: "green", label: "Serviceable" };
  if (cityData.some(row => row[cols.no]  === city)) return { status: "red",   label: "Not Serviceable" };
  return { status: "yellow", label: "Unknown Serviceability" };
}

function weirdBuildingsCheck(streetNumber, streetName, city, province, cityStatus) {
  if (cityStatus === "red") return { status: "red", label: "Parent Not Serviceable", reason: "" };

  // Expand both sides to full words before comparing so "ln", "lane", "Lane" all match
  const expandedSearch = expandStreetName(streetName);

  const match = blocklistData.find(row => {
    const expandedRow = expandStreetName(row.streetName);
    const numMatch  = !row.streetNumber || row.streetNumber === streetNumber;
    const nameMatch = expandedSearch.includes(expandedRow) || expandedRow.includes(expandedSearch);
    const cityMatch = !row.city || row.city === city;
    const provMatch = !row.province || row.province === province;
    return numMatch && nameMatch && cityMatch && provMatch;
  });

  if (match) return { status: "red", label: "Not Serviceable", reason: match.reason || "" };
  return { status: "green", label: "Serviceable", reason: "" };
}

// ── Run all checks ────────────────────────────────────────────────────────────

function runChecks(addressComponents) {
  document.getElementById("checks-section").style.display = "block";

  if (!addressComponents || addressComponents.length === 0) {
    setBadge("chk-province", "yellow", "Unknown Serviceability");
    setBadge("chk-city",     "yellow", "Unknown Serviceability");
    setBadge("chk-weird",    "yellow", "Unknown Serviceability");
    document.getElementById("chk-weird-reason").textContent = "";
    return;
  }

  updateAddressDisplay(addressComponents);

  const getComp = type => (addressComponents.find(c => c.types.includes(type)) || {});

  const streetNumber = norm(getComp("street_number").long_name);
  const streetName   = norm(shortenStreetName(getComp("route").long_name));
  const city         = norm(getComp("locality").long_name);
  const province     = (getComp("administrative_area_level_1").short_name || "").trim().toUpperCase();

  const prov  = provinceCheck(province);
  setBadge("chk-province", prov.status, prov.label);

  const cty   = cityCheck(city, province);
  setBadge("chk-city", cty.status, cty.label);

  const weird = weirdBuildingsCheck(streetNumber, streetName, city, province, cty.status);
  setBadge("chk-weird", weird.status, weird.label);
  document.getElementById("chk-weird-reason").textContent = weird.reason || "";
}

// ── Google Maps ───────────────────────────────────────────────────────────────

function initMap() {
  loadSheets();

  const defaultPos = { lat: DEFAULT_LAT, lng: DEFAULT_LNG };

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultPos,
    zoom: 12,
    mapTypeControl: false,
    styles: [
      { elementType: "geometry",            stylers: [{ color: "#1a1a25" }] },
      { elementType: "labels.text.stroke",  stylers: [{ color: "#1a1a25" }] },
      { elementType: "labels.text.fill",    stylers: [{ color: "#6b6880" }] },
      { featureType: "road",               elementType: "geometry",       stylers: [{ color: "#2a2a38" }] },
      { featureType: "road",               elementType: "geometry.stroke",stylers: [{ color: "#17171f" }] },
      { featureType: "road",               elementType: "labels.text.fill",stylers: [{ color: "#9490a8" }] },
      { featureType: "road.highway",       elementType: "geometry",       stylers: [{ color: "#38384a" }] },
      { featureType: "road.highway",       elementType: "labels.text.fill",stylers: [{ color: "#b8b4cc" }] },
      { featureType: "water",              elementType: "geometry",       stylers: [{ color: "#0d0d14" }] },
      { featureType: "water",              elementType: "labels.text.fill",stylers: [{ color: "#3a3650" }] },
      { featureType: "poi",                elementType: "geometry",       stylers: [{ color: "#1e1e2a" }] },
      { featureType: "poi.park",           elementType: "geometry",       stylers: [{ color: "#181e1a" }] },
      { featureType: "poi.park",           elementType: "labels.text.fill",stylers: [{ color: "#3a4a3a" }] },
      { featureType: "transit",            elementType: "geometry",       stylers: [{ color: "#20202c" }] },
      { featureType: "administrative",     elementType: "geometry.stroke",stylers: [{ color: "#2a2a38" }] },
      { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#9b6dff" }] },
    ],
  });

  marker = new google.maps.Marker({
    position: defaultPos,
    map,
    animation: google.maps.Animation.DROP,
  });

  autocomplete = new google.maps.places.Autocomplete(
    document.getElementById("address-input"),
    { types: ["address"] }
  );

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place.geometry) return;
    moveToPlace(place);
  });
}

function moveToPlace(place) {
  const loc = place.geometry.location;
  map.setCenter(loc);
  map.setZoom(12);
  marker.setPosition(loc);
  marker.setAnimation(google.maps.Animation.DROP);
  runChecks(place.address_components);
}

function navigateToAddress() {
  const val = document.getElementById("address-input").value.trim();
  if (!val) return;

  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address: val }, (results, status) => {
    if (status === "OK" && results[0]) {
      const loc = results[0].geometry.location;
      map.setCenter(loc);
      marker.setPosition(loc);
      marker.setAnimation(google.maps.Animation.DROP);
      runChecks(results[0].address_components);
    } else {
      alert("Address not found. Try a more specific query.");
    }
  });
}

// ── Slack integration ─────────────────────────────────────────────────────────

function copySlackMessage(serve) {
  if (!lastAddressParts) return;
  const { streetNumber, streetName, city, province, postalCode } = lastAddressParts;
  const address = [streetNumber, streetName, city, province, postalCode]
    .filter(Boolean)
    .join(" ");
  const message = `Please add this address as ${serve}serviceable "${address}"`;
  navigator.clipboard.writeText(message);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("address-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") navigateToAddress();
  });
});