// admin_v2.js
const API = (typeof API_BASE !== "undefined" ? API_BASE : "https://barbercloud.onrender.com/api");

// ---- token helpers (compat con tu admin viejo) ----
const TOKEN_KEYS = ["bc_token", "token"];
function getToken() {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}
function setToken(t) {
  localStorage.setItem("bc_token", t);
}
function clearToken() {
  for (const k of TOKEN_KEYS) localStorage.removeItem(k);
}

// ---- small helpers DOM (para NO romper si falta un id) ----
function $(id) {
  return document.getElementById(id);
}
function safeVal(id, fallback = "") {
  const el = $(id);
  if (!el) return fallback;
  return el.value ?? fallback;
}
function safeText(id, txt) {
  const el = $(id);
  if (el) el.textContent = txt;
}
function safeShow(id, show) {
  const el = $(id);
  if (el) el.style.display = show ? "block" : "none";
}

// ---- UI UX Helpers (Fase 9) ----
function renderTableSkeletons(tbody, cols, rows = 5) {
  if (!tbody) return;
  const trs = Array(rows).fill(0).map(() => 
    `<tr>${Array(cols).fill('<td><div class="skeleton skeleton-row"></div></td>').join('')}</tr>`
  );
  tbody.innerHTML = trs.join("");
}

function renderGridSkeletons(container, count = 3) {
  if (!container) return;
  const cards = Array(count).fill(0).map(() => 
    `<div class="card"><div class="card-body"><div class="skeleton skeleton-card"></div></div></div>`
  );
  container.innerHTML = cards.join("");
}

function setBtnLoading(btnId, state) {
  const btn = $(btnId);
  if (!btn) return;
  if (state) {
    btn.classList.add("is-loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("is-loading");
    btn.disabled = false;
  }
}

// ---- routing ----
const views = {
  agenda: $("view-agenda"),
  clientes: $("view-clientes"),
  servicios: $("view-servicios"),
  config: $("view-config"),
  miembros: $("view-miembros"),
  estadisticas: $("view-estadisticas"),
};

const pageTitle = $("pageTitle");
const pageSubtitle = $("pageSubtitle");

function setActiveNav(route) {
  document.querySelectorAll(".nav-item").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

function showView(route) {
  Object.entries(views).forEach(([k, el]) => {
    if (!el) return;
    el.style.display = k === route ? "block" : "none";
  });

  setActiveNav(route);

  if (route === "agenda") {
    if (pageTitle) pageTitle.textContent = "Agenda";
    if (pageSubtitle) pageSubtitle.textContent = "Gestioná tus turnos";
    loadAppointments();
  }
  if (route === "servicios") {
    if (pageTitle) pageTitle.textContent = "Servicios";
    if (pageSubtitle) pageSubtitle.textContent = "Precios, duración y seña";
    loadServices();
  }
  if (route === "config") {
    if (pageTitle) pageTitle.textContent = "Configuración";
    if (pageSubtitle) pageSubtitle.textContent = "Datos de tu barbería";
    loadConfig();
  }
  if (route === "clientes") {
    if (pageTitle) pageTitle.textContent = "Clientes";
    if (pageSubtitle) pageSubtitle.textContent = "Historial y búsqueda";
    loadClients();
  }
  if (route === "miembros") {
    if (pageTitle) pageTitle.textContent = "Equipo";
    if (pageSubtitle) pageSubtitle.textContent = "Tus barberos y plantillas horarias";
    loadMembers();
  }
  if (route === "estadisticas") {
    if (pageTitle) pageTitle.textContent = "Estadísticas";
    if (pageSubtitle) pageSubtitle.textContent = "Métricas reales y rendimiento del negocio";
    loadStatistics();
  }
}

function getRoute() {
  const hash = location.hash || "#/agenda";
  return hash.replace("#/", "");
}

window.addEventListener("hashchange", () => showView(getRoute()));

// ===============================
// 8. MÓDULO DE FOTO BASE64
// ===============================
async function handleImg() {} // Reubicado en compressImageToBase64

// ===============================
// 9. MÓDULO ESTADÍSTICAS (FASE 8)
// ===============================
let activeCharts = {};

Chart.defaults.color = 'rgba(232,238,252,0.65)';
Chart.defaults.font.family = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';

async function loadStatistics(days = null) {
  const container = $("view-estadisticas");
  if (!container || container.style.display === "none") return;

  if (!days) {
    const activeChip = document.querySelector('.stats-filters .chip.active');
    days = activeChip ? activeChip.dataset.range : 30;
  }

  // Visual skeleton / Loading
  safeText("statNetIncome", "...");
  safeText("statConfirmed", "...");
  safeText("statAvgTicket", "...");
  safeText("statCanceled", "...");
  
  try {
    const res = await apiGet(`/statistics?days=${days}`);
    const { summary, charts, rankings } = res;

    // 1. Llenar KPIs
    safeText("statNetIncome", "$" + (summary.totalNetIncome || 0).toLocaleString("es-AR"));
    safeText("statConfirmed", summary.confirmedCount || 0);
    safeText("statAvgTicket", "$" + (summary.averageTicket || 0).toLocaleString("es-AR"));
    safeText("statCanceled", summary.canceledCount || 0);

    safeText("statTopBarber", summary.topBarber || "-");
    safeText("statFreqClient", summary.topClient || "-");
    
    const ratio = summary.confirmedCount > 0 
      ? Math.round((summary.confirmedCount / (summary.confirmedCount + summary.canceledCount)) * 100)
      : 0;
    safeText("statRatio", ratio + "%");

    // 2. Ranking Clientes
    const listEl = $("topClientsList");
    if (listEl) {
      if (!rankings.topClients.length) {
        listEl.innerHTML = `<li class="muted">No hay clientes en este rango.</li>`;
      } else {
        listEl.innerHTML = rankings.topClients.map((c, i) => `
          <li style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px 14px; border-radius:12px; border:1px solid var(--border);">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:28px; height:28px; border-radius:50%; background:var(--bg-card); display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--primary);">${i+1}</div>
              <div style="font-weight:600;">${escapeHtml(c.name || "Cliente")}</div>
            </div>
            <div style="text-align:right; font-size:13px;">
              <div style="color:var(--good); font-weight:bold;">$${c.spent.toLocaleString("es-AR")}</div>
              <div class="muted">${c.count} turnos</div>
            </div>
          </li>
        `).join("");
      }
    }

    // 3. Renderizar Gráficos con Chart.js
    renderChart("evolutionChart", "line", {
      labels: charts.timeseries.map(t => {
        // Formatear la fecha para que sea más legible (MM-DD o YYYY-MM)
        const parts = t.date.split("-");
        return parts.length === 3 ? `${parts[2]}/${parts[1]}` : `${parts[1]}/${parts[0]}`;
      }),
      datasets: [
        {
          label: "Ingresos Netos ($)",
          data: charts.timeseries.map(t => t.income),
          borderColor: "#2f7bff",
          backgroundColor: "rgba(47, 123, 255, 0.15)",
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: "#0b0f14",
          pointBorderColor: "#2f7bff",
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: 'y'
        },
        {
          label: "Turnos",
          data: charts.timeseries.map(t => t.appointments),
          borderColor: "rgba(232, 238, 252, 0.4)",
          backgroundColor: "transparent",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 0,
          yAxisID: 'y1'
        }
      ]
    }, {
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.05)" } },
        y: { type: 'linear', display: true, position: 'left', grid: { color: "rgba(255,255,255,0.05)" } },
        y1: { type: 'linear', display: false, position: 'right', grid: { drawOnChartArea: false } },
      },
      plugins: { tooltip: { mode: 'index', intersect: false } },
      interaction: { mode: 'nearest', axis: 'x', intersect: false }
    });

    renderChart("barberChart", "doughnut", {
      labels: charts.barbersData.map(b => b.name),
      datasets: [{
        data: charts.barbersData.map(b => b.income),
        backgroundColor: ["#2f7bff", "#27d17c", "#ffcc66", "#a855f7", "#ec4899", "#f97316"],
        borderWidth: 0,
        hoverOffset: 4
      }]
    }, { cutout: '70%', plugins: { legend: { position: 'right' } } });

    renderChart("serviceChart", "bar", {
      labels: charts.servicesData.map(s => escapeHtml(s.name)),
      datasets: [{
        label: "Ingreso Generado",
        data: charts.servicesData.map(s => s.income),
        backgroundColor: "rgba(39, 209, 124, 0.8)",
        borderRadius: 4
      }]
    }, { indexAxis: 'y', plugins: { legend: { display:false } }, scales: { x: { grid:{ color:"rgba(255,255,255,0.05)" } }, y: { grid:{ display:false } } } });

  } catch (err) {
    console.error(err);
    alert("Error cargando métricas: " + err.message);
  }
}

