/* Enrich parcel card + open official CAMA/assessor for the current PIN. */
function money(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "";
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "";
  return "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function dateish(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number" && v > 1e11) return new Date(v).toLocaleDateString();
  const s = String(v);
  if (/^\\d{10,13}$/.test(s)) return new Date(Number(s)).toLocaleDateString();
  return s;
}
function firstMoney(p, names) {
  for (const n of names) {
    const m = money(p[n]);
    if (m) return { label: n, value: m, raw: p[n] };
  }
  const hit = Object.keys(p).find(k => /assd|assess|landval|impval|totval|appraised|market/i.test(k) && money(p[k]));
  return hit ? { label: hit, value: money(p[hit]), raw: p[hit] } : null;
}
function firstDate(p, names) {
  for (const n of names) {
    const d = dateish(p[n]);
    if (d) return { label: n, value: d };
  }
  const hit = Object.keys(p).find(k => /saledate|sale_date|deeddate|xfer|transfer/i.test(k) && dateish(p[k]));
  return hit ? { label: hit, value: dateish(p[hit]) } : null;
}

function officialRecordUrl(county, pin) {
  const p = encodeURIComponent((pin || "").replace(/\\s+/g, ""));
  if (county.id === "jefferson") return "https://eringcapture.jccal.org/propsearch";
  if (county.id === "stclair") return county.official;
  if (county.id === "shelby") return county.assessor || county.official;
  if (county.id === "blount") return county.official;
  return county.assessor || county.official;
}

function copyPin(pin) {
  if (!pin || pin === "\u2014") return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(pin).catch(() => {});
  }
}

function openOfficialRecord() {
  const f = window._last;
  const county = current;
  if (!f) { window.open(county.assessor || county.official, "_blank"); return; }
  const p = f.properties || {};
  const pin = pick(p, county.pinFields || ["PARCELID","PIN","PID","APP_PID"]) || "";
  copyPin(pin);
  window.open(officialRecordUrl(county, pin), "_blank");
}

