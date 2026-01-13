const API = window.API_BASE || "https://barbercloud.onrender.com/api";

// slug por ?slug=... o por path /barberrami
function getSlug() {
  const qs = new URLSearchParams(location.search);
  const q = qs.get("slug");
  if (q) return q;

  // ejemplo: /barberrami  o /book.html/barberrami (según hosting)
  const parts = location.pathname.split("/").filter(Boolean);
  // si estás en /book.html, el slug no está. si estás en /barberrami, sí.
  const last = parts[parts.length - 1];
  if (last && !last.endsWith(".html")) return last;

  return "";
}
const slug = getSlug();

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
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function renderServiceSummary() {
  const id = Number($("serviceSelect").value);
  const s = state.services.find(x => x.id === id);
  if (!s) return;

  const pct = state.barbershop?.defaultDepositPercentage ?? 15;
  const deposit = Math.round((s.price * pct) / 100);

  $("serviceSummary").innerHTML =
    `Duración: <b>${s.durationMinutes} min</b> • Precio: <b>$${s.price}</b> • Seña aprox: <b>$${deposit}</b> (${pct}%)`;
}

function renderServices() {
  const sel = $("serviceSelect");
  sel.innerHTML = state.services.map(s =>
    `<option value="${s.id}">${s.name} ($${s.price})</option>`
  ).join("");

  // ✅ resumen del servicio apenas se renderiza el select
  renderServiceSummary();
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
  // ✅ Bloquear fechas pasadas + default hoy
  $("dateInput").min = todayISO();

  if (!slug) {
    $("shopTitle").textContent = "Falta slug";
    $("shopMeta").textContent = "Usá: book.html?slug=barberrami o entrá a /barberrami (con rewrites)";
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

  // ✅ init: resumen + hint pro
  renderServiceSummary();
  $("slotHint").textContent = "Elegí fecha y tocá “Ver horarios”.";

  // ✅ cada vez que cambie el servicio: refresca resumen y resetea slots
  $("serviceSelect").addEventListener("change", () => {
    renderServiceSummary();
    // reset slots
    renderSlots([]);
    $("slotHint").textContent = "Elegí fecha y tocá “Ver horarios”.";
  });

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
