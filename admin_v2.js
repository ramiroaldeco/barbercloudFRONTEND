// admin_v2.js
const API = "https://barbercloud.onrender.com/api"; // tu backend Render

const views = {
  agenda: document.getElementById("view-agenda"),
  clientes: document.getElementById("view-clientes"),
  servicios: document.getElementById("view-servicios"),
  horarios: document.getElementById("view-horarios"),
  config: document.getElementById("view-config"),
};

const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

function setActiveNav(route) {
  document.querySelectorAll(".nav-item").forEach(a => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

function showView(route) {
  Object.entries(views).forEach(([k, el]) => el.style.display = (k === route ? "block" : "none"));
  setActiveNav(route);

  if (route === "agenda") {
    pageTitle.textContent = "Agenda";
    pageSubtitle.textContent = "Gestioná tus turnos";
    loadAppointments();
  }
  if (route === "servicios") {
    pageTitle.textContent = "Servicios";
    pageSubtitle.textContent = "Precios, duración y seña";
    loadServices();
  }
  if (route === "horarios") {
    pageTitle.textContent = "Plantilla Horaria";
    pageSubtitle.textContent = "Horarios semanales";
  }
  if (route === "config") {
    pageTitle.textContent = "Configuración";
    pageSubtitle.textContent = "Datos de tu barbería";
    loadConfig();
  }
  if (route === "clientes") {
    pageTitle.textContent = "Clientes";
    pageSubtitle.textContent = "Historial y búsqueda";
  }
}

function getRoute() {
  const hash = location.hash || "#/agenda";
  return hash.replace("#/", "");
}

window.addEventListener("hashchange", () => showView(getRoute()));

// --- API helpers ---
function authHeaders() {
  // ✅ si vos usás token en localStorage, dejalo así:
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// --- Load basic shop info for sidebar ---
async function loadShopHeader() {
  try {
    // Ajustá a tu endpoint real si difiere:
    const data = await apiGet("/barbershops/mine");
    document.getElementById("shopName").textContent = data.name || "BarberCloud";
    document.getElementById("shopCity").textContent = data.city || "Admin";
    document.getElementById("shopAvatar").textContent = (data.name || "B").trim().charAt(0).toUpperCase();

    // progreso simple:
    const filled = ["name","city","address","phone","slug"].filter(k => data[k]).length;
    const pct = Math.round((filled / 5) * 100);
    document.getElementById("setupPct").textContent = `${pct}%`;
    document.getElementById("setupBar").style.width = `${pct}%`;
  } catch (e) {
    // si falla, no cortamos el UI
    console.warn("No pude cargar barbería (mine):", e.message);
  }
}

// --- Agenda ---
async function loadAppointments() {
  const tbody = document.querySelector("#appointmentsTable tbody");
  const empty = document.getElementById("appointmentsEmpty");

  const q = document.getElementById("qAppointments").value.trim().toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;

  tbody.innerHTML = "";
  empty.style.display = "none";

  try {
    // Ajustá a tu endpoint real:
    // Ideal: /appointments?from=YYYY-MM-DD&to=YYYY-MM-DD&status=pending
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);

    const data = await apiGet(`/appointments?${params.toString()}`);
    const items = (data.items || data || []).filter(a => {
      if (!q) return true;
      return (a.customerName || "").toLowerCase().includes(q) || (a.customerPhone || "").toLowerCase().includes(q);
    });

    if (!items.length) {
      empty.style.display = "block";
      return;
    }

    for (const a of items) {
      const tr = document.createElement("tr");

      const badge = statusBadge(a.status);

      tr.innerHTML = `
        <td>${escapeHtml(a.date || "")}</td>
        <td>${escapeHtml(a.time || "")}</td>
        <td>${escapeHtml(a.service?.name || a.serviceName || "")}</td>
        <td>${escapeHtml(a.customerName || "")}</td>
        <td>${escapeHtml(a.customerPhone || "")}</td>
        <td>${badge}</td>
        <td class="right">
          <button class="btn" data-act="confirm" data-id="${a.id}">Confirmar</button>
          <button class="btn" data-act="cancel" data-id="${a.id}">Cancelar</button>
        </td>
      `;

      tbody.appendChild(tr);
    }
  } catch (e) {
    empty.style.display = "block";
    empty.textContent = "Error cargando turnos: " + e.message;
  }
}

function statusBadge(status) {
  if (status === "confirmed") return `<span class="badge good">● Confirmado</span>`;
  if (status === "canceled") return `<span class="badge bad">● Cancelado</span>`;
  return `<span class="badge warn">● Pendiente</span>`;
}

document.getElementById("btnApplyFilters").addEventListener("click", loadAppointments);

document.querySelector("#appointmentsTable").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;
  if (!id || !act) return;

  try {
    if (act === "confirm") await apiPut(`/appointments/${id}/status`, { status: "confirmed" });
    if (act === "cancel") await apiPut(`/appointments/${id}/status`, { status: "canceled" });
    await loadAppointments();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

// --- Servicios ---
async function loadServices() {
  const grid = document.getElementById("servicesGrid");
  grid.innerHTML = "";

  try {
    const data = await apiGet("/services"); // ajustá si tu endpoint difiere
    const items = data.items || data || [];

    for (const s of items) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-head">
          <div>
            <h3 style="margin:0">${escapeHtml(s.name)}</h3>
            <p class="muted" style="margin:6px 0 0">
              $${escapeHtml(String(s.price))} • ${escapeHtml(String(s.durationMinutes || 30))} min
              ${s.depositPercentage != null ? `• Seña ${escapeHtml(String(s.depositPercentage))}%` : "• Seña por defecto"}
            </p>
          </div>
          <div class="actions">
            <button class="btn" data-edit="${s.id}">Editar</button>
            <button class="btn" data-del="${s.id}">Borrar</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    }
  } catch (e) {
    grid.innerHTML = `<div class="muted">Error cargando servicios: ${escapeHtml(e.message)}</div>`;
  }
}

// --- Config ---
async function loadConfig() {
  try {
    const shop = await apiGet("/barbershops/mine");
    document.getElementById("cfgName").value = shop.name || "";
    document.getElementById("cfgCity").value = shop.city || "";
    document.getElementById("cfgAddress").value = shop.address || "";
    document.getElementById("cfgPhone").value = shop.phone || "";
  } catch (e) {
    console.warn(e.message);
  }
}

// --- util ---
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[s]));
}

// botones top
document.getElementById("btnReload").addEventListener("click", () => showView(getRoute()));

// init
(async function init(){
  await loadShopHeader();
  showView(getRoute());
})();
