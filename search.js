/* Live search. Photon first; county parcels in the background. */
const suggestEl = document.getElementById("suggest");
const qEl = document.getElementById("q");
let suggestTimer = null;
let suggestToken = 0;
let suggestAbort = null;

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
    queryPoint({ lat: it.lat, lng: it.lon }, current);
  }
}

function timedFetch(url, ms, signal) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  if (signal) signal.addEventListener("abort", () => ctrl.abort());
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function parcelHits(q, county, signal) {
  if (!county.query || q.length < 3) return [];
  const escQ = q.replace(/'/g, "''");
  const fields = [...(county.streetFields || []), ...(county.pinFields || []), ...(county.ownerFields || [])].slice(0, 4);
  if (!fields.length) return [];
  const clauses = fields.map(f => `${f} LIKE '%${escQ}%'`);
  const outFields = [...new Set([...fields, "OWNERNAME", "PARCELID"])].join(",");
  const url = `${county.query}/query?f=geojson&where=${encodeURIComponent(clauses.join(" OR "))}&outFields=${encodeURIComponent(outFields)}&returnGeometry=true&outSR=4326&resultRecordCount=5`;
  const data = await timedFetch(url, 3500, signal).then(r => r.json()).catch(() => null);
  if (!data || !data.features) return [];
  return data.features.map(f => {
    const p = f.properties || {};
    const owner = pick(p, county.ownerFields || ["OWNERNAME", "Owner"]) || "Parcel";
    const pin = pick(p, county.pinFields || ["PARCELID", "PIN"]);
    const site = pick(p, county.streetFields || ["Street_Name", "PROP_ADR"]);
    return { kind: "parcel", label: owner, sub: [pin, site, county.name].filter(Boolean).join(" · "), feature: f, query: q };
  });
}

async function addressHits(q, signal) {
  const center = current.center || [33.5207, -86.8025];
  const photon = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${center[0]}&lon=${center[1]}&limit=5&lang=en`;
  const data = await timedFetch(photon, 2500, signal).then(r => r.json()).catch(() => null);
  const out = [];
  for (const f of (data && data.features) || []) {
    const [lon, lat] = f.geometry.coordinates;
    const p = f.properties || {};
    if (p.countrycode && p.countrycode !== "US") continue;
    if (p.state && !/^al/i.test(String(p.state)) && p.state !== "Alabama") continue;
    const line = [p.housenumber, p.street || p.name, p.city || p.county, "AL"].filter(Boolean).join(" ");
    if (!line) continue;
    out.push({ kind: "address", label: line, sub: p.city ? `${p.city}, AL` : "Address", lat, lon, query: line });
  }
  return out;
}

async function liveSuggest(q) {
  q = q.trim();
  if (q.length < 2) { hideSuggest(); return; }
  const token = ++suggestToken;
  if (suggestAbort) suggestAbort.abort();
  suggestAbort = new AbortController();
  const signal = suggestAbort.signal;
  suggestEl.style.display = "block";
  suggestEl.innerHTML = `<button type="button">Searching…</button>`;

  const fast = addressHits(q, signal).then(addresses => {
    if (token !== suggestToken) return;
    if (addresses.length) showSuggest(addresses);
  }).catch(() => {});

  const slow = parcelHits(q, current, signal).then(parcels => {
    if (token !== suggestToken) return parcels;
    return parcels;
  }).catch(() => []);

  const [addresses, parcels] = await Promise.all([
    addressHits(q, signal).catch(() => []),
    slow
  ]);
  await fast;
  if (token !== suggestToken) return;
  const items = [...parcels.slice(0, 5), ...addresses.slice(0, 5)];
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
    <p class="empty">Nothing quick for “${esc(q)}”. Try street + city, owner last name, or PIN.</p>`;
}

qEl.addEventListener("input", () => {
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(() => liveSuggest(qEl.value), 120);
});
qEl.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); clearTimeout(suggestTimer); search(qEl.value); }
  if (e.key === "Escape") hideSuggest();
});
qEl.addEventListener("search", () => { if (!qEl.value) hideSuggest(); });
document.addEventListener("click", e => {
  if (!suggestEl.contains(e.target) && e.target !== qEl) hideSuggest();
});