function renderChart(canvasId, type, data, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (activeCharts[canvasId]) { activeCharts[canvasId].destroy(); }
  
  activeCharts[canvasId] = new Chart(canvas, {
    type,
    data,
    options: Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { labels: { color: 'rgba(232,238,252,0.8)', font: { size: 12 } } }
      }
    }, options)
  });
}

// Chips events
document.querySelectorAll(".chip[data-range]").forEach(btn => {
  btn.addEventListener("click", (e) => {
    document.querySelectorAll(".chip[data-range]").forEach(c => c.classList.remove("active"));
    e.target.classList.add("active");
    loadStatistics(e.target.dataset.range);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  showView(getRoute());
});

// ---- API helpers ----
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function safeTextRes(res) {
  try {
    return await res.text();
  } catch {
    return "Error";
  }
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await safeTextRes(res));
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await safeTextRes(res));
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await safeTextRes(res));
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${API}${path}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(await safeTextRes(res));
  return res.json();
}

// ---- modal ----
const modalBackdrop = $("modalBackdrop");
const modalTitle = $("modalTitle");
const modalSubtitle = $("modalSubtitle");
const modalBody = $("modalBody");
const btnModalClose = $("btnModalClose");
const btnModalCancel = $("btnModalCancel");
const btnModalOk = $("btnModalOk");

let modalResolve = null;

// ✅ CAMBIO: limpiar modalBody al abrir (para que no quede "sucio")
function openModal({ title, subtitle = "", bodyHtml, okText = "Guardar" }) {
  if (modalBody) modalBody.innerHTML = ""; // ✅ limpiar al abrir
  if (modalTitle) modalTitle.textContent = title;
  if (modalSubtitle) modalSubtitle.textContent = subtitle;
  if (modalBody) modalBody.innerHTML = bodyHtml;
  if (btnModalOk) btnModalOk.textContent = okText;
  if (modalBackdrop) modalBackdrop.style.display = "grid";

  return new Promise((resolve) => {
    modalResolve = resolve;
  });
}

// ✅ CAMBIO: NO limpiar modalBody al cerrar (porque después necesitamos leer inputs)
function closeModal(result = null) {
  if (modalBackdrop) modalBackdrop.style.display = "none";
  // ❌ NO borres modalBody acá, porque después necesitamos leer los inputs
  if (modalResolve) modalResolve(result);
  modalResolve = null;
}

btnModalClose?.addEventListener("click", () => closeModal(null));
btnModalCancel?.addEventListener("click", () => closeModal(null));
btnModalOk?.addEventListener("click", () => closeModal({ ok: true }));

// ---- login ----
const loginBackdrop = $("loginBackdrop");
const btnOpenLogin = $("btnOpenLogin");
const btnLogin = $("btnLogin");
const btnLoginClose = $("btnLoginClose");
const loginEmail = $("loginEmail");
const loginPassword = $("loginPassword");
const loginError = $("loginError");

function openLogin() {
  if (loginError) loginError.style.display = "none";
  if (loginBackdrop) loginBackdrop.style.display = "grid";
}
function closeLogin() {
  if (loginBackdrop) loginBackdrop.style.display = "none";
}

btnOpenLogin?.addEventListener("click", openLogin);
btnLoginClose?.addEventListener("click", closeLogin);

btnLogin?.addEventListener("click", async () => {
  try {
    setBtnLoading("btnLogin", true);
    if (loginError) loginError.style.display = "none";
    const email = (loginEmail?.value || "").trim();
    const password = loginPassword?.value || "";

    if (!email || !password) {
      if (loginError) {
        loginError.textContent = "Completá email y contraseña.";
        loginError.style.display = "block";
      }
      return;
    }

    const data = await apiPost("/auth/login", { email, password });
    if (!data.token) throw new Error("No recibí token");

    setToken(data.token);
    closeLogin();
    setBtnLoading("btnLogin", false);
    await loadShopHeader();
    showView(getRoute());
  } catch (e) {
    setBtnLoading("btnLogin", false);
    if (loginError) {
      loginError.textContent = "Error: " + e.message;
      loginError.style.display = "block";
    }
  }
});

$("btnLogout")?.addEventListener("click", () => {
  clearToken();
  openLogin();
});

// ---- shop header ----
async function loadShopHeader() {
  try {
    const data = await apiGet("/barbershops/mine");

    safeText("shopName", data.name || "BarberCloud");
    safeText("shopCity", data.city || "Admin");
    // Identidad (Logo)
    const avatarEl = $("shopAvatar");
    if (avatarEl) {
      if (data.logoBase64) {
        avatarEl.style.padding = "0";
        avatarEl.innerHTML = `<img src="${data.logoBase64}" alt="Logo" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`;
      } else {
        avatarEl.style.padding = "";
        const initial = (data.name || "B").trim().charAt(0).toUpperCase();
        avatarEl.innerHTML = initial;
      }
    }

    const filled = ["name", "city", "address", "phone", "slug"].filter((k) => data[k]).length;
    const pct = Math.round((filled / 5) * 100);
    safeText("setupPct", `${pct}%`);
    const bar = $("setupBar");
    if (bar) bar.style.width = `${pct}%`;
  } catch (e) {
    console.warn("No pude cargar barbería (mine):", e.message);
  }
}

// ---- Agenda ----
function statusBadge(status, lockExpiresAt) {
  if (status === "CONFIRMED" || status === "confirmed") return `<span class="badge good">● Confirmado</span>`;
  if (status === "CANCELLED_MANUAL" || status === "canceled" || status === "CANCELLED_EXPIRED") return `<span class="badge bad">● Cancelado</span>`;
  if (status === "PENDING_PAYMENT" || status === "payment_pending") {
     if (lockExpiresAt) return `<span class="badge warn" data-expires="${lockExpiresAt}" style="font-weight:bold; color:#b45309; background:#fef3c7; border:1px solid #f59e0b;">Esperando seña 🕒 ...</span>`;
     return `<span class="badge warn">● Seña Bloqueada...</span>`;
  }
  return `<span class="badge warn">● Pendiente Local</span>`;
}

