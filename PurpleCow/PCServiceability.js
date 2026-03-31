/*
* Author: nandrychuk
* Created: March 24 2026
* Last Modified: March 28 2026
* Description: Main JS for Purple Cow Serviceability Checker. Handles map display, address parsing, and serviceability logic.
*/

// Spreadsheet URLs for data that needs to updated remotely without code changes
const WEIRD_SCRIPT_ID = "AKfycbycOUxKm2oZXUrDsnFgYYwR3BumeR65Qrv0I4dbhfy27f_rJbJGql3j5I1s-spwJavO";
const WEIRD_SCRIPT_URL  = `https://script.google.com/macros/s/${WEIRD_SCRIPT_ID}/exec`;

const UPDATE_SCRIPT_ID = 'AKfycbxx2t4BZ_LFYZp0PXpcMvsQgjnwl_VbbbCSO3vAymyJr8pUmPuAO0ca2ODztXjOdWHasw';
const UPDATE_SCRIPT_URL = `https://script.google.com/macros/s/${UPDATE_SCRIPT_ID}/exec`;

// Serviceable provinces (all others are considered non-serviceable)
const SERVICEABLE_PROVINCES = ["NS", "PE", "NL"];

// Serviceable and non-serviceable cities by province
const CITY_DATA = {
  NS:  { yes: ["halifax", "dartmouth", "bedford", "lower sackville", "cole harbour", "truro", "new glasgow", "antigonish"], no: ["glace bay", "new germany", "sherbrooke", "sheet harbour", "new ross", "inverness", "tatemagouche"] },
  PE: { yes: ["charlottetown", "stratford", "summerside", "cornwall", "harringston", "kensington", "brackley beach"], no: ["johnstons river", "lennox island", "nine mile creek", "tignish"]},
  NL:  { yes: ["aspen cove", "piley's island", "red brook"], no: ["st. johns"] }
};

// Full suffix → abbreviation (all lowercase for comparison)
const ROAD_ABBREVIATIONS = {
  "avenue": "ave", "boulevard": "blvd", "circle": "cir", "close": "cl",
  "court": "ct", "crescent": "cres", "drive": "dr", "expressway": "expy",
  "freeway": "fwy", "gardens": "gdns", "gate": "gt", "grove": "grv",
  "heights": "hts", "highway": "hwy", "lane": "ln", "loop": "loop",
  "park": "pk", "parkway": "pkwy", "place": "pl", "plaza": "plaza",
  "road": "rd", "route": "rte", "run": "run", "square": "sq",
  "street": "st", "terrace": "terr", "trail": "trl", "way": "way","hill": "hill"
};

// Direction → abbreviation (all lowercase for comparison)
const DIRECTION_ABBREVIATIONS = {
  "east": "e", "west": "w", "north": "n", "south": "s",
  "northeast": "ne", "northwest": "nw", "southeast": "se", "southwest": "sw",
};


// ── Helpers ────────────────────────────────────────────────────────────────────
/**
 * Normalizes a string by trimming whitespace and converting to lowercase
 * @param s String to normalize
 * @returns The normalized String
 */
function norm(s) { return (s || "").trim().toLowerCase(); }

/**
 * Capitalizes the first letter of a word
 * @param word The word to capitalize
 * @returns The capitalized word
 */
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// ── Sheet loading ─────────────────────────────────────────────────────────────
let blocklistData = [];

/**
 * Loads the Weird addresses list into a block list to find known unserviceable addresses
 * This sheet is maintained externally and can be updated without code changes
 */
async function loadBlocklist() {
  try {
    const res = await fetch(`${WEIRD_SCRIPT_URL}?action=blocklist`);
    const text = await res.text();
    const data = JSON.parse(text);
    blocklistData = data.map(row => ({
      streetNumber: norm(String(row["Street Number"] ?? "")),
      streetName:   norm(row["Street Name"]),
      city:         norm(row["City"]),
      province:     (row["Province"] || "").trim().toUpperCase(),
      reason:       (row["Reason"] || "").trim(),
    }));
  } catch (e) { console.warn("Could not load blocklist sheet", e);}
}

/**
 * Splits a line of CSV data into fields, handling quoted fields with commas
 * @param line a line of the CSV
 * @returns resulting array of fields
 */
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

// ── Tooltip ───────────────────────────────────────────────────────────────────
let activeTooltip = null;

/**
 * Initializes tooltips by attaching mouseenter and mouseleave events to elements with the "tooltip" class
 */
