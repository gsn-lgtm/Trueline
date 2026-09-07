/* Enrich parcel card with assessed value / last sale when the public layer has those fields. */
function money(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "";
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "";
  return "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function dateish(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number" && v > 1e11) return new Date(v).toLocaleDateString();
  if (typeof v === "number" && v > 1e10) return new Date(v).toLocaleDateString();
  const s = String(v);
  if (/^\d{10,13}$/.test(s)) return new Date(Number(s)).toLocaleDateString();
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

const _renderParcelOrig = typeof renderParcel === "function" ? renderParcel : null;
function renderParcel(feature, county, via) {
  const p = feature.properties || {};
  window._last = feature;
  const owner = pick(p, county.ownerFields || ["OWNERNAME","Owner","OWNER","NAME_1"]) || "Unknown owner";
  const prevOwner = pick(p, ["PREVIOUS_O","PrevOwner","PRIOR_OWNER","Name2"]);
  const pin = pick(p, county.pinFields || ["PARCELID","PIN","PID"]) || "—";
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

  const assessorUrl = county.id === "jefferson"
    ? "https://eringcapture.jccal.org/propsearch"
    : county.assessor;
  const deedsUrl = county.id === "jefferson"
    ? "https://landmarkweb.jccal.org/landmarkweb"
    : county.official;

  const saleHistoryNote = salePrice || saleDate
    ? `<div class="row"><span class="label">Last sale (GIS)</span><span class="value">${esc([saleDate && saleDate.value, salePrice && salePrice.value, prevOwner].filter(Boolean).join(" · "))}</span></div>`
    : `<div class="row"><span class="label">Sale history</span><span class="value">Not on this county’s public GIS layer</span></div>`;

  document.getElementById("content").innerHTML = `
    <div class="badge">TAX MAP · NOT A SURVEY</div>
    <h2 style="margin-top:8px">${esc(owner)}</h2>
    <div class="row"><span class="label">County</span><span class="value">${esc(county.name)}</span></div>
    <div class="row"><span class="label">PIN</span><span class="value">${esc(pin)}</span></div>
    <div class="row"><span class="label">Site</span><span class="value">${esc(site || "—")}</span></div>
    <div class="row"><span class="label">Mailing</span><span class="value">${esc(mail || "—")}</span></div>
    <div class="row"><span class="label">Acres (GIS/appr.)</span><span class="value">${fmt(acres,2)}</span></div>
    ${assessed ? `<div class="row"><span class="label">Assessed value</span><span class="value">${esc(assessed.value)}</span></div>` : `<div class="row"><span class="label">Assessed value</span><span class="value">Not published on this layer</span></div>`}
    ${landVal ? `<div class="row"><span class="label">Land (prior / GIS)</span><span class="value">${esc(landVal.value)}</span></div>` : ""}
    ${impVal ? `<div class="row"><span class="label">Improvements (prior / GIS)</span><span class="value">${esc(impVal.value)}</span></div>` : ""}
    ${prevTotal ? `<div class="row"><span class="label">Prior total</span><span class="value">${esc(prevTotal.value)}</span></div>` : ""}
    ${saleHistoryNote}
    ${prevOwner && prevOwner !== owner ? `<div class="row"><span class="label">Previous owner (GIS)</span><span class="value">${esc(prevOwner)}</span></div>` : ""}
    ${deed ? `<div class="row"><span class="label">Deed / plat ref</span><span class="value">${esc(deed)}</span></div>` : ""}
    ${legal ? `<div class="row"><span class="label">Legal</span><span class="value">${esc(legal)}</span></div>` : ""}
    <div class="row"><span class="label">Source</span><span class="value">${esc(county.vintage)}</span></div>
    <div class="row"><span class="label">Found</span><span class="value">${esc(via)}</span></div>
    <div class="actions">
      <button class="primary" onclick="window.open('${county.official}','_blank')">Official GIS</button>
      <button onclick="window.open('${assessorUrl}','_blank')">Assessor values</button>
      <button onclick="window.open('${deedsUrl}','_blank')">Deeds / sales</button>
      <button onclick="exportParcel()">Export GeoJSON</button>
    </div>
    <div class="legal">Jefferson GIS publishes current owner + assessed value nightly. It does <b>not</b> publish a multi-year purchase-price history. For recorded sale prices use the Assessor CAPture portal and Landmark deed search (linked above). St. Clair GIS often includes last sale date/price on the parcel itself.</div>
    <details style="margin-top:8px"><summary class="label">All fields (${keys.length})</summary>
      ${keys.map(k => `<div class="row"><span class="label">${esc(k)}</span><span class="value">${esc(p[k])}</span></div>`).join("")}
    </details>`;
}