// FASE 7.1: Motor reactivo temporal de la agenda
setInterval(() => {
  const badges = document.querySelectorAll('span[data-expires]');
  if (!badges.length) return;

  const now = new Date();
  let needsReload = false;

  badges.forEach(b => {
    const exp = new Date(b.dataset.expires);
    const diffMs = exp.getTime() - now.getTime();

    if (diffMs <= 0) {
      b.removeAttribute("data-expires");
      b.className = "badge bad";
      b.style = "";
      b.textContent = "● Cancelado";
      
      const tr = b.closest("tr");
      if (tr) {
        tr.dataset.status = "CANCELLED_EXPIRED";
        const btnBox = tr.querySelector(".right");
        if (btnBox) btnBox.innerHTML = ""; // Remover acciones
      }
    } else {
      const totalSecs = Math.floor(diffMs / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      b.textContent = `Esperando seña 🕒 ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  });
}, 1000);

// Polling suave y silencioso cada 15s para detectar confirmaciones online
setInterval(() => {
  if (document.querySelector("#appointmentsTable:not([style*='display: none'])")) {
    if (typeof loadAppointments === "function") loadAppointments(true);
  }
}, 15000);

async function loadAppointments(isSilentPoll = false) {
  const tbody = document.querySelector("#appointmentsTable tbody");
  const empty = $("appointmentsEmpty");

  const q = (safeVal("qAppointments", "") || "").trim();
  const status = safeVal("statusFilter", "");
  const from = safeVal("fromDate", "");
  const to = safeVal("toDate", "");

  if (!isSilentPoll && empty) empty.style.display = "none";
  if (!isSilentPoll && tbody && !tbody.children.length) {
    renderTableSkeletons(tbody, 8, 4);
  }

  try {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    if (q) params.set("q", q);

    const data = await apiGet(`/appointments?${params.toString()}`);
    const items = data.items || data || [];

    if (!items.length) {
      if (tbody) tbody.innerHTML = "";
      if (empty) {
        empty.style.display = "block";
        empty.textContent = "No tenés turnos para este rango.";
      }
      return;
    }

    if (empty) empty.style.display = "none";

    // FASE 7.1: DOM Diffing Estabilizado
    const existingRows = Array.from(tbody.querySelectorAll("tr[data-appid]"));
    const newIds = items.map(a => String(a.id));

    // 1. Quitar los que ya no vienen (fueron limpiados por backend)
    existingRows.forEach(tr => {
      if (!newIds.includes(tr.dataset.appid)) {
        tr.remove();
      }
    });

    // 2. Insertar o Mutar los que vengan
    items.forEach(a => {
      let tr = tbody.querySelector(`tr[data-appid="${a.id}"]`);
      
      let actionsHtml = "";
      if (a.status === "PENDING_PAYMENT" || a.status === "pending") {
         actionsHtml = `
           <button class="btn" data-act="confirm" data-id="${a.id}">Confirmar</button>
           <button class="btn" data-act="cancel" data-id="${a.id}">Cancelar</button>
         `;
      } else if (a.status === "CONFIRMED" || a.status === "confirmed") {
         actionsHtml = `<button class="btn" data-act="cancel" data-id="${a.id}">Cancelar</button>`;
      }

      const htmlContent = `
        <td>${escapeHtml(a.date || "")}</td>
        <td>${escapeHtml(a.time || "")}</td>
        <td>${escapeHtml(a.barber?.name || "\u2014")}</td>
        <td>${escapeHtml(a.service?.name || "")}</td>
        <td>${escapeHtml(a.customerName || "")}</td>
        <td>${escapeHtml(a.customerPhone || "")}</td>
        <td>${statusBadge(a.status, a.lockExpiresAt)}</td>
        <td class="right">${actionsHtml}</td>
      `;

      if (!tr) {
        tr = document.createElement("tr");
        tr.dataset.appid = a.id;
        tr.innerHTML = htmlContent;
        tbody.appendChild(tr);
      } else {
        // Solo actualizar si la cadena HTML interna muta (p. ej estado o acciones cambiaron)
        if (tr.dataset.rawHtml !== htmlContent) {
            tr.innerHTML = htmlContent;
        }
      }
      tr.dataset.rawHtml = htmlContent;
    });

  } catch (e) {
    if (empty && !isSilentPoll) {
      empty.style.display = "block";
      empty.textContent = "Error cargando turnos: " + e.message;
    }
  }
}

$("btnApplyFilters")?.addEventListener("click", loadAppointments);

document.querySelector("#appointmentsTable")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  const act = btn.dataset.act;
  if (!id || !act) return;

  try {
    if (act === "confirm") await apiPut(`/appointments/${id}/status`, { status: "CONFIRMED" });
    if (act === "cancel") await apiPut(`/appointments/${id}/status`, { status: "CANCELLED_MANUAL" });
    await loadAppointments();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

// ✅ NUEVO: Agregar turno (modal + POST /appointments/owner)
// - usa un único addEventListener al botón por ID: btnQuickAdd
// - valida que los inputs existan antes de leer values (safeVal ya lo hace)
async function openAddTurnModal() {
  try {
    // Necesitamos el slug de la barberia para llamar al endpoint público de disponibilidad
    const shop = await apiGet("/barbershops/mine");
    if (!shop.slug) {
       alert("Tu barbería necesita configurar un Slug (Link público) en la sección Configuración primero.");
       location.hash = "#/config";
       return;
    }

    const { items: services } = await apiGet("/services/mine");
    if (!services || !services.length) {
      alert("Primero creá al menos 1 servicio.");
      location.hash = "#/servicios";
      return;
    }

    const { members } = await apiGet("/members");
    const activeMembers = (members || []).filter(m => m.isActive);
    if (!activeMembers.length) {
      alert("No tenés barberos activos. Agregá uno en la sección Equipo.");
      location.hash = "#/miembros";
      return;
    }

    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

    // Store temporarily in window to avoid multiple complex fetches in handlers
    window._addTurnData = { services, members: activeMembers, shop };

    const srvOptions = services.map(s => `<option value="${s.id}">${escapeHtml(s.name)} ($${s.price})</option>`).join("");

    const result = await openModal({
      title: "Nuevo turno manual",
      subtitle: "Flujo estricto paso a paso",
      bodyHtml: `
        <style>
          .step-group { margin-bottom: 16px; }
          .barber-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin-top: 6px; }
          .barber-card {
            border: 1px solid var(--border); border-radius: 8px; padding: 10px;
            display: flex; align-items: center; gap: 10px; cursor: pointer;
            transition: all 0.2s; background: var(--bg-card); user-select: none;
          }
          .barber-card:hover { border-color: var(--cyan); }
          .barber-card.selected { border-color: var(--cyan); background: rgba(0, 255, 255, 0.1); }
          .barber-avatar {
            width: 42px; height: 42px; border-radius: 50%; object-fit: cover;
            background: var(--bg); display: flex; align-items: center; justify-content: center;
            font-weight: bold; overflow: hidden; flex-shrink: 0; color: var(--text);
          }
          .barber-avatar img { width: 100%; height: 100%; object-fit: cover; }
          .barber-info { display: flex; flex-direction: column; overflow: hidden; }
          .barber-name { font-weight: bold; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .barber-role { font-size: 12px; color: var(--text-muted); }
        </style>

        <div class="step-group" id="step1">
          <label class="label">1. Cliente</label>
          <input class="input" id="apptName" placeholder="Nombre y apellido" autocomplete="off" />
        </div>

        <div class="step-group" id="step2">
          <label class="label">2. Servicio</label>
          <select class="input" id="apptService">
            <option value="">-- Elegí un servicio --</option>
            ${srvOptions}
          </select>
        </div>

        <div class="step-group" id="step3" style="display:none;">
          <label class="label">3. Barbero</label>
          <div id="barberList" class="barber-grid"></div>
          <input type="hidden" id="apptBarber" value="" />
        </div>

        <div class="step-group" id="step4" style="display:none;">
          <label class="label">4. Fecha</label>
          <input class="input" id="apptDate" type="date" value="${todayStr}" min="${todayStr}" />
        </div>

        <div class="step-group" id="step5" style="display:none;">
          <label class="label">5. Horario disponible</label>
          <select class="input" id="apptTime">
            <option value="">-- Elegí horario --</option>
          </select>
          <div id="apptLoading" class="hint" style="display:none; color:var(--cyan); margin-top:5px;">Calculando horarios reales...</div>
        </div>

        <div class="step-group" id="step6" style="display:none;">
          <label class="label">6. Teléfono (opcional)</label>
          <input class="input" id="apptPhone" placeholder="Opcional..." autocomplete="off" />
        </div>
      `,
      okText: "Crear turno",
    });

    delete window._addTurnData;

    if (!result?.ok) return;

    const customerName = String(safeVal("apptName")).trim();
    const serviceId = Number(safeVal("apptService"));
    const barberId = Number(safeVal("apptBarber"));
    const date = String(safeVal("apptDate")).trim();
    const time = String(safeVal("apptTime")).trim();
    const customerPhone = String(safeVal("apptPhone")).trim();

    if (!customerName) return alert("Completá el nombre del cliente.");
    if (!serviceId) return alert("Seleccioná el servicio.");
    if (!barberId) return alert("Seleccioná el barbero.");
    if (!date) return alert("Seleccioná la fecha.");
    if (!time) return alert("Seleccioná el horario disponible válido.");

    await apiPost("/appointments/owner", {
      serviceId,
      barberId,
      date,
      time,
      customerName,
      customerPhone: customerPhone || null,
      status: "pending",
    });

    await loadAppointments();
    alert("Turno creado ✅");
  } catch (e) {
    alert("Error: " + e.message);
  }
}

async function loadAvailableTimes() {
  const srvId = Number($("apptService")?.value);
  const brbId = Number($("apptBarber")?.value);
  const dateVal = $("apptDate")?.value;
  const timeSelect = $("apptTime");
  const loadHint = $("apptLoading");

  if (!srvId || !brbId || !dateVal || !timeSelect) return;

  $("step5").style.display = "block";
  timeSelect.disabled = true;
  timeSelect.innerHTML = `<option value="">Cargando horarios...</option>`;
  if (loadHint) loadHint.style.display = "block";
  $("step6").style.display = "none";

  try {
    const shop = window._addTurnData.shop;
    const { slots } = await apiGet(`/public/${shop.slug}/availability?barberId=${brbId}&serviceId=${srvId}&date=${dateVal}`);
    
    if (loadHint) loadHint.style.display = "none";
    if (!slots || !slots.length) {
       timeSelect.innerHTML = `<option value="">Sin horarios disponibles</option>`;
       return;
    }

    timeSelect.innerHTML = `<option value="">-- Elegí horario --</option>` +
       slots.map(t => `<option value="${t}">${t}</option>`).join("");
    timeSelect.disabled = false;
  } catch(err) {
    if (loadHint) loadHint.style.display = "none";
    timeSelect.innerHTML = `<option value="">Sin horarios disponibles</option>`;
    console.error("Error cargando horarios:", err);
  }
}

// Reactividad global del modal
document.addEventListener("change", (e) => {
  if (e.target.id === "apptService") {
    const srvId = Number(e.target.value);
    const step3 = $("step3");
    const barberList = $("barberList");
    const apptBarber = $("apptBarber");
    
    // Resetear pasos siguientes
    apptBarber.value = "";
    $("step4").style.display = "none";
    $("step5").style.display = "none";
    $("step6").style.display = "none";

    if (!srvId) {
      step3.style.display = "none";
      return;
    }

    // Filtrar barberos que hacen este servicio
    const members = window._addTurnData?.members || [];
    const validBarbers = members.filter(m => m.services && m.services.some(s => s.id === srvId));

    if (!validBarbers.length) {
      step3.style.display = "block";
      barberList.innerHTML = `<div class="hint">Ningún barbero realiza este servicio.</div>`;
      return;
    }

    // Renderizar tarjetas de barberos validos
    barberList.innerHTML = validBarbers.map(b => {
      const initial = escapeHtml(b.name.charAt(0).toUpperCase());
      const avatarHtml = (b.avatarBase64 && b.avatarBase64.length > 50)
        ? `<img src="${escapeAttr(b.avatarBase64)}" alt="Avatar"/>`
        : `<span>${initial}</span>`;

      return `
        <div class="barber-card" data-id="${b.id}">
          <div class="barber-avatar">${avatarHtml}</div>
          <div class="barber-info">
            <span class="barber-name">${escapeHtml(b.name)}</span>
            <span class="barber-role">${escapeHtml(b.role || "Barbero")}</span>
          </div>
        </div>
      `;
    }).join("");

    step3.style.display = "block";
  }

  if (e.target.id === "apptDate") {
    if ($("apptBarber")?.value) {
      loadAvailableTimes();
    }
  }

  if (e.target.id === "apptTime") {
    if (e.target.value) {
      $("step6").style.display = "block";
    } else {
      $("step6").style.display = "none";
    }
  }
});

document.addEventListener("click", (e) => {
  const card = e.target.closest(".barber-card");
  if (card && $("apptBarber")) {
    document.querySelectorAll(".barber-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");
    $("apptBarber").value = card.dataset.id;
    
    // Al seleccionar barbero, mostrar y recargar horarios para la fecha actual
    $("step4").style.display = "block";
    loadAvailableTimes();
  }
});

// ✅ Enganche pedido: event listeners para ambos botones de agregar turno
(function bindQuickAddOnce() {
  const btn1 = document.getElementById("btnQuickAdd");
  const btn2 = document.getElementById("btnQuickAddAgenda");

  if (btn1 && btn1.dataset.bound !== "1") {
    btn1.dataset.bound = "1";
    btn1.addEventListener("click", openAddTurnModal);
  }

  if (btn2 && btn2.dataset.bound !== "1") {
    btn2.dataset.bound = "1";
    btn2.addEventListener("click", openAddTurnModal);
  }
})();

// ---- Servicios ----
async function loadServices() {
  const grid = $("servicesGrid");
  if (!grid) return;
  
  if (!grid.children.length) renderGridSkeletons(grid, 3);

  try {
    const data = await apiGet("/services/mine");
    const items = data.items || data || [];

    grid.innerHTML = "";

    if (!items.length) {
      grid.innerHTML = `<div class="empty">Todavía no tenés servicios. Creá el primero.</div>`;
      return;
    }

    for (const s of items) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-head">
          <div>
            <h3 style="margin:0">${escapeHtml(s.name)}</h3>
            <p class="muted" style="margin:6px 0 0">
              $${escapeHtml(String(s.price))} • ${escapeHtml(String(s.durationMinutes || 30))} min
              ${
                s.depositPercentage != null
                  ? `• Seña ${escapeHtml(String(s.depositPercentage))}%`
                  : "• Seña por defecto"
              }
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

$("btnNewService")?.addEventListener("click", async () => {
  const result = await openModal({
    title: "Nuevo servicio",
    subtitle: "Creá un servicio para tu barbería",
    bodyHtml: `
      <label class="label">Nombre</label>
      <input class="input" id="srvName" placeholder="Corte" />
      <label class="label">Precio</label>
      <input class="input" id="srvPrice" type="number" placeholder="3000" />
      <label class="label">Duración (min)</label>
      <input class="input" id="srvDur" type="number" placeholder="30" />
      <label class="label">Seña (%) (opcional)</label>
      <input class="input" id="srvDep" type="number" placeholder="15" />
      <label class="label">Descripción (opcional)</label>
      <input class="input" id="srvDesc" placeholder="Corte clásico..." />
    `,
    okText: "Crear",
  });

  if (!result?.ok) return;

  try {
    // ✅ valida existencia antes de leer
    const name = ($("srvName")?.value ?? "").trim();
    const price = Number($("srvPrice")?.value);
    const durationMinutes = Number($("srvDur")?.value || 30);
    const depRaw = $("srvDep")?.value ?? "";
    const depositPercentage = depRaw === "" ? null : Number(depRaw);
    const description = ($("srvDesc")?.value ?? "").trim();

    if (!name || Number.isNaN(price)) throw new Error("Nombre y precio son obligatorios");

    await apiPost("/services", {
      name,
      price,
      durationMinutes,
      depositPercentage,
      description: description || null,
    });

    closeModal();
    await loadServices();
  } catch (e) {
    alert("Error: " + e.message);
  }
});

$("servicesGrid")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const editId = btn.dataset.edit;
  const delId = btn.dataset.del;

  if (delId) {
    if (!confirm("¿Seguro que querés borrar este servicio?")) return;
    try {
      await apiDelete(`/services/${delId}`);
      await loadServices();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  if (editId) {
    try {
      const services = await apiGet("/services/mine");
      const items = services.items || services || [];
      const s = items.find((x) => String(x.id) === String(editId));
      if (!s) return alert("No encontré el servicio");

      const result = await openModal({
        title: "Editar servicio",
        subtitle: "Actualizá precio, duración o seña",
        bodyHtml: `
          <label class="label">Nombre</label>
          <input class="input" id="srvName" value="${escapeAttr(s.name)}" />
          <label class="label">Precio</label>
          <input class="input" id="srvPrice" type="number" value="${escapeAttr(String(s.price))}" />
          <label class="label">Duración (min)</label>
          <input class="input" id="srvDur" type="number" value="${escapeAttr(
            String(s.durationMinutes || 30)
          )}" />
          <label class="label">Seña (%) (vacío = usa por defecto)</label>
          <input class="input" id="srvDep" type="number" value="${
            s.depositPercentage == null ? "" : escapeAttr(String(s.depositPercentage))
          }" />
          <label class="label">Descripción (opcional)</label>
          <input class="input" id="srvDesc" value="${
            s.description ? escapeAttr(String(s.description)) : ""
          }" />
        `,
        okText: "Guardar",
      });

      if (!result?.ok) return;

      // ✅ valida existencia antes de leer
      const name = ($("srvName")?.value ?? "").trim();
      const price = Number($("srvPrice")?.value);
      const durationMinutes = Number($("srvDur")?.value || 30);
      const depRaw = $("srvDep")?.value ?? "";
      const depositPercentage = depRaw === "" ? null : Number(depRaw);
      const description = ($("srvDesc")?.value ?? "").trim();

      await apiPut(`/services/${editId}`, {
        name,
        price,
        durationMinutes,
        depositPercentage,
        description: description || null,
      });

      closeModal();
      await loadServices();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }
});

// ---- Config ----
async function loadConfig() {
  try {
    const shop = await apiGet("/barbershops/mine");
    if ($("cfgName")) $("cfgName").value = shop.name || "";
    if ($("cfgCity")) $("cfgCity").value = shop.city || "";
    if ($("cfgAddress")) $("cfgAddress").value = shop.address || "";
    if ($("cfgPhone")) $("cfgPhone").value = shop.phone || "";
    if ($("cfgSlug")) $("cfgSlug").value = shop.slug || "";
    if ($("cfgDepositPct"))
      $("cfgDepositPct").value =
        shop.defaultDepositPercentage != null ? String(shop.defaultDepositPercentage) : "";
        
    const p = $("cfgLogoPreview");
    const f = $("cfgLogoFallback");
    if (shop.logoBase64) {
        if (p) { p.src = shop.logoBase64; p.style.display = "block"; }
        if (f) { f.style.display = "none"; }
    } else {
        if (p) { p.src = ""; p.style.display = "none"; }
        if (f) { f.style.display = "flex"; }
    }
    window.pendingLogoRemoved = false;
    const fileInp = $("cfgLogoFile");
    if (fileInp) fileInp.value = "";

    // ✅ Renderizar widget público
    renderPublicChannel(shop.slug);

  } catch (e) {
    console.warn(e.message);
  }
}

// ---- Widget Público Reservas ----
let qrCodeInstance = null;

function renderPublicChannel(slug) {
  const linkDisplay = $("cfgPublicLinkDisplay");
  const btnCopy = $("btnCopyPublicLink");
  const btnOpen = $("btnOpenPublicLink");
  const btnDown = $("btnDownloadQr");
  const qrBox = $("cfgQrContainer");

  if (!linkDisplay || !qrBox) return;

  if (!slug) {
    linkDisplay.innerHTML = `<span style="color: var(--danger);">⚠ Primero configurá tu slug debajo y guardá.</span>`;
    linkDisplay.dataset.url = "";
    btnCopy.disabled = true;
    btnOpen.disabled = true;
    btnDown.disabled = true;
    qrBox.innerHTML = '<div style="color:var(--text-muted); font-size:12px; padding:20px;">Sin QR</div>';
    if (qrCodeInstance) { qrCodeInstance.clear(); qrCodeInstance = null; }
    return;
  }

  // Armamos URL absoluta
  const baseUrl = window.location.origin + window.location.pathname.replace("admin_v2.html", "");
  const publicUrl = baseUrl + "book.html?slug=" + slug;
  
  linkDisplay.textContent = publicUrl;
  linkDisplay.dataset.url = publicUrl;
  
  btnCopy.disabled = false;
  btnOpen.disabled = false;
  btnDown.disabled = false;

  // Dibujar QR
  qrBox.innerHTML = "";
  qrCodeInstance = new QRCode(qrBox, {
    text: publicUrl,
    width: 128,
    height: 128,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

$("btnCopyPublicLink")?.addEventListener("click", () => {
  const link = $("cfgPublicLinkDisplay")?.dataset.url;
  if (!link) return;
  navigator.clipboard.writeText(link).then(() => {
    alert("✅ Link copiado al portapapeles");
  }).catch(err => {
    console.error("No se pudo copiar", err);
  });
});

$("btnDownloadQr")?.addEventListener("click", () => {
  const qrBox = $("cfgQrContainer");
  const img = qrBox.querySelector("img");
  const canvas = qrBox.querySelector("canvas");

  let urlToDescargar = "";
  if (img && img.src && img.src.length > 100) { // SVG/PNG mode in some mobiles
    urlToDescargar = img.src;
  } else if (canvas) {
    urlToDescargar = canvas.toDataURL("image/png");
  }

  if (!urlToDescargar) {
    alert("El QR aún no se generó o hubo un error.");
    return;
  }

  const a = document.createElement("a");
  a.href = urlToDescargar;
  a.download = "QR_Reservas_BarberCloud.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});


window.pendingLogoRemoved = false;
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

$("btnRemoveLogo")?.addEventListener("click", () => {
    const p = $("cfgLogoPreview");
    const f = $("cfgLogoFallback");
    if (p) { p.src = ""; p.style.display = "none"; }
    if (f) { f.style.display = "flex"; }
    const fileInp = $("cfgLogoFile");
    if (fileInp) fileInp.value = "";
    window.pendingLogoRemoved = true;
});

$("cfgLogoFile")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        alert("El logo es muy pesado. Máximo 2MB.");
        e.target.value = "";
        return;
    }
    try {
        const b64 = await fileToBase64(file);
        const p = $("cfgLogoPreview");
        const f = $("cfgLogoFallback");
        if (p) { p.src = b64; p.style.display = "block"; }
        if (f) { f.style.display = "none"; }
        window.pendingLogoRemoved = false;
    } catch(err) { console.error(err); }
});

$("btnSaveConfig")?.addEventListener("click", async () => {
  try {
    setBtnLoading("btnSaveConfig", true);
    const name = safeVal("cfgName", "").trim();
    const city = safeVal("cfgCity", "").trim();
    const address = safeVal("cfgAddress", "").trim();
    const phone = safeVal("cfgPhone", "").trim();
    const slug = safeVal("cfgSlug", "").trim();
    const pctRaw = safeVal("cfgDepositPct", "").trim();
    const pct = pctRaw === "" ? NaN : Number(pctRaw);

    
    const fileInp = $("cfgLogoFile");
    let logoPayload = undefined;
    if (window.pendingLogoRemoved) {
      logoPayload = null;
    } else if (fileInp && fileInp.files && fileInp.files[0]) {
      logoPayload = await fileToBase64(fileInp.files[0]);
    }

    await apiPut("/barbershops/mine", {
      name,
      city: city || null,
      address: address || null,
      phone: phone || null,
      slug: slug || null,
      ...(logoPayload !== undefined ? { logoBase64: logoPayload } : {})
    });
    window.pendingLogoRemoved = false;
    if (fileInp) fileInp.value = "";

    if (!Number.isNaN(pct)) {
      await apiPut("/barbershops/mine/settings", { defaultDepositPercentage: pct });
    }

    await loadShopHeader();
    alert("Guardado ✅");
  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    setBtnLoading("btnSaveConfig", false);
  }
});

// ---- utils ----
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[s]));
}
function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---- Clientes ----
async function loadClients() {
  const tbody = document.querySelector("#clientsTable tbody");
  const empty = $("clientsEmpty");
  const q = (safeVal("qClients", "") || "").trim();

  if (empty) empty.style.display = "none";
  if (tbody && !tbody.children.length) {
    renderTableSkeletons(tbody, 6, 5);
  }

  try {
    const params = new URLSearchParams();
    if (q) params.set("q", q);

    const data = await apiGet(`/clients/mine?${params.toString()}`);
    const items = data.items || [];

    if (!items.length) {
      if (tbody) tbody.innerHTML = "";
      if (empty) {
        empty.style.display = "block";
        empty.textContent = q ? "No se encontraron clientes." : "No hay clientes todavía.";
      }
      return;
    }
    
    if (tbody) tbody.innerHTML = "";

    for (const c of items) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(c.customerName || "")}</td>
        <td>${escapeHtml(c.customerPhone || "")}</td>
        <td>${escapeHtml(c.customerEmail || "—")}</td>
        <td>${c.totalAppointments || 0}</td>
        <td>${c.confirmedAppointments || 0}</td>
        <td>${escapeHtml(c.lastDate || "—")}</td>
      `;
      tbody?.appendChild(tr);
    }
  } catch (e) {
    if (empty) {
      empty.style.display = "block";
      empty.textContent = "Error cargando clientes: " + e.message;
    }
  }
}

