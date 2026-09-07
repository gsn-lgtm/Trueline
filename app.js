/* Personal-use field app. Official public county GIS only. Not a survey. Not LandGlide. */
const COUNTIES = [
  { id:"jefferson", name:"Jefferson (home)", fips:"01073",
    query:"https://jccgis.jccal.org/server/rest/services/Basemap/Parcels/MapServer/0",
    vintage:"Updated nightly by Jefferson County ITS / Tax Assessor / BOE",
    official:"https://www.arcgis.com/apps/View/index.html?appid=b5118cb926c64ebeac59c8d0b01f6e45",
    assessor:"https://jeffcotaxassessor.com/",
    ownerFields:["OWNERNAME","Name2"], pinFields:["PARCELID","PID","APP_PID"],
    streetFields:["Street_Name","ADDR_APR","ADDR_PSPR"],
    center:[33.5207,-86.8025] },
  { id:"stclair", name:"St. Clair", fips:"01115",
    query:"https://map.stclairco.com/arcgis/rest/services/PublicParcelViewerStPln/MapServer/57",
    vintage:"St. Clair County Revenue Commissioner public Owner Parcels layer",
    official:"https://map.stclairco.com/arcgis/rest/services/PublicParcelViewerStPln/MapServer",
    assessor:"https://www.stclairco.com/",
    ownerFields:["NAME_1","NAME"], pinFields:["PARCELID","PPIN"],
    streetFields:["ADDRESS_1","ADDRESS_2"],
    center:[33.5862,-86.2860] },
  { id:"shelby", name:"Shelby", fips:"01117",
    query:"https://maps.shelbyal.com/gisserver/rest/services/LegacyServices/ShelbyALWebIdentify/MapServer/1",
    vintage:"Shelby County GIS Parcel Boundary 2025 identify layer",
    official:"https://maps.shelbyal.com/",
    assessor:"https://ptc.shelbyal.com/",
    ownerFields:["NAM1","NAM2"], pinFields:["Parcel_Num","PROPERTY_NUM","Assess_Num"],
    streetFields:["PROP_ADR","ADR1"],
    center:[33.2646,-86.6625] },
  { id:"blount", name:"Blount", fips:"01009", query:null,
    vintage:"KCS hosted viewer — no public query layer found; use official ISV",
    official:"https://isv.kcsgis.com/al.blount_revenue/",
    assessor:"https://blountrevenue.com/",
    center:[33.9481,-86.4728] },
  { id:"tuscaloosa", name:"Tuscaloosa", fips:"01125",
    query:"https://services.arcgis.com/AWzSDaKZ41uuVges/ArcGIS/rest/services/Parcels/FeatureServer/0",
    vintage:"Tuscaloosa Tax Assessor public layer",
    official:"https://www.tuscco.com/", assessor:"https://www.tuscco.com/",
    ownerFields:["Owner","OWNER"], pinFields:["PIN","PARCEL","PARCELID"],
    center:[33.2098,-87.5692] },
  { id:"madison", name:"Madison", fips:"01089",
    query:"https://maps.huntsvilleal.gov/server/rest/services/Boundaries/MadisonCountyParcels/MapServer/1",
    vintage:"Madison County / City of Huntsville GIS",
    official:"https://maps.huntsvilleal.gov/findaproperty/",
    assessor:"https://isv.kcsgis.com/al.madison_revenue/",
    ownerFields:["Owner","OWNERNAME"], pinFields:["PIN","PARCELID"],
    center:[34.7304,-86.5861] },
  { id:"mobile", name:"Mobile", fips:"01097",
    query:"https://services3.arcgis.com/AcvBA1fcgucsFQvO/arcgis/rest/services/PARCEL_DETAILS/FeatureServer/0",
    vintage:"Mobile County Revenue Commission tax maps",
    official:"https://gis.bisclient.com/alabama/mobilecad/index.html",
    assessor:"https://www.mobilecountyal.gov/gis-mapping/",
    ownerFields:["OWNER","Owner"], pinFields:["PIN","PARCELID"],
    center:[30.6954,-88.0399] },
  { id:"baldwin", name:"Baldwin", fips:"01003",
    query:"https://gisportal.baldwincountyal.gov/server/rest/services/SARPC/SARPC/MapServer/1",
    vintage:"Baldwin County public parcel layer",
    official:"https://isv.kcsgis.com/al.baldwin_revenue/",
    assessor:"https://isv.kcsgis.com/al.baldwin_revenue/",
    ownerFields:["Owner"], pinFields:["PIN","PARCELID","PID"],
    center:[30.6010,-87.7763] },
  { id:"montgomery", name:"Montgomery", fips:"01101", query:null,
    vintage:"Use official county GIS",
    official:"https://www.mc-ala.org/", assessor:"https://www.mc-ala.org/",
    center:[32.3792,-86.3077] },
  { id:"clay", name:"Clay", fips:"01027",
    query:"https://services1.arcgis.com/Ug5xGQbHsD8zuZzM/ArcGIS/rest/services/Clay_County_Parcels_10_23/FeatureServer/0",
    vintage:"Public layer dated Oct 2023 — prefer alabamagis.com/Clay",
    official:"https://www.alabamagis.com/Clay/", assessor:"https://www.claycountyrevenue.com/",
    ownerFields:["Owner","OWNER"], pinFields:["PIN","PARCELID"],
    center:[33.3126,-85.7527] }
];

