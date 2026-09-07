function platRefs(p) {
  const book = pick(p, ["Plat_Book","Plat_Book2","PLAT_BOOK","PLATBOOK"]);
  const page = pick(p, ["Plat_Page","Plat_Page2","PLAT_PAGE"]);
  const subdiv = pick(p, ["SUBDIV_NAME","SUBDIVISION"]);
  return { book, page, subdiv, label: [book && ("Bk " + book), page && ("Pg " + page), subdiv].filter(Boolean).join(" · ") };
}

function openRecordedPlat() {
  const f = window._last;
  const county = current;
  const p = (f && f.properties) || {};
  const refs = platRefs(p);
  const clip = refs.label || pick(p, county.pinFields || ["PARCELID"]) || "";
  if (clip && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(clip).catch(() => {});
  const url = county.id === "jefferson"
    ? "https://landmarkweb.jccal.org/landmarkweb"
    : (county.official || "https://jeffcoprobatecourt.com/recording/");
  window.open(url, "_blank");
}

const _renderForPlats = renderParcel;
renderParcel = function(feature, county, via) {
  _renderForPlats(feature, county, via);
  const p = feature.properties || {};
  const refs = platRefs(p);
  const host = document.getElementById("content");
  if (!host) return;
  const note = document.createElement("div");
  note.innerHTML = `
    <div class="row"><span class="label">Recorded plat</span><span class="value">${esc(refs.label || "Search Landmark by owner / PIN")}</span></div>
    <div class="actions"><button class="primary" onclick="openRecordedPlat()">Open recorded plat (Probate / Landmark)</button></div>
    <div class="legal">Recorded subdivision plats are public in Probate. Landmark charges for plat images and forbids data-mining. A recorded plat is not the same as a new boundary survey, and the tax GIS line is still not a survey stake.</div>`;
  host.appendChild(note);
};