function initTooltips() {
  document.querySelectorAll(".tooltip").forEach(el => {
    // Read the text content from the hidden .tooltip-text span, then remove it
    const textEl = el.querySelector(".tooltip-text");
    if (!textEl) return;
    const html = textEl.innerHTML;
    textEl.remove();

    el.addEventListener("mouseenter", (e) => {
      const popup = document.createElement("div");
      popup.className = "tooltip-popup";
      popup.innerHTML = html;
      document.body.appendChild(popup);
      activeTooltip = popup;

      positionTooltip(popup, el);

      requestAnimationFrame(() => popup.classList.add("visible"));
    });

    el.addEventListener("mouseleave", () => {
      if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
      }
    });
  });
}

/**
 * Positions the tooltip popup element above the anchor element, adjusting to keep it within the viewport
 * @param popup 
 * @param anchor 
 */
function positionTooltip(popup, anchor) {
  const rect = anchor.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();

  let top  = rect.top - popupRect.height - 8;
  let left = rect.left + rect.width / 2 - popupRect.width / 2;

  // Keep within viewport horizontally
  if (left < 8) left = 8;
  if (left + popupRect.width > window.innerWidth - 8) {
    left = window.innerWidth - popupRect.width - 8;
  }

  // If it would go above the viewport, show below instead
  if (top < 8) top = rect.bottom + 8;

  popup.style.top  = `${top}px`;
  popup.style.left = `${left}px`;
}

// ── Address display ───────────────────────────────────────────────────────────
let lastAddressParts = null;

/**
 * Updates the address display with the provided address
 * @param components List of address components from Google Maps API geocoding result
 */
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

/**
 * Converts a street name to display format with proper abbreviations
 * "Main Street" → "Main St", "Main Street East" → "Main St E", "South Park Street" → "South Park St"
 * @param fullName Full street name from Google API
 * @returns Shortened street name with abbreviations
 */
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

// ── Copy Functions ────────────────────────────────────────────────────────────

/**
 * Copies full address to clipboard in a single line format (e.g. "123 Main St, Halifax, NS, A1A 1A1") and shows a temporary "Copied!" message on the button
 */
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

/**
 * Copies just the street name to clipboard
 */
function copyStreetName() {
  if (!lastAddressParts) return;
  navigator.clipboard.writeText(lastAddressParts.streetName);
}

// ── Report Modal ──────────────────────────────────────────────────────────────

/**
 * Opens the report modal and pre-fills it with the current address. Also performs a quick check to see if this address has already been reported and shows a warning if so
 */
async function openReportModal() {
  if (!lastAddressParts) {
    alert("Please search for an address first.");
    return;
  }

  const { streetNumber, streetName, city, province } = lastAddressParts;

  // Open modal immediately in loading state
  document.getElementById("modal-address-label").textContent =
    `${streetNumber} ${streetName}, ${city}, ${province}`;
  
  document.getElementById("modal-warning").innerHTML = `
  <div class="modal-warning">
    <span class="spinner-inline"></span>
    <span>Connecting to spreadsheet...</span>
  </div>`;

  document.getElementById("modal-action").value = "Add";
  document.getElementById("modal-reason").value = "";

  //disable inputs while loading
  document.getElementById("modal-action").disabled = true;
  document.getElementById("modal-reason").disabled = true;

  document.getElementById("modal-overlay").style.display = "flex";

  // async check in background
  const checkUrl = `${UPDATE_SCRIPT_URL}?action=check&streetNumber=${encodeURIComponent(streetNumber)}&streetName=${encodeURIComponent(streetName)}`;

  try {
    const res = await fetch(checkUrl);
    const data = await res.json();

    let existing = "";
    if(data.exists > 0){
      let timeStr = data.time;
      timeStr = timeStr.replace("T", " ");
      timeStr = timeStr.replace(".000Z", "");

      existing = `<div class="modal-warning">⚠️ This address may already be in the sheet. (${data.addOrRemove} | ${timeStr})</div>`;
    }

    document.getElementById("modal-warning").innerHTML = existing;

  } catch {
    document.getElementById("modal-warning").innerHTML =
      `<div class="modal-warning">⚠️ Could not connect to spreadsheet.</div>`;
  }

  // Re-enable inputs after loading
  document.getElementById("modal-action").disabled = false;
  document.getElementById("modal-reason").disabled = false;
}

/**
 * Closes the report modal when cancel is pressed
 */
function closeReportModal() {
  document.getElementById("modal-overlay").style.display = "none";
}

/**
 * Submits the report to the app script, which will add it to the spreadsheet. Also handles UI state changes for loading and error/success feedback
 */