const sel = document.getElementById("county");
COUNTIES.forEach(c => { const o=document.createElement("option"); o.value=c.id; o.textContent=c.name; sel.appendChild(o); });
let current = COUNTIES[0];

const map = L.map("map", { zoomControl:false }).setView(current.center, 14);
const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom:19, attribution:"Esri" });
const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19, attribution:"OSM" });
sat.addTo(map);
let usingSat = true;

const parcelLayer = L.geoJSON(null, {
  style: () => ({ color:"#7CFFB2", weight:2.5, fillColor:"#7CFFB2", fillOpacity:0.12 }),
  onEachFeature: (f, layer) => layer.on("click", () => renderParcel(f, current, "tap"))
}).addTo(map);
const walkLayer = L.polyline([], { color:"#4DA3FF", weight:3 }).addTo(map);
const measureLine = L.polyline([], { color:"#FF6B6B", weight:2, dashArray:"6 6" }).addTo(map);
let measuring=false, walking=false, measurePts=[], lastPos=null, lastAcc=null, locMarker=null, accCircle=null;

function pick(attrs, keys) {
  if (!attrs || !keys) return "";
  for (const k of keys) {
    if (attrs[k] != null && String(attrs[k]).trim()) return String(attrs[k]);
    const hit = Object.keys(attrs).find(x => x.toLowerCase() === k.toLowerCase());
    if (hit && attrs[hit] != null && String(attrs[hit]).trim()) return String(attrs[hit]);
  }
  return "";
}
function num(attrs, names) { const n = parseFloat(pick(attrs, names)); return Number.isFinite(n) ? n : null; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c])); }
function fmt(n,d=2){ return n==null||Number.isNaN(n)?"—":Number(n).toLocaleString(undefined,{maximumFractionDigits:d}); }
function hav(a,b){ const R=6371000,t=x=>x*Math.PI/180; const dLat=t(b[0]-a[0]),dLon=t(b[1]-a[1]); const s=Math.sin(dLat/2)**2+Math.cos(t(a[0]))*Math.cos(t(b[0]))*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(s)); }

function intro() {
  document.getElementById("content").innerHTML = `
    <div class="badge ok">${esc(current.name.toUpperCase())} · PERSONAL</div>
    <h2 style="margin-top:8px">Jefferson-first Alabama field map</h2>
    <p class="empty">Home layer is Jefferson County’s official parcel service (nightly). Other Alabama counties use public GIS when a query URL exists; otherwise you get the official viewer. Tax maps are not surveys.</p>
    <div class="row"><span class="label">Active county</span><span class="value">${esc(current.name)}</span></div>
    <div class="row"><span class="label">Freshness</span><span class="value">${esc(current.vintage)}</span></div>
    <div class="actions"><button class="primary" onclick="window.open('${current.official}','_blank')">Official GIS</button></div>
    <div class="legal">Personal use only. Queries public county endpoints directly. Not LandGlide, not ReportAll, not for resale.</div>`;
}
intro();

