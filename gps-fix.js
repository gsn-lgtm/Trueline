function onErr() {
  const el = document.getElementById("gps");
  if (el) { el.textContent = ""; el.style.display = "none"; }
}
onErr();
const _onPos = onPos;
onPos = function(pos) {
  const el = document.getElementById("gps");
  if (el) el.style.display = "block";
  _onPos(pos);
};