function renderParcel(feature, county, via) {
  const p = feature.properties || {};
  window._last = feature;
  const owner = pick(p, county.ownerFields || ["OWNERNAME","Owner","OWNER","NAME_1"]) || "Unknown owner";
  const prevOwner = pick(p, ["PREVIOUS_O","PrevOwner","PRIOR_OWNER","Name2"]);
  const pin = pick(p, county.pinFields || ["PARCELID","PIN","PID"]) || "\u2014";
  const acres = num(p, ["GIS_ACRES","GISACRES","ACRES_APR","DEEDED_ACR","CalcAcre","ACRES","Acres"]);
  const site = [pick(p, ["Bldg_Number","SitusAddNumber"]), pick(p, county.streetFields || ["Street_Name","SitusAddName","ADDR_APR","PROP_ADR","ADDRESS_1"])].filter(Boolean).join(" ");
  const mail = [pick(p, ["PROP_MAIL","MailAdd1"]), pick(p, ["CITYMAIL","MailCity"]), pick(p, ["STATE_Mail","MailState"]), pick(p, ["ZIP_MAIL","MailZip1"])].filter(Boolean).join(" ");
  const legal = pick(p, ["Legal_Desc","LEGAL","Legal"]);
  const assessed = firstMoney(p, ["AssdValue","TOTAL_ASSD","ASSESSED","AssessedValue","TOTAL_VALUE","TotalValue","APPRAISED","TotalMHValue"]);
  const landVal = firstMoney(p, ["PrevParcelLand","TOTAL_LAND","LANDVALUE","LandValue"]);
  const impVal = firstMoney(p, ["PrevParcelImp","IMPRVALUE","ImprovementValue"]);
  const prevTotal = firstMoney(p, ["PrevParcelTotal"]);
  const salePrice = firstMoney(p, ["SALE_PRICE","SALEPRICE","SalePrice","ActualPric","LAST_SALE"]);
  const saleDate = firstDate(p, ["SALE_DATE","SALEDATE","SaleDate","DEED_DATE","LAST_SALE_DATE"]);
  const deed = [pick(p, ["LAST_DEED_","LAST_DEED1","Plat_Book","DEED_BOOK"]), pick(p, ["Plat_Page","DEED_PAGE"])].filter(Boolean).join(" / ");
  const keys = Object.keys(p).filter(k => !/shape|objectid|fid|globalid/i.test(k));

  const deedsUrl = county.id === "jefferson"
    ? "https://landmarkweb.jccal.org/landmarkweb"
    : county.official;
  const portalName = county.id === "jefferson" ? "CAPture (official record)" : "Official assessor / GIS";

  const saleHistoryNote = salePrice || saleDate
    ? `<div class="row"><span class="label">Last sale (GIS)</span><span class="value">${esc([saleDate && saleDate.value, salePrice && salePrice.value, prevOwner].filter(Boolean).join(" \u00b7 "))}</span></div>`
    : `<div class="row"><span class="label">Sale history</span><span class="value">Use official record button</span></div>`;

  document.getElementById("content").innerHTML = `
    <div class="badge">TAX MAP \u00b7 NOT A SURVEY</div>
    <h2 style="margin-top:8px">${esc(owner)}</h2>
    <div class="row"><span class="label">County</span><span class="value">${esc(county.name)}</span></div>
    <div class="row"><span class="label">PIN</span><span class="value">${esc(pin)}</span></div>
    <div class="row"><span class="label">Site</span><span class="value">${esc(site || "\u2014")}</span></div>
    <div class="row"><span class="label">Mailing</span><span class="value">${esc(mail || "\u2014")}</span></div>
    <div class="row"><span class="label">Acres (GIS/appr.)</span><span class="value">${fmt(acres,2)}</span></div>
    ${assessed ? `<div class="row"><span class="label">Assessed value</span><span class="value">${esc(assessed.value)}</span></div>` : `<div class="row"><span class="label">Assessed value</span><span class="value">See official record</span></div>`}
    ${landVal ? `<div class="row"><span class="label">Land (prior / GIS)</span><span class="value">${esc(landVal.value)}</span></div>` : ""}
    ${impVal ? `<div class="row"><span class="label">Improvements (prior / GIS)</span><span class="value">${esc(impVal.value)}</span></div>` : ""}
    ${prevTotal ? `<div class="row"><span class="label">Prior total</span><span class="value">${esc(prevTotal.value)}</span></div>` : ""}
    ${saleHistoryNote}
    ${prevOwner && prevOwner !== owner ? `<div class="row"><span class="label">Previous owner (GIS)</span><span class="value">${esc(prevOwner)}</span></div>` : ""}
    ${deed ? `<div class="row"><span class="label">Deed / plat ref</span><span class="value">${esc(deed)}</span></div>` : ""}
    ${legal ? `<div class="row"><span class="label">Legal</span><span class="value">${esc(legal)}</span></div>` : ""}
    <div class="row"><span class="label">Source</span><span class="value">${esc(county.vintage)}</span></div>
    <div class="actions">
      <button class="primary" onclick="openOfficialRecord()">${esc(portalName)}</button>
      <button onclick="copyPin('${esc(pin)}')">Copy PIN</button>
      <button onclick="window.open('${deedsUrl}','_blank')">Deeds / Landmark</button>
      <button onclick="window.open('${county.official}','_blank')">County GIS map</button>
      <button onclick="exportParcel()">Export GeoJSON</button>
    </div>
    <div class="legal">The green button copies this PIN and opens the county’s official public record. On Jefferson that is CAPture. Change the search type to Parcel and paste the PIN. That site holds the full assessment card, sales, and building data the GIS layer does not.</div>
    <details style="margin-top:8px"><summary class="label">All GIS fields (${keys.length})</summary>
      ${keys.map(k => `<div class="row"><span class="label">${esc(k)}</span><span class="value">${esc(p[k])}</span></div>`).join("")}
    </details>`;
}
