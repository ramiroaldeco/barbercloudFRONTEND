const API = window.API_BASE || "https://barbercloud.onrender.com/api";

// Utils
const $ = (id) => document.getElementById(id);
const safeText = (id, txt) => { if ($(id)) $(id).textContent = txt ?? ""; };

let state = { barbershop: null, services: [], members: [], selectedTime: null };
let currentStep = 1;

// =====================
// INIT & DATA FETCH
// =====================
function getSlug() {
  const qs = new URLSearchParams(location.search);
  const q = qs.get("slug");
  if (q) return q;

  const parts = location.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && !last.endsWith(".html")) return last;
  return "";
}

const slug = getSlug();

async function apiGet(path) {
  const r = await fetch(API + path);
  const t = await r.text();
  let data;
  try { data = JSON.parse(t); } catch { data = { raw: t }; }
  if (!r.ok) throw new Error(data.error || "Error");
  return data;
}

async function apiPost(path, body) {
  const r = await fetch(API + path, {
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
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function fetchInitialData() {
  showLoader("Cargando información...");
  try {
    const shopRes = await apiGet(`/public/${slug}/barbershop`);
    state.barbershop = shopRes.item;

    const srvRes = await apiGet(`/public/${slug}/services`);
    state.services = srvRes.items || [];

    const memRes = await apiGet(`/public/${slug}/members`);
    state.members = memRes.members || [];

    renderHeader();
    renderServices();
    
    // Set min date
    const dateInput = $("dateInput");
    if (dateInput) {
      dateInput.min = todayISO();
      dateInput.value = todayISO();
    }
  } catch (err) {
    safeText("shopTitle", "Error de carga");
    safeText("shopMeta", "No pudimos encontrar esta barbería: " + err.message);
  } finally {
    hideLoader();
  }
}

// =====================
// RENDERERS
// =====================
function renderHeader() {
  const { name, city, address, logoBase64 } = state.barbershop;
  safeText("shopTitle", name);
  safeText("shopMeta", `${city || ""} ${address ? "• " + address : ""}`.trim());
  
  const logo = $("shopLogo");
  const fallback = $("shopLogoFallback");
  
  if (logoBase64) {
    logo.src = logoBase64;
    logo.style.display = "block";
    fallback.style.display = "none";
  } else {
    fallback.textContent = (name || "B").charAt(0).toUpperCase();
    logo.style.display = "none";
    fallback.style.display = "flex";
  }
}

function renderServices() {
  const list = $("servicesList");
  if (!list) return;

  if (!state.services.length) {
    list.innerHTML = `<div class="hint">No hay servicios configurados.</div>`;
    return;
  }

  list.innerHTML = state.services.map(s => {
    return `
      <div class="select-card" data-service-id="${s.id}">
        <div class="card-main">
          <div class="card-info">
            <span class="card-title">${escapeHtml(s.name)}</span>
            <span class="card-sub">${s.durationMinutes} min</span>
          </div>
        </div>
        <div class="card-price">$${s.price}</div>
      </div>
    `;
  }).join("");

  // Añadir eventos click a las tarjetas
  list.querySelectorAll(".select-card").forEach(card => {
    card.addEventListener("click", () => {
      list.querySelectorAll(".select-card").forEach(c => c.classList.remove("is-selected"));
      card.classList.add("is-selected");
      $("serviceSelect").value = card.dataset.serviceId;
      $("btnGoTo2").disabled = false;
      renderBarbers(); // Actualiza barberos según el servicio elegido
    });
  });
}

function renderBarbers() {
  const list = $("barbersList");
  if (!list) return;
  
  const selService = Number($("serviceSelect").value);
  if (!selService) return;

  const validMembers = state.members.filter(m => m.services && m.services.some(s => s.id === selService));

  $("barberSelect").value = "";
  $("btnGoTo3").disabled = true;

  if (!validMembers.length) {
    list.innerHTML = `<div class="hint">Ningún barbero realiza este servicio.</div>`;
    return;
  }

  list.innerHTML = validMembers.map(m => {
    const avatar = m.avatarBase64 && m.avatarBase64.length > 50 
        ? `<img src="${m.avatarBase64}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`
        : `<span>${escapeHtml(m.name.charAt(0).toUpperCase())}</span>`;
        
    return `
      <div class="select-card" data-barber-id="${m.id}">
        <div class="card-main">
          <div class="card-avatar" style="display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold;">${avatar}</div>
          <div class="card-info">
            <span class="card-title">${escapeHtml(m.name)}</span>
            <span class="card-sub">${escapeHtml(m.role || "Barbero")}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".select-card").forEach(card => {
    card.addEventListener("click", () => {
      list.querySelectorAll(".select-card").forEach(c => c.classList.remove("is-selected"));
      card.classList.add("is-selected");
      $("barberSelect").value = card.dataset.barberId;
      $("btnGoTo3").disabled = false;
    });
  });
}

async function renderSlotsAvailable() {
  const serviceId = $("serviceSelect").value;
  const barberId = $("barberSelect").value;
  const date = $("dateInput").value;
  const box = $("slots");
  const hint = $("slotHint");

  $("btnGoTo4").disabled = true;
  state.selectedTime = null;

  if (!serviceId || !barberId || !date) return;

  hint.textContent = "Buscando horarios...";
  box.innerHTML = `
    <div class="skeleton sk-text"></div>
    <div class="skeleton sk-text"></div>
  `;

  try {
    const data = await apiGet(`/public/${slug}/availability?barberId=${barberId}&serviceId=${serviceId}&date=${date}`);
    const slots = data.slots || [];

    if (!slots.length) {
      hint.textContent = "No hay huecos disponibles para esta fecha.";
      box.innerHTML = "";
      return;
    }

    hint.textContent = "Elegí el horario que más te convenga:";
    box.innerHTML = slots.map(t => `<button class="slot-btn" data-slot="${t}">${t}</button>`).join("");

    box.querySelectorAll(".slot-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        box.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        state.selectedTime = btn.dataset.slot;
        $("btnGoTo4").disabled = false;
      });
    });

  } catch (e) {
    hint.textContent = "Error consultando disponibilidad.";
    box.innerHTML = "";
  }
}

function updateSummary() {
  const s = state.services.find(x => x.id === Number($("serviceSelect")?.value));
  const b = state.members.find(x => x.id === Number($("barberSelect")?.value));
  const date = $("dateInput").value;
  const time = state.selectedTime;

  safeText("sumService", s ? `${s.name} ($${s.price})` : "—");
  safeText("sumBarber", b ? b.name : "—");
  safeText("sumDateTime", time ? `${date} a las ${time} hs` : "—");

  if (s) {
    const pct = s.depositPercentage ?? state.barbershop?.defaultDepositPercentage ?? 15;
    const deposit = Math.round((s.price * pct) / 100);
    const fee = state.barbershop?.platformFee ?? 0;
    const total = deposit + fee;
    safeText("sumDeposit", `$${total}`);
  }
}

// =====================
// STEP NAVIGATION
// =====================
function goStep(n) {
  currentStep = n;

  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.classList.toggle("is-visible", idx + 1 === n);
  });

  document.querySelectorAll(".step-indicator").forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.toggle("is-active", s === n);
    el.classList.toggle("is-done", s < n);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (n === 3) {
    // Si entramos al step 3, auto-cargamos horarios
    renderSlotsAvailable();
  }
  
  if (n === 4) {
    updateSummary();
    validateForm();
  }
}

// =====================
// FORM & BOOKING
// =====================
function validateForm() {
  const name = $("nameInput").value.trim();
  const phone = $("phoneInput").value.trim();
  $("btnBook").disabled = !(name && phone);
}

async function handleBook() {
  const serviceId = Number($("serviceSelect").value);
  const barberId = Number($("barberSelect").value);
  const date = $("dateInput").value;
  const time = state.selectedTime;
  const name = $("nameInput").value.trim();
  const phone = $("phoneInput").value.trim();
  const email = $("emailInput").value.trim();
  
  const errBox = $("bookAlert");
  const succBox = $("bookMsgSuccess");
  errBox.style.display = "none";
  succBox.style.display = "none";

  showLoader("Procesando tu turno...");
  
  try {
    const resp = await apiPost(`/public/${slug}/book`, {
      barberId,
      serviceId,
      date,
      time,
      customerName: name,
      customerPhone: phone,
      customerEmail: email || null
    });

    hideLoader();
    
    // Ocultar formulario, mostrar exito
    $("btnBook").style.display = "none";
    $("btnBackTo3").style.display = "none";
    $("btnPayDeposit").style.display = "none";
    
    succBox.textContent = `¡Reserva Confirmada! Código: #${resp.id}`;
    succBox.style.display = "block";
    
  } catch (err) {
    hideLoader();
    errBox.textContent = "No logramos confirmar el turno: " + err.message;
    errBox.style.display = "block";
  }
}


// =====================
// UTILS & LISTENERS
// =====================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[s]));
}

function showLoader(txt) {
  safeText("wizardLoaderText", txt);
  $("wizardLoader")?.classList.add("is-active");
}

function hideLoader() {
  $("wizardLoader")?.classList.remove("is-active");
}

function attachListeners() {
  $("btnGoTo2")?.addEventListener("click", () => goStep(2));
  $("btnBackTo1")?.addEventListener("click", () => goStep(1));
  $("btnGoTo3")?.addEventListener("click", () => goStep(3));
  $("btnBackTo2")?.addEventListener("click", () => goStep(2));
  $("btnGoTo4")?.addEventListener("click", () => goStep(4));
  $("btnBackTo3")?.addEventListener("click", () => goStep(3));
  
  $("dateInput")?.addEventListener("change", renderSlotsAvailable);
  $("nameInput")?.addEventListener("input", validateForm);
  $("phoneInput")?.addEventListener("input", validateForm);
  
  $("btnBook")?.addEventListener("click", handleBook);
}

// Bootstrap
if (!slug) {
  safeText("shopTitle", "Aviso");
  safeText("shopMeta", "Falta el identificador de la barbería en la URL.");
} else {
  attachListeners();
  fetchInitialData();
}
