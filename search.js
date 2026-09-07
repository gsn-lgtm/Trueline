/* Live search overlay. Runs after app.js and replaces the Enter-only search. */
const suggestEl = document.getElementById("suggest");
const qEl = document.getElementById("q");
let suggestTimer = null;
let suggestToken = 0;

function hideSuggest() {
  suggestEl.style.display = "none";
  suggestEl.innerHTML = "";
}

function showSuggest(items) {
  if (!items.length) { hideSuggest(); return; }
  suggestEl.innerHTML = items.map((it) =>
    `<button type="button"><span>${esc(it.label)}</span><small>${esc(it.sub || it.kind)}</small></button>`
  ).join("");
  suggestEl.style.display = "block";
  suggestEl.querySelectorAll("button").forEach((btn, i) => {
    btn.onclick = () => pickSuggestion(items[i]);
  });
}

async function pickSuggestion(it) {
  hideSuggest();
  qEl.value = it.query || it.label;
  if (it.feature) {
    parcelLayer.clearLayers();
    parcelLayer.addData(it.feature);
    renderParcel(it.feature, current, "search");
    const b = parcelLayer.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding:[50,160], maxZoom:17 });
    return;
  }
  if (it.lat != null && it.lon != null) {
    map.setView([it.lat, it.lon], 18);
    const detected = await detectCounty(it.lat, it.lon);
    queryPoint({ lat: it.lat, lng: it.lon }, detected.query ? detected : current);
  }
}

async function parcelHits(q, county) {
  if (!county.query || q.length < 2) return [];
  const escQ = q.replace(/'/g, "''");
  const fields = [...(county.ownerFields||[]), ...(county.pinFields||[]), ...(county.streetFields||[])];
  const clauses = fields.map(f => `UPPER(${f}) LIKE UPPER('%${escQ}%')`);
  if (!clauses.length) return [];
  const url = `${county.query}/query?f=geojson&where=${encodeURIComponent(clauses.join(" OR "))}&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=8`;
  const data = await fetch(url).then(r => r.json()).catch(() => null);
  if (!data || !data.features) return [];
  return data.features.map(f => {
    const p = f.properties || {};
    const owner = pick(p, county.ownerFields || ["OWNERNAME","Owner"]) || "Parcel";
    const pin = pick(p, county.pinFields || ["PARCELID","PIN"]);
    const site = pick(p, county.streetFields || ["Street_Name","PROP_ADR","ADDRESS_1"]);
    return { kind:"parcel", label: owner, sub: [pin, site, county.name].filter(Boolean).join(" · "), feature: f, query: q };
  });
}

async function addressHits(q) {
  const center = current.center || [33.52, -86.80];
  const photon = `https://photon.komoot.io/api/?q=${encodeURIComponent(q + " Alabama")}&lat=${center[0]}&lon=${center[1]}&limit=6&lang=en`;
  const census = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(q + ", AL")}&benchmark=Public_AR_Current&format=json`;
  const [pRes, cRes] = await Promise.allSettled([
    fetch(photon).then(r => r.json()),
    fetch(census).then(r => r.json())
  ]);
  const out = [];
  if (cRes.status === "fulfilled") {
    for (const m of (cRes.value?.result?.addressMatches || []).slice(0, 4)) {
      out.push({
        kind:"address",
        label: m.matchedAddress || q,
        sub: "Census address match",
        lat: +m.coordinates.y,
        lon: +m.coordinates.x,
        query: m.matchedAddress
      });
    }
  }
  if (pRes.status === "fulfilled") {
    for (const f of (pRes.value?.features || [])) {
      const [lon, lat] = f.geometry.coordinates;
      const p = f.properties || {};
      if (p.countrycode && p.countrycode !== "US") continue;
      if (p.state && !/^al/i.test(p.state) && p.state !== "Alabama") continue;
      const line = [p.housenumber, p.street || p.name, p.city || p.county, p.state].filter(Boolean).join(" ");
      if (!line) continue;
      if (out.some(x => x.label.toLowerCase() === line.toLowerCase())) continue;
      out.push({ kind:"address", label: line, sub: p.city ? `${p.city}, AL` : "Address", lat, lon, query: line });
    }
  }
  return out;
}

async function liveSuggest(q) {
  q = q.trim();
  if (q.length < 2) { hideSuggest(); return; }
  const token = ++suggestToken;
  suggestEl.style.display = "block";
  suggestEl.innerHTML = `<button type="button">Looking up “${esc(q)}”…</button>`;
  const [parcels, addresses] = await Promise.all([
    parcelHits(q, current).catch(() => []),
    addressHits(q).catch(() => [])
  ]);
  if (token !== suggestToken) return;
  const items = [...parcels.slice(0, 6), ...addresses.slice(0, 6)];
  if (!items.length) {
    suggestEl.innerHTML = `<button type="button">No matches yet — keep typing</button>`;
    return;
  }
  showSuggest(items);
}

async function search(q) {
  q = (q || qEl.value || "").trim();
  if (!q) return;
  const token = ++suggestToken;
  suggestEl.style.display = "block";
  suggestEl.innerHTML = `<button type="button">Searching…</button>`;
  const [parcels, addresses] = await Promise.all([
    parcelHits(q, current).catch(() => []),
    addressHits(q).catch(() => [])
  ]);
  if (token !== suggestToken) return;
  if (parcels[0]) { pickSuggestion(parcels[0]); return; }
  if (addresses[0]) { pickSuggestion(addresses[0]); return; }
  hideSuggest();
  document.getElementById("content").innerHTML = `
    <div class="badge bad">NO MATCH</div>
    <p class="empty">Nothing in ${esc(current.name)} or the public address index for “${esc(q)}”. Try a PIN, owner last name, or city + street.</p>`;
}

qEl.addEventListener("input", () => {
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(() => liveSuggest(qEl.value), 220);
});
qEl.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); clearTimeout(suggestTimer); search(qEl.value); }
  if (e.key === "Escape") hideSuggest();
});
qEl.addEventListener("search", () => { if (!qEl.value) hideSuggest(); });
document.addEventListener("click", e => {
  if (!suggestEl.contains(e.target) && e.target !== qEl) hideSuggest();
});