async function submitReport() {
  if (!lastAddressParts) return;

  const submitBtn = document.getElementById("modal-submit-btn");
  const spinner   = document.getElementById("submit-spinner");
  const text      = document.getElementById("submit-text");

  // Prevent double clicks
  if (submitBtn.disabled) return;
  submitBtn.disabled = true;
  spinner.style.display = "inline-block";
  text.textContent = "Submitting...";

  // Disable all modal inputs
  document.getElementById("modal-action").disabled = true;
  document.getElementById("modal-reason").disabled = true;
  document.getElementById("modal-overlay").style.pointerEvents = "none";

  const { streetNumber, streetName, city, province } = lastAddressParts;
  const action2 = document.getElementById("modal-action").value;
  const reason  = document.getElementById("modal-reason").value.trim();

  try {
    await fetch(UPDATE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "submit",
        streetNumber,
        streetName,
        city,
        province,
        action2,
        reason,
      }),
    });

    closeReportModal();
    alert("Submitted successfully!");

  } catch {
    alert("Submission failed. Check your connection.");
  } finally {
    // Reset modal UI state regardless of success or failure
    submitBtn.disabled = false;
    spinner.style.display = "none";
    text.textContent = "Submit";

    document.getElementById("modal-action").disabled = false;
    document.getElementById("modal-reason").disabled = false;
    document.getElementById("modal-overlay").style.pointerEvents = "auto";
  }
}

// ── Serviceability checks ─────────────────────────────────────────────────────

/**
 * Checks that the province is serviceable
 * @param province The province code (e.g. "NS") to check
 * @returns The serviceability status and label
 */
function provinceCheck(province) {
  if (!province) return { status: "yellow", label: "Unknown" };
  if (SERVICEABLE_PROVINCES.includes(province)) return { status: "green", label: "Serviceable" };
  return { status: "red", label: "Not Serviceable" };
}

/**
 * Checks if a location is within a service circle
 * @param lat Latitude of the location
 * @param lng Longitude of the location
 * @param provStatus Status of the province
 * @returns The serviceability status and label
 */
function serviceCircleCheck(lat, lng, provStatus) {
  if (provStatus === "red") return { status: "red", label: "Parent Not Serviceable" };
  if (lat == null || lng == null) return { status: "yellow", label: "Unknown Serviceability" };

  const inCircle = COVERAGE_CIRCLES.some(circle =>
    haversineDistance(lat, lng, circle.lat, circle.lng) <= circle.radius
  );

  return inCircle
    ? { status: "green", label: "Serviceable" }
    : { status: "yellow", label: "Unknown Serviceability" };
}

/**
 * Returns the distance in metres between two lat/lng points (Haversine formula)
 * @param lat1 Latitude of address point
 * @param lng1 Longitude of address point
 * @param lat2 Latitude of circle center
 * @param lng2 Longitude of circle center
 * @returns Distance in metres
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in metres
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Checks if a city is serviceable
 * @param city The city name to check
 * @param province The province code to check
 * @param circleStatus Status of the service circle
 * @returns The serviceability status and label
 */
function cityCheck(city, province, circleStatus) {
  if (circleStatus === "red") return { status: "red", label: "Parent Not Serviceable" };
  
  if (!city || !province) {
    return { status: "yellow", label: "Unknown Serviceability" };
  }

  let provinceKey = CITY_DATA[province];

  if (provinceKey.yes.includes(city)) return { status: "green", label: "Serviceable" };
  if (provinceKey.no.includes(city)) return { status: "red",   label: "Not Serviceable" };
  return { status: "yellow", label: "Unknown Serviceability" };
}

/**
 * Checks the weird buildings blocklist to see if this address is a known unserviceable building
 * @param streetNumber
 * @param streetName 
 * @param city 
 * @param province 
 * @param cityStatus 
 * @returns The serviceability status and label
 */
function weirdBuildingsCheck(streetNumber, streetName, city, province, cityStatus) {
  if (cityStatus === "red") return { status: "red", label: "Parent Not Serviceable", reason: "" };

  const match = blocklistData.find(row => {
    const numMatch  = !row.streetNumber || row.streetNumber === streetNumber;
    const nameMatch = streetName.includes(row.streetName) || row.streetName.includes(streetName);
    const cityMatch = !row.city || row.city === city;
    const provMatch = !row.province || row.province === province;
    return numMatch && nameMatch && cityMatch && provMatch;
  });

  if (match) return { status: "red", label: "Not Serviceable", reason: match.reason || "" };
  return { status: "green", label: "Serviceable", reason: "" };
}

/**
 * Sets the badge for each check's 
 * @param id HTML element ID of the badge to update
 * @param status Colour status of the badge ("green", "yellow", "red")
 * @param text Text content for the badge
 */