$("btnSearchClients")?.addEventListener("click", loadClients);

// ---- Calendar Tab Toggle ----
let currentTab = "list";

document.querySelector(".tabs")?.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;

  const mode = tab.dataset.tab;
  if (!mode) return;

  currentTab = mode;

  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");

  const tableWrap = document.querySelector("#view-agenda .table-wrap");
  const filtersEl = document.querySelector("#view-agenda .filters");
  const emptyEl = $("appointmentsEmpty");
  const calEl = $("calendarView");

  if (mode === "list") {
    if (tableWrap) tableWrap.style.display = "block";
    if (filtersEl) filtersEl.style.display = "flex";
    if (emptyEl) emptyEl.style.display = "";
    if (calEl) calEl.style.display = "none";
    loadAppointments();
  } else {
    if (tableWrap) tableWrap.style.display = "none";
    if (filtersEl) filtersEl.style.display = "none";
    if (emptyEl) emptyEl.style.display = "none";
    if (calEl) calEl.style.display = "block";
    renderCalendar();
  }
});

// ---- Calendar Render ----
let calWeekOffset = 0;

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push({ date: `${yyyy}-${mm}-${dd}`, dayName: d.toLocaleDateString("es-AR", { weekday: "short" }), dayNum: dd });
  }
  return dates;
}

