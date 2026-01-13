const API = window.API_BASE || "https://barbercloud.onrender.com/api";
const qs = new URLSearchParams(location.search);
const slug = qs.get("slug") || "";

const $ = (id) => document.getElementById(id);

let state = { barbershop: null, services: [], selectedTime: null };

function apiUrl(path) { return API + path; }

async function apiGet(path) {
  const r = await fetch(apiUrl(path));
  const t = await r.text();
  let data;
  try { data = JSON.parse(t); } catch { data = { raw: t }; }
  if (!r.ok) throw new Error(data.error || "Error");
  return data;
}
async function apiPost(path, body) {
  const r = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let data;
  try { data = JSON.parse(t); } catch { data = { raw: t }; }
  if (!r.ok) throw new Error(data.error || "Error");
  return data;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

function renderServices() {
  const sel = $("serviceSelect");
  sel.innerHTML = state.services.map(s =>
    `<option value="${s.id}">${s.name} ($${s.price})</option>`
  ).join("");
}

function renderSlots(slots) {
  const box = $("slots");
  state.selectedTime = null;
  $("btnBook").disabled = true;

  if (!slots.length) {
    box.innerHTML = "";
    $("slotHint").textContent = "No hay horarios disponibles para ese día.";
    return;
  }

  $("slotHint").textContent = "Elegí un horario:";
  box.innerHTML = slots.map(t => `
    <button class="btn" data-slot="${t}">${t}</button>
  `).join("");

  box.onclick = (e) => {
    const b = e.target.closest("[data-slot]");
    if (!b) return;
    const t = b.dataset.slot;
    state.selectedTime = t;

    // marcar seleccionado
    box.querySelectorAll("[data-slot]").forEach(x => x.classList.remove("primary"));
    b.classList.add("primary");

    $("btnBook").disabled = false;
  };
}

async function init() {
  if (!slug) {
    $("shopTitle").textContent = "Falta slug";
    $("shopMeta").textContent = "Usá: book.html?slug=barberrami";
    $("btnLoad").disabled = true;
    return;
  }

  // info barbería + servicios
  const shop = await apiGet(`/public/${slug}/barbershop`);
  state.barbershop = shop.item;

  $("shopTitle").textContent = state.barbershop.name;
  $("shopMeta").textContent = `${state.barbershop.city || ""} ${state.barbershop.address ? "• " + state.barbershop.address : ""}`.trim();

  const services = await apiGet(`/public/${slug}/services`);
  state.services = services.items || [];
  renderServices();

  // fecha default
  $("dateInput").value = todayISO();

  $("btnLoad").addEventListener("click", loadSlots);
  $("btnBook").addEventListener("click", book);
}

async function loadSlots() {
  const serviceId = $("serviceSelect").value;
  const date = $("dateInput").value;
  $("bookMsg").textContent = "";

  try {
    const data = await apiGet(`/public/${slug}/availability?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}&step=15`);
    renderSlots(data.slots || []);
  } catch (e) {
    $("slotHint").textContent = "Error cargando horarios: " + e.message;
  }
}

async function book() {
  const serviceId = Number($("serviceSelect").value);
  const date = $("dateInput").value;
  const time = state.selectedTime;
  const customerName = $("nameInput").value.trim();
  const customerPhone = $("phoneInput").value.trim();
  const customerEmail = $("emailInput").value.trim();
  const notes = $("notesInput").value.trim();

  if (!time) return;

  try {
    const resp = await apiPost(`/public/${slug}/book`, {
      serviceId,
      date,
      time,
      customerName,
      customerPhone,
      customerEmail: customerEmail || null,
      notes: notes || null,
    });

    $("bookMsg").textContent = `Listo ✅ Tu turno quedó pendiente. Código: #${resp.id}`;
    $("btnBook").disabled = true;
  } catch (e) {
    $("bookMsg").textContent = "No se pudo reservar: " + e.message;
    // refrescar slots por si cambió
    loadSlots();
  }
}

init().catch(err => {
  $("shopTitle").textContent = "Error";
  $("shopMeta").textContent = err.message;
});