function renderParcel(feature, county, via) {
  const p = feature.properties || {};
  const owner = pick(p, county.ownerFields || ["OWNERNAME","Owner","OWNER"]) || "Unknown owner";
  const pin = pick(p, county.pinFields || ["PARCELID","PIN","PID"]) || "—";
  const acres = num(p, ["GIS_ACRES","GISACRES","ACRES_APR","CalcAcre","ACRES","Acres"]);
  const site = [pick(p, ["Bldg_Number","SitusAddNumber"]), pick(p, county.streetFields || ["Street_Name","SitusAddName","ADDR_APR"])].filter(Boolean).join(" ");
  const mail = [pick(p, ["PROP_MAIL","MailAdd1"]), pick(p, ["CITYMAIL","MailCity"]), pick(p, ["STATE_Mail","MailState"]), pick(p, ["ZIP_MAIL","MailZip1"])].filter(Boolean).join(" ");
  const legal = pick(p, ["Legal_Desc","LEGAL","Legal"]);
  const maintained = pick(p, ["MaintDate","maint_date","EditDate"]);
  const keys = Object.keys(p).filter(k => !/shape|objectid|fid|globalid/i.test(k));
  window._last = feature;
  document.getElementById("content").innerHTML = `
    <div class="badge">TAX MAP · NOT A SURVEY</div>
    <h2 style="margin-top:8px">${esc(owner)}</h2>
    <div class="row"><span class="label">County</span><span class="value">${esc(county.name)}</span></div>
    <div class="row"><span class="label">PIN</span><span class="value">${esc(pin)}</span></div>
    <div class="row"><span class="label">Site</span><span class="value">${esc(site || "—")}</span></div>
    <div class="row"><span class="label">Mailing</span><span class="value">${esc(mail || "—")}</span></div>
    <div class="row"><span class="label">Acres (GIS/appr.)</span><span class="value">${fmt(acres,2)}</span></div>
    ${legal ? `<div class="row"><span class="label">Legal</span><span class="value">${esc(legal)}</span></div>` : ""}
    <div class="row"><span class="label">Source</span><span class="value">${esc(county.vintage)}</span></div>
    ${maintained ? `<div class="row"><span class="label">Maint date field</span><span class="value">${esc(maintained)}</span></div>` : ""}
    <div class="row"><span class="label">Found</span><span class="value">${esc(via)}</span></div>
    <div class="actions">
      <button class="primary" onclick="window.open('${county.official}','_blank')">Official GIS</button>
      <button onclick="window.open('${county.assessor}','_blank')">Assessor / records</button>
      <button onclick="exportParcel()">Export GeoJSON</button>
    </div>
    <div class="legal">GPS accuracy now: ${lastAcc!=null ? Math.round(lastAcc)+" m" : "unknown"}. County tax GIS can lag a sale and will not match a deed survey. Do not build a fence from this screen.</div>
    <details style="margin-top:8px"><summary class="label">All fields (${keys.length})</summary>
      ${keys.map(k => `<div class="row"><span class="label">${esc(k)}</span><span class="value">${esc(p[k])}</span></div>`).join("")}
    </details>`;
}

function exportParcel() {
  if (!window._last) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(window._last,null,2)], {type:"application/geo+json"}));
  a.download = "trueline-parcel.geojson";
  a.click();
}

async function queryPoint(latlng, county) {
  if (!county.query) {
    document.getElementById("content").innerHTML = `
      <div class="badge bad">NO QUERY LAYER</div>
      <h2 style="margin-top:8px">${esc(county.name)} County</h2>
      <p class="empty">This county does not publish a public ArcGIS query we can hit from the phone. Open the official viewer — same public records LandGlide resells.</p>
      <div class="actions"><button class="primary" onclick="window.open('${county.official}','_blank')">Open official GIS</button></div>`;
    return;
  }
  const geom = JSON.stringify({ x:latlng.lng, y:latlng.lat, spatialReference:{ wkid:4326 }});
  const url = `${county.query}/query?f=geojson&geometry=${encodeURIComponent(geom)}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326`;
  try {
    const data = await fetch(url).then(r => r.json());
    parcelLayer.clearLayers();
    if (data.features && data.features.length) {
      parcelLayer.addData(data);
      renderParcel(data.features[0], county, "map / GPS");
      const b = parcelLayer.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding:[50,160], maxZoom:18 });
    } else {
      document.getElementById("content").innerHTML = `
        <div class="badge bad">NO PARCEL AT POINT</div>
        <p class="empty">Nothing in ${esc(county.name)}’s public layer at this coordinate. You may be in another county or on right-of-way.</p>
        <div class="actions"><button class="primary" onclick="window.open('${county.official}','_blank')">Official GIS</button></div>`;
    }
  } catch (e) {
    document.getElementById("content").innerHTML = `<div class="badge bad">LAYER ERROR</div><p class="empty">${esc(e.message)}</p>
      <div class="actions"><button class="primary" onclick="window.open('${county.official}','_blank')">Official GIS</button></div>`;
  }
}