async function renderCalendar() {
  const cal = $("calendarView");
  if (!cal) return;

  const dates = getWeekDates(calWeekOffset);
  const from = dates[0].date;
  const to = dates[6].date;

  let items = [];
  try {
    const data = await apiGet(`/appointments?from=${from}&to=${to}`);
    items = data.items || data || [];
  } catch (e) {
    cal.innerHTML = `<div class="muted">Error cargando turnos: ${escapeHtml(e.message)}</div>`;
    return;
  }

  // Group by date+hour
  const grid = {};
  for (const a of items) {
    // FASE 7.1: Excluir todos los tipos de cancelados del calendario visual
    if (a.status === "canceled" || a.status === "CANCELLED_MANUAL" || a.status === "CANCELLED_EXPIRED") continue;
    
    const hour = (a.time || "00:00").slice(0, 2);
    const key = `${a.date}_${hour}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(a);
  }

  const hours = [];
  for (let h = 8; h <= 21; h++) hours.push(String(h).padStart(2, "0"));

  const headerCells = dates.map(d => `<th style="text-align:center;min-width:100px">${d.dayName}<br/><b>${d.dayNum}</b></th>`).join("");

  const rows = hours.map(h => {
    const cells = dates.map(d => {
      const key = `${d.date}_${h}`;
      const appts = grid[key] || [];
      const content = appts.map(a => {
        const badge = a.status === "confirmed" ? "good" : "warn";
        const barberTag = a.barber?.name ? `<span style="opacity:0.6">[${escapeHtml(a.barber.name)}]</span> ` : "";
        return `<div class="badge ${badge}" style="font-size:11px;margin:2px 0;display:block">${barberTag}${escapeHtml(a.customerName || "?")} ${escapeHtml(a.time || "")}</div>`;
      }).join("");
      return `<td style="vertical-align:top;padding:6px">${content}</td>`;
    }).join("");
    return `<tr><td style="color:var(--muted);font-size:12px;white-space:nowrap">${h}:00</td>${cells}</tr>`;
  }).join("");

  cal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap">
      <button class="btn" id="calPrev">◀ Anterior</button>
      <span><b>${dates[0].date}</b> — <b>${dates[6].date}</b></span>
      <button class="btn" id="calNext">Siguiente ▶</button>
    </div>
    <div class="table-wrap">
      <table class="table" style="min-width:900px">
        <thead><tr><th style="width:60px">Hora</th>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  $("calPrev")?.addEventListener("click", () => { calWeekOffset--; renderCalendar(); });
  $("calNext")?.addEventListener("click", () => { calWeekOffset++; renderCalendar(); });
}

// botones top
$("btnReload")?.addEventListener("click", async () => {
  await loadShopHeader();
  showView(getRoute());
});
// WEEKDAYS helper — usado por el modal de horarios por barbero
const WEEKDAYS = [
  { i: 0, name: "Domingo" },
  { i: 1, name: "Lunes" },
  { i: 2, name: "Martes" },
  { i: 3, name: "Miércoles" },
  { i: 4, name: "Jueves" },
  { i: 5, name: "Viernes" },
  { i: 6, name: "Sábado" },
];

// ===============================
// BLOQUEOS / VACACIONES — BARBER-CENTRIC
// Se accede desde la tarjeta del barbero (botón "Bloqueos")
// ===============================
async function openBlockedTimesForBarber(barberId, barberName) {
  // Cargar bloqueos existentes
  let items = [];
  try {
    const data = await apiGet(`/blocked-times/${barberId}`);
    items = data.items || [];
  } catch (e) {
    console.error("Error cargando bloqueos:", e);
  }

  const listHtml = items.length
    ? items.map(b => {
        const range = b.dateTo ? `${b.dateFrom} → ${b.dateTo}` : b.dateFrom;
        const time = (b.startTime && b.endTime) ? ` • ${b.startTime}-${b.endTime}` : ` • Día completo`;
        const reason = b.reason ? ` • ${escapeHtml(b.reason)}` : "";
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;background:var(--surface);border-radius:6px;border:1px solid var(--border);margin-bottom:6px">
            <div><b>${range}</b>${time}${reason}</div>
            <button class="btn" data-del-block="${b.id}" style="flex-shrink:0">✕</button>
          </div>`;
      }).join("")
    : `<div class="muted">Sin bloqueos activos.</div>`;

  const res = await openModal({
    title: "Bloqueos de " + escapeHtml(barberName),
    subtitle: "Vacaciones, ausencias, franjas bloqueadas",
    bodyHtml: `
      <div id="blocksListModal" style="margin-bottom:16px">${listHtml}</div>
      <hr style="border-color:var(--border);margin:12px 0"/>
      <h4 style="margin:0 0 10px">Agregar nuevo bloqueo</h4>
      <label class="muted">Desde (fecha)</label>
      <input id="blkFrom" class="input" type="date" />
      <label class="muted" style="margin-top:8px;display:block">Hasta (opcional)</label>
      <input id="blkTo" class="input" type="date" />
      <div style="margin-top:8px" class="muted">Si no ponés horas, se bloquea el día completo.</div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <div style="flex:1">
          <label class="muted">Hora desde</label>
          <input id="blkStart" class="input" type="time" />
        </div>
        <div style="flex:1">
          <label class="muted">Hora hasta</label>
          <input id="blkEnd" class="input" type="time" />
        </div>
      </div>
      <label class="muted" style="margin-top:8px;display:block">Motivo (opcional)</label>
      <input id="blkReason" class="input" placeholder="Vacaciones / médico / etc." />
    `,
    okText: "Agregar bloqueo",
  });

  // Manejar borrado dentro del modal
  const listEl = document.getElementById("blocksListModal");
  if (listEl) {
    listEl.onclick = async (ev) => {
      const btn = ev.target.closest("[data-del-block]");
      if (!btn) return;
      const id = btn.dataset.delBlock;
      if (!confirm("¿Eliminar este bloqueo?")) return;
      try {
        await apiDelete(`/blocked-times/${barberId}/${id}`);
        closeModal(null);
        openBlockedTimesForBarber(barberId, barberName);
      } catch (err) { alert("Error: " + err.message); }
    };
  }

  if (!res?.ok) return;

  const dateFrom = document.getElementById("blkFrom")?.value;
  if (!dateFrom) { alert("La fecha 'Desde' es obligatoria."); return; }

  const dateTo = document.getElementById("blkTo")?.value || null;
  const startTime = document.getElementById("blkStart")?.value || null;
  const endTime = document.getElementById("blkEnd")?.value || null;
  const reason = document.getElementById("blkReason")?.value || null;

  try {
    await apiPost(`/blocked-times/${barberId}`, { dateFrom, dateTo, startTime, endTime, reason });
    alert("Bloqueo creado ✅");
  } catch (err) {
    alert("Error creando bloqueo: " + err.message);
  }
}