function setBadge(id, status, text) {
  const el = document.getElementById(id);
  el.className = "badge " + status;
  el.textContent = text;
}

// ── Run all checks ────────────────────────────────────────────────────────────

/**
 * Runs all serviceability checks for the given address
 * @param addressComponents Address components from Google Maps API geocoding result
 * @param lat Latitude of the address
 * @param lng Longitude of the address
 */
function runChecks(addressComponents, lat, lng) {
  document.getElementById("checks-section").style.display = "block";
  document.getElementById("sheets-section").style.display = "block";

  if (!addressComponents || addressComponents.length === 0) {
    setBadge("chk-province", "yellow", "Unknown Serviceability");
    setBadge("chk-city",     "yellow", "Unknown Serviceability");
    setBadge("chk-weird",    "yellow", "Unknown Serviceability");
    setBadge("chk-circle",   "yellow", "Unknown Serviceability");
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

  const circle = serviceCircleCheck(lat, lng, prov.status);
  setBadge("chk-circle", circle.status, circle.label);

  const cty   = cityCheck(city, province, circle.status);
  setBadge("chk-city", cty.status, cty.label);

  const weird = weirdBuildingsCheck(streetNumber, streetName, city, province, cty.status);
  setBadge("chk-weird", weird.status, weird.label);
  document.getElementById("chk-weird-reason").textContent = weird.reason || "";
}

// ── Static Coverage Circles ───────────────────────────────────────────────────

const COVERAGE_CIRCLES = [
  {lat: 44.5966022, lng: -63.7105155, radius: 23905.73201623598},{lat: 44.7381769, lng: -63.3574157, radius: 10064.355224177314},{lat: 44.9123792, lng: -63.542032, radius: 9004.786677786491},{lat: 44.8632331, lng: -63.8627749, radius: 9813.258251369423},{lat: 44.9890412, lng: -64.1043355, radius: 11111.604937291248},
  {lat: 44.5564081, lng: -64.2069511, radius: 11286.620695196347},{lat: 44.3647268, lng: -64.3013562, radius: 9702.432984406729},{lat: 44.4528457, lng: -64.3825491, radius: 6613.887301955533},{lat: 44.3465331, lng: -64.5359924, radius: 8675.403415089464},{lat: 44.0313518, lng: -64.732119, radius: 10687.867777415147},
  {lat: 43.7699014, lng: -65.3316854, radius: 11176.56208583594},{lat: 43.535391, lng: -65.625604, radius: 13845.898452599842},{lat: 43.8724149, lng: -66.1057462, radius: 11909.12629591659},{lat: 44.149703, lng: -66.1695834, radius: 11148.31168812508},{lat: 44.4004508, lng: -65.9926622, radius: 8690.288709106935},
  {lat: 44.6466415, lng: -65.7403115, radius: 6447.6326110587015},{lat: 44.7732095, lng: -65.5112364, radius: 8819.854967054198},{lat: 44.8309462, lng: -65.275621, radius: 6427.640677357964},{lat: 44.9081528, lng: -65.0810247, radius: 8840.687918573132},{lat: 44.9896455, lng: -64.9307172, radius: 8915.61229614551},
  {lat: 45.0374616, lng: -64.7677709, radius: 9086.888132122178},{lat: 45.0937994, lng: -64.4486729, radius: 11806.034034434602},{lat: 45.0882794, lng: -63.4041979, radius: 8189.7006517245345},{lat: 45.3843174, lng: -63.3690784, radius: 13251.525626519408},{lat: 45.5922944, lng: -62.7033744, radius: 16307.5808200943},
  {lat: 45.6295356, lng: -61.9881744, radius: 10093.369638467906},{lat: 45.6266483, lng: -61.3814099, radius: 7353.199891942494},{lat: 45.4043616, lng: -61.5124937, radius: 7494.773031454091},{lat: 45.538622, lng: -61.0686535, radius: 7163.314423568605},{lat: 45.6055345, lng: -61.0706099, radius: 5352.662547644931},
  {lat: 45.6666905, lng: -60.8919893, radius: 6650.897721913495},{lat: 46.167176, lng: -60.261952, radius: 13014.21321839763},{lat: 45.8421725, lng: -64.2109676, radius: 9276.113839274469},{lat: 45.6293147, lng: -64.0632052, radius: 7757.529681654253},{lat: 45.7261512, lng: -63.8873904, radius: 7843.155315000371},
  {lat: 46.8121946, lng: -64.0989341, radius: 2530.0522703577767},{lat: 46.7144474, lng: -64.1762068, radius: 2415.6481564348455},{lat: 46.456543, lng: -64.0038077, radius: 1930.0610183673225},{lat: 46.3944133, lng: -64.0075691, radius: 2043.4127441676653},{lat: 46.4497286, lng: -63.8763372, radius: 2575.0329540797093},
  {lat: 46.4123777, lng: -63.8800986, radius: 2223.4478285478813},{lat: 46.4132813, lng: -63.7871911, radius: 5248.0979121287255},{lat: 46.4215617, lng: -63.6878345, radius: 2409.1908004459724},{lat: 46.3129185, lng: -63.6411002, radius: 1970.6851690817075},{lat: 46.2098409, lng: -63.5382008, radius: 2634.6709564264024},
  {lat: 46.3942996, lng: -63.2529423, radius: 3112.0738625160184},{lat: 46.3441928, lng: -63.2411665, radius: 2246.983018211794},{lat: 46.3123818, lng: -63.2093437, radius: 2225.645450468457},{lat: 46.2913652, lng: -63.2596714, radius: 2365.8729895482743},{lat: 46.3751474, lng: -63.0624082, radius: 2046.740104866228},
  {lat: 46.2522708, lng: -63.1911013, radius: 4690.945380589635},{lat: 46.2063028, lng: -63.2672237, radius: 3063.110411499526},{lat: 46.2097954, lng: -63.1019414, radius: 3228.8402205044663},{lat: 46.354229, lng: -62.9047762, radius: 2869.4991907924496},{lat: 46.4098381, lng: -62.7171067, radius: 2555.3432949856738},
  {lat: 46.3596622, lng: -62.3328069, radius: 2229.1329549485768},{lat: 46.354631, lng: -62.2676193, radius: 2546.382282478023},{lat: 46.1630507, lng: -62.6535483, radius: 3738.169108128385},{lat: 47.4498659, lng: -53.1952144, radius: 7408.450803204812},{lat: 47.5761393, lng: -53.2874381, radius: 7930.681320125343},
  {lat: 47.7079058, lng: -53.2382562, radius: 6531.543101656282},{lat: 47.5624008, lng: -53.6547949, radius: 6487.026052652553},{lat: 47.4374135, lng: -53.5246788, radius: 7569.024055999807},{lat: 48.0336994, lng: -53.0045145, radius: 6847.169832273295},{lat: 48.6543568, lng: -53.094259, radius: 6480.402015053612},
  {lat: 48.416571, lng: -53.9110319, radius: 6703.5975378476605},{lat: 47.0554264, lng: -55.1748726, radius: 8225.01823554812},{lat: 40994652, lng: -55.7200743, radius: 8158.925019802726},{lat: 49.3474078, lng: -54.6760473, radius: 5336.71614380389},{lat: 49.4359067, lng: -54.0981869, radius: 4656.489923437576},
  {lat: 49.2547031, lng: -55.0696864, radius: 5281.758940530723},{lat: 49.5176514, lng: -55.7190393, radius: 4735.603995366502},{lat: 48.3851988, lng: -58.5913337, radius: 6537.390403810688},{lat: 48.6211178, lng: -58.4949808, radius: 7728.745906289985},{lat: 48.5346561, lng: -59.1268124, radius: 6787.859980987226}
];

/**
 * Draws the coverage circles on the Google Map based on the predefined COVERAGE_CIRCLES
 */
function drawCoverageCircles() {
  COVERAGE_CIRCLES.forEach(({ lat, lng, radius }) => {
    new google.maps.Circle({
      map,
      center:      { lat, lng },
      radius:      radius,
      strokeColor:   "#60b4ff",
      strokeOpacity: 0.6,
      strokeWeight:  1.5,
      fillColor:     "#60b4ff",
      fillOpacity:   0.08,
    });
  });
}

// ── Google Maps ───────────────────────────────────────────────────────────────
let map, marker, autocomplete;


function initMap() {
  loadBlocklist();

  //Defaults to our warehouse at 61 Raddall Avenue, Dartmouth
  const defaultPos = { lat: 44.701519, lng: -63.586197 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultPos,
    zoom: 10,
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

  drawCoverageCircles();

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
  map.setZoom(10);
  marker.setPosition(loc);
  marker.setAnimation(google.maps.Animation.DROP);
  runChecks(place.address_components, loc.lat(), loc.lng());
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
      runChecks(results[0].address_components, loc.lat(), loc.lng());
    } else {
      alert("Address not found. Try a more specific query.");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("address-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") navigateToAddress();
  });

  initTooltips();
});