async function search(q) {
  q = q.trim();
  if (!q) return;
  const county = current;
  if (!county.query) { window.open(county.official, "_blank"); return; }
  try {
    const meta = await fetch(`${county.query}?f=json`).then(r => r.json());
    const names = (meta.fields || []).map(f => f.name);
    const want = [...(county.ownerFields||[]), ...(county.pinFields||[]), ...(county.streetFields||[])];
    const use = [...new Set(want.map(w => names.find(n => n.toLowerCase()===w.toLowerCase() || n.toLowerCase().includes(w.toLowerCase().slice(0,5)))).filter(Boolean))];
    const escQ = q.replace(/'/g,"''");
    const where = use.length ? use.map(f => `UPPER(CAST(${f} AS VARCHAR(200))) LIKE UPPER('%${escQ}%')`).join(" OR ") : "1=1";
    const url = `${county.query}/query?f=geojson&where=${encodeURIComponent(where)}&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=25`;
    const data = await fetch(url).then(r => r.json());
    if (data.features && data.features.length) {
      parcelLayer.clearLayers();
      parcelLayer.addData(data);
      renderParcel(data.features[0], county, "search");
      const b = parcelLayer.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding:[50,160], maxZoom:17 });
      return;
    }
  } catch (_) {}
  const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q + " Alabama")}`).then(r=>r.json());
  if (geo[0]) {
    const lat=+geo[0].lat, lon=+geo[0].lon;
    map.setView([lat,lon], 17);
    queryPoint({lat,lng:lon}, county);
  }
}

async function detectCounty(lat, lon) {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const j = await fetch(url).then(r=>r.json());
    const counties = j.result?.geographies?.Counties || [];
    const c = counties[0];
    if (c && c.STATE === "01") {
      const fips = c.STATE + c.COUNTY;
      const known = COUNTIES.find(x => x.fips === fips);
      if (known && known.id !== current.id) { current = known; sel.value = known.id; }
      if (known) return known;
      const name = c.NAME;
      return { name: name+" County", query:null, vintage:"No public query wired",
        official:`https://www.alabamagis.com/${encodeURIComponent(name)}/`,
        assessor:`https://www.alabamagis.com/${encodeURIComponent(name)}/` };
    }
  } catch (_) {}
  return current;
}

map.on("click", async (e) => {
  if (measuring) {
    measurePts.push([e.latlng.lat, e.latlng.lng]);
    measureLine.setLatLngs(measurePts);
    let d=0; for (let i=1;i<measurePts.length;i++) d+=hav(measurePts[i-1], measurePts[i]);
    document.getElementById("content").innerHTML = `<h2>Measure</h2><div class="row"><span class="label">Path</span><span class="value">${fmt(d,1)} m · ${fmt(d*3.28084,1)} ft</span></div><button onclick="measurePts=[];measureLine.setLatLngs([]);">Clear</button>`;
    return;
  }
  const detected = await detectCounty(e.latlng.lat, e.latlng.lng);
  queryPoint(e.latlng, detected.query ? detected : current);
});

sel.onchange = () => {
  current = COUNTIES.find(c => c.id === sel.value) || COUNTIES[0];
  map.setView(current.center, 13);
  parcelLayer.clearLayers();
  intro();
};
document.getElementById("q").addEventListener("keydown", e => { if (e.key==="Enter") search(e.target.value); });
document.getElementById("btnLayer").onclick = () => {
  if (usingSat) { map.removeLayer(sat); streets.addTo(map); } else { map.removeLayer(streets); sat.addTo(map); }
  usingSat = !usingSat;
};
document.getElementById("btnMeasure").onclick = () => { measuring=!measuring; document.getElementById("btnMeasure").style.outline = measuring?"2px solid #FF6B6B":"none"; };
document.getElementById("btnWalk").onclick = () => { walking=!walking; document.getElementById("btnWalk").style.outline = walking?"2px solid #4DA3FF":"none"; };
document.getElementById("btnLocate").onclick = () => {
  if (lastPos) map.setView(lastPos, 18);
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition(onPos, onErr, {enableHighAccuracy:true, maximumAge:0});
};
function onPos(pos) {
  const lat=pos.coords.latitude, lon=pos.coords.longitude, acc=pos.coords.accuracy;
  lastPos=[lat,lon]; lastAcc=acc;
  document.getElementById("gps").textContent = `GPS ±${Math.round(acc)} m` + (pos.coords.heading!=null && !Number.isNaN(pos.coords.heading) ? ` · ${Math.round(pos.coords.heading)}°` : "");
  if (!locMarker) locMarker = L.circleMarker([lat,lon], {radius:6,color:"#4DA3FF",fillColor:"#4DA3FF",fillOpacity:1}).addTo(map);
  else locMarker.setLatLng([lat,lon]);
  if (!accCircle) accCircle = L.circle([lat,lon], {radius:acc,color:"#4DA3FF",weight:1,fillOpacity:0.08}).addTo(map);
  else { accCircle.setLatLng([lat,lon]); accCircle.setRadius(acc); }
  if (walking) { const pts=walkLayer.getLatLngs(); pts.push([lat,lon]); walkLayer.setLatLngs(pts); }
}
function onErr(){ document.getElementById("gps").textContent = "Enable Location in Safari"; }
if (navigator.geolocation) navigator.geolocation.watchPosition(onPos, onErr, {enableHighAccuracy:true, maximumAge:1000});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