// ===============================
// 7. MÓDULO DE MIEMBROS
// ===============================
async function loadMembers() {
  const grid = $("membersGrid");
  if (!grid) return;
  
  if (!grid.children.length) renderGridSkeletons(grid, 3);
  try {
    const res = await apiGet("/members");
    const members = res.members || [];
    
    // Solo mostramos barberos activos
    const activeMembers = members.filter(m => m.isActive);
    
    if (!activeMembers.length) {
      grid.innerHTML = `<div class="empty">Todavía no agregaste a nadie a tu equipo.</div>`;
      return;
    }
    
    grid.innerHTML = activeMembers.map(m => {
      const avatarSrc = m.avatarBase64 || "https://ui-avatars.com/api/?name=" + encodeURIComponent(m.name) + "&background=1e293b&color=38bdf8";
      const servicesNames = m.services.map(s => s.name).join(", ") || "Sin servicios";
      return `
        <div class="card" style="display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${avatarSrc}" alt="${escapeAttr(m.name)}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid var(--border-h);" />
            <div>
              <h3 style="margin:0; display:flex; align-items:center; gap:8px;">
                ${escapeHtml(m.name)}
                ${m.mpStatus === 'CONNECTED' ? '<span title="Mercado Pago Conectado" style="font-size:12px;">✅</span>' : '<span title="Mercado Pago NO Conectado" style="font-size:12px;">⚠</span>'}
              </h3>
              <p class="muted" style="margin:4px 0 0; font-size:13px;">${escapeHtml(m.role)}</p>
            </div>
          </div>
          <div>
            <p style="font-size:13px; margin:0"><b>Servicios:</b> <span class="muted">${escapeHtml(servicesNames)}</span></p>
          </div>
          <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
            ${m.mpStatus !== 'CONNECTED' ? `
              <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); padding: 8px; border-radius: 6px; font-size: 12px; color: #fca5a5; text-align: center;">
                <b>Mercado Pago no conectado.</b><br>Las reservas de este profesional quedarán pendientes y no cobrará seña online.
              </div>
            ` : ''}
            <div style="display:flex; gap:8px; flex-wrap:wrap">
              <button class="btn" data-mp-member="${m.id}" style="flex:1; border-color:#009ee3; color:#009ee3; background:rgba(0,158,227,0.1)">
                ${m.mpStatus === 'CONNECTED' ? 'Reconectar MP' : 'Conectar MP'}
              </button>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap">
              <button class="btn" data-edit-member="${m.id}" style="flex:1">Editar</button>
              <button class="btn" data-schedule-member="${m.id}" style="flex:1; background:var(--surface);">Horarios</button>
              <button class="btn" data-blocks-member="${m.id}" data-blocks-name="${escapeAttr(m.name)}" style="flex:1; background:var(--surface);">Bloqueos</button>
              <button class="icon-btn" data-del-member="${m.id}" style="color:#ef4444" title="Desactivar">✕</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
    
    window._cachedMembers = members;
  } catch (err) {
    grid.innerHTML = `<div class="muted">Error: ${escapeHtml(err.message)}</div>`;
  }
}

// Convert File to WebP Base64 (max 150x150)
function compressImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 150;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; }
        } else {
          if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/webp", 0.8));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

$("btnNewMember")?.addEventListener("click", async () => {
  let services = [];
  try {
    const sRes = await apiGet("/services/mine");
    services = sRes.items || sRes || [];
  } catch(e) {}
  
  const servicesHtml = services.map(s => `
    <label style="display:flex; align-items:center; gap:8px; font-size:14px;">
      <input type="checkbox" name="memServices" value="${s.id}" checked />
      <span>${escapeHtml(s.name)}</span>
    </label>
  `).join("");

  const res = await openModal({
    title: "Nuevo Miembro",
    subtitle: "Agregá un profesional a tu equipo",
    bodyHtml: `
      <div style="display:flex; gap:16px; align-items:center; margin-bottom:16px;">
        <div id="avatarPreview" style="width:70px; height:70px; border-radius:50%; background:var(--surface); border:2px dashed var(--border); display:flex; align-items:center; justify-content:center; overflow:hidden;">
          <span class="muted" style="font-size:12px;">Foto</span>
        </div>
        <div style="flex:1">
          <label class="label">Foto de perfil (opcional)</label>
          <input type="file" id="memFile" accept="image/*" class="input" style="padding:6px; font-size:12px;" />
        </div>
      </div>
      <label class="label">Nombre</label>
      <input id="memName" class="input" placeholder="Ej: Carlos" />
      <label class="label">Rol / Especialidad</label>
      <input id="memRole" class="input" placeholder="Ej: Barbero Senior" value="Barbero" />
      <label class="label" style="margin-top:16px;">Servicios asignados</label>
      <div style="display:flex; flex-direction:column; gap:6px; background:var(--surface); padding:10px; border-radius:8px; border:1px solid var(--border);">
        ${servicesHtml || '<span class="muted" style="font-size:13px">Creá servicios primero.</span>'}
      </div>
    `,
    okText: "Guardar",
  });
  
  if (!res?.ok) return;
  
  const name = $("memName")?.value || "";
  if (!name.trim()) {
    alert("El nombre es obligatorio.");
    return;
  }
  const role = $("memRole")?.value || "";
  const fileInput = $("memFile");
  
  let avatarBase64 = null;
  if (fileInput && fileInput.files && fileInput.files[0]) {
    try { avatarBase64 = await compressImageToBase64(fileInput.files[0]); } catch (err) {}
  }
  
  const servicesIds = Array.from(document.querySelectorAll('input[name="memServices"]:checked')).map(el => el.value);
  
  try {
    await apiPost("/members", { name, role, avatarBase64, servicesIds });
    await loadMembers();
  } catch (err) { alert("Error: " + err.message); }
});

document.addEventListener("change", async (e) => {
  if (e.target.id === "memFile" && e.target.files?.length) {
    const preview = $("avatarPreview");
    if (preview) {
      try {
        const b64 = await compressImageToBase64(e.target.files[0]);
        preview.innerHTML = `<img src="${b64}" style="width:100%; height:100%; object-fit:cover;" />`;
        preview.style.border = "2px solid var(--cyan)";
      } catch (err) {}
    }
  }
});

$("membersGrid")?.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit-member]");
  const delBtn = e.target.closest("[data-del-member]");
  const schBtn = e.target.closest("[data-schedule-member]");
  const blkBtn = e.target.closest("[data-blocks-member]");
  const mpBtn = e.target.closest("[data-mp-member]");
  
  if (mpBtn) {
    const id = mpBtn.dataset.mpMember;
    const m = (window._cachedMembers || []).find(x => String(x.id) === id);
    if (!m) return;
    
    if (m.mpStatus === "CONNECTED") {
      if (!confirm("Este barbero ya tiene Mercado Pago asociado. ¿Querés reconectarlo?")) return;
    }
    // Redirigimos al endpoint de OAuth, asegurándonos de usar la base correcta (API dev/prod)
    window.location.href = `${API}/payments/oauth/authorize?barberId=${id}`;
    return;
  }

  if (blkBtn) {
    const id = blkBtn.dataset.blocksMember;
    const name = blkBtn.dataset.blocksName || "Barbero";
    await openBlockedTimesForBarber(Number(id), name);
    return;
  }
  
  if (delBtn) {
    const id = delBtn.dataset.delMember;
    if (!confirm("¿Desactivar barbero? Ya no recibirá turnos nuevos.")) return;
    try {
      await apiDelete("/members/" + id);
      await loadMembers();
    } catch (err) { alert("Error: " + err.message); }
    return;
  }
  
  if (editBtn) {
    const id = editBtn.dataset.editMember;
    const m = (window._cachedMembers || []).find(x => String(x.id) === id);
    if (!m) return;
    
    let services = [];
    try { const sRes = await apiGet("/services/mine"); services = sRes.items || sRes || []; } catch(err) {}
    const mServiceIds = m.services.map(s => Number(s.id));
    
    const servicesHtml = services.map(s => `
      <label style="display:flex; align-items:center; gap:8px; font-size:14px;">
        <input type="checkbox" name="memServices" value="${s.id}" ${mServiceIds.includes(s.id) ? "checked" : ""} />
        <span>${escapeHtml(s.name)}</span>
      </label>
    `).join("");

    const currentImg = m.avatarBase64 ? `<img src="${m.avatarBase64}" style="width:100%; height:100%; object-fit:cover;" />` : `<span class="muted" style="font-size:12px;">Foto</span>`;
    
    const res = await openModal({
      title: "Editar Miembro",
      subtitle: escapeHtml(m.name),
      bodyHtml: `
        <div style="display:flex; gap:16px; align-items:center; margin-bottom:16px;">
          <div id="avatarPreview" style="width:70px; height:70px; border-radius:50%; background:var(--surface); border:2px dashed var(--border); display:flex; align-items:center; justify-content:center; overflow:hidden;">
            ${currentImg}
          </div>
          <div style="flex:1">
            <label class="label">Reemplazar Foto</label>
            <input type="file" id="memFile" accept="image/*" class="input" style="padding:6px; font-size:12px;" />
          </div>
        </div>
        <label class="label">Nombre</label>
        <input id="memName" class="input" value="${escapeAttr(m.name)}" />
        <label class="label">Rol / Especialidad</label>
        <input id="memRole" class="input" value="${escapeAttr(m.role)}" />
        <label class="label" style="margin-top:16px;">Servicios</label>
        <div style="display:flex; flex-direction:column; gap:6px; background:var(--surface); padding:10px; border-radius:8px; border:1px solid var(--border);">
          ${servicesHtml}
        </div>
      `,
      okText: "Guardar",
    });
    
    if (!res?.ok) return;
    
    const name = $("memName")?.value || "";
    if (!name.trim()) {
      alert("El nombre es obligatorio.");
      return;
    }
    const role = $("memRole")?.value || "";
    let avatarBase64 = undefined;
    const fileInput = $("memFile");
    if (fileInput && fileInput.files && fileInput.files[0]) {
      try { avatarBase64 = await compressImageToBase64(fileInput.files[0]); } catch (err) {}
    }
    const servicesIds = Array.from(document.querySelectorAll('input[name="memServices"]:checked')).map(el => el.value);
    
    try {
      await apiPut("/members/" + id, { name, role, avatarBase64, servicesIds });
      await loadMembers();
    } catch (err) { alert("Error: " + err.message); }
    return;
  }
  
  if (schBtn) {
    const id = schBtn.dataset.scheduleMember;
    const m = (window._cachedMembers || []).find(x => String(x.id) === id);
    if (!m) return;
    
    // Preparar estructura de franjas agrupadas por día
    const currentSchedule = {};
    WEEKDAYS.forEach(d => currentSchedule[d.i] = []);
    m.workingHours.forEach(wh => {
      if (!currentSchedule[wh.weekday]) currentSchedule[wh.weekday] = [];
      currentSchedule[wh.weekday].push({ s: wh.startTime, e: wh.endTime });
    });

    // Renderizar HTML dinámico permitiendo múltiples franjas por día
    const daysHtml = WEEKDAYS.map(d => {
      let slots = currentSchedule[d.i];
      if (slots.length === 0) slots = []; // Cerrado por defecto
      
      const slotsHtml = slots.map((sl, idx) => `
        <div class="franja-row" data-day="${d.i}" style="display:flex; gap:8px; align-items:center; margin-top:6px;">
          <input type="time" class="input franja-start" value="${sl.s}" style="padding:4px 8px; font-size:13px;" required />
          <span class="muted">a</span>
          <input type="time" class="input franja-end" value="${sl.e}" style="padding:4px 8px; font-size:13px;" required />
          <button class="icon-btn remove-franja" type="button" style="color:var(--danger);" title="Quitar franja">✕</button>
        </div>
      `).join("");

      return `
        <div class="day-card" data-day="${d.i}" style="margin-bottom:12px; background:var(--surface); padding:10px; border-radius:8px; border:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-h); padding-bottom:8px; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
               <label style="font-weight:600; font-size:14px;">${d.name}</label>
            </div>
            <button class="btn btn-sm add-franja" data-add="${d.i}" type="button">+ Agregar franja</button>
          </div>
          <div class="franjas-container" id="franjas_${d.i}">
            ${slots.length > 0 ? slotsHtml : `<div class="muted empty-franja" style="font-size:13px; font-style:italic;">Día cerrado (Sin franjas)</div>`}
          </div>
        </div>
      `;
    }).join("");
    
    // Template de nueva franja
    const newFranjaTemplate = (day) => `
      <div class="franja-row" data-day="${day}" style="display:flex; gap:8px; align-items:center; margin-top:6px;">
        <input type="time" class="input franja-start" value="09:00" style="padding:4px 8px; font-size:13px;" required />
        <span class="muted">a</span>
        <input type="time" class="input franja-end" value="13:00" style="padding:4px 8px; font-size:13px;" required />
        <button class="icon-btn remove-franja" type="button" style="color:var(--danger);" title="Quitar franja">✕</button>
      </div>
    `;

    const res = await openModal({
      title: "Horarios por Franja",
      subtitle: escapeHtml(m.name),
      bodyHtml: `<div id="scheduleMatrix" style="max-height:60vh; overflow-y:auto; padding-right:8px; margin-bottom:16px;">${daysHtml}</div>`,
      okText: "Guardar Horarios"
    });

    // Mapeo dinámico de botones + / x mientras el modal está abierto (Hack con delegación al document ya manejado o inyectado acá)
    
    if (!res?.ok) return;
    
    const schedule = [];
    document.querySelectorAll(".day-card").forEach(card => {
       const day = card.dataset.day;
       const franjas = card.querySelectorAll(".franja-row");
       franjas.forEach(f => {
         const s = f.querySelector(".franja-start").value;
         const e = f.querySelector(".franja-end").value;
         if (s && e) schedule.push({ weekday: Number(day), startTime: s, endTime: e });
       });
    });
    
    try {
      await apiPut("/members/" + id + "/schedule", { schedule });
      await loadMembers();
      alert("Horarios multi-franja guardados ✅");
    } catch(err) { alert("Error guardando horario: " + err.message); }
  }
});
document.addEventListener("change", (e) => {
  if (e.target.classList.contains("day-check")) {
    const d = e.target.dataset.day;
    const startObj = $("start_" + d);
    const endObj = $("end_" + d);
    if (startObj) startObj.disabled = !e.target.checked;
    if (endObj) endObj.disabled = !e.target.checked;
  }
});

// Eventos multi-franja en modal de Barbero
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("add-franja")) {
    const day = e.target.dataset.add;
    const container = document.getElementById("franjas_" + day);
    if (!container) return;

    // Remove empty state message if it exists
    const emptyMsg = container.querySelector(".empty-franja");
    if (emptyMsg) emptyMsg.remove();

    const div = document.createElement("div");
    div.className = "franja-row";
    div.dataset.day = day;
    div.style.cssText = "display:flex; gap:8px; align-items:center; margin-top:6px;";
    div.innerHTML = `
      <input type="time" class="input franja-start" value="09:00" style="padding:4px 8px; font-size:13px;" required />
      <span class="muted">a</span>
      <input type="time" class="input franja-end" value="13:00" style="padding:4px 8px; font-size:13px;" required />
      <button class="icon-btn remove-franja" type="button" style="color:var(--danger);" title="Quitar franja">✕</button>
    `;
    container.appendChild(div);
  }

  if (e.target.classList.contains("remove-franja")) {
    const row = e.target.closest(".franja-row");
    if (!row) return;
    
    const container = row.parentElement;
    const day = row.dataset.day;
    row.remove();

    // Re-insert empty message if no franjas are left
    if (container && container.querySelectorAll(".franja-row").length === 0) {
      container.innerHTML = `<div class="muted empty-franja" style="font-size:13px; font-style:italic;">Día cerrado (Sin franjas)</div>`;
    }
  }
});

// init
(async function init() {
  if (!getToken()) openLogin();

  await loadShopHeader();
  showView(getRoute());
})();
