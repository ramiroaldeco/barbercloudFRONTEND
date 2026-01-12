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
  // compat (por si alguna parte usa "token")
  localStorage.setItem("token", t);
}
function clearToken() {
  for (const k of TOKEN_KEYS) localStorage.removeItem(k);
}

// ---- routing ----
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

// ---- API helpers ----
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${API}${path}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(await safeText(res));
  return res.json();
}

async function safeText(res) {
  try { return await res.text(); } catch { return "Error"; }
}

// ---- toast (simple, pro, sin romper CSS) ----
function ensureToastHost() {
  let host = document.getElementById("toastHost");
  if (host) return host;

  host = document.createElement("div");
  host.id = "toastHost";
  host.style.position = "fixed";
  host.style.right = "16px";
  host.style.bottom = "16px";
  host.style.display = "grid";
  host.style.gap = "10px";
  host.style.zIndex = "9999";
  document.body.appendChild(host);
  return host;
}

function toast(text, type = "info") {
  const host = ensureToastHost();

  const t = document.createElement("div");
  t.style.padding = "10px 12px";
  t.style.borderRadius = "14px";
  t.style.border = "1px solid rgba(255,255,255,.10)";
  t.style.background = "rgba(10,14,20,.92)";
  t.style.color = "rgba(232,238,252,.95)";
  t.style.boxShadow = "0 12px 30px rgba(0,0,0,.35)";
  t.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
  t.style.fontSize = "14px";
  t.style.display = "flex";
  t.style.gap = "10px";
  t.style.alignItems = "center";
  t.style.maxWidth = "360px";

  const dot = document.createElement("span");
  dot.textContent = "●";
  dot.style.fontSize = "12px";

  if (type === "ok") dot.style.color = "rgba(39,209,124,.95)";
  else if (type === "error") dot.style.color = "rgba(255,95,109,.95)";
  else if (type === "warn") dot.style.color = "rgba(255,204,102,.95)";
  else dot.style.color = "rgba(47,123,255,.95)";

  const msg = document.createElement("div");
  msg.textContent = text;

  t.appendChild(dot);
  t.appendChild(msg);

  host.appendChild(t);

  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(6px)";
    t.style.transition = "opacity .18s ease, transform .18s ease";
  }, 2200);

  setTimeout(() => {
    t.remove();
  }, 2500);
}

// ---- debounce ----
function debounce(fn, ms = 400) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---- modal ----
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalSubtitle = document.getElementById("modalSubtitle");
const modalBody = document.getElementById("modalBody");
const btnModalClose = document.getElementById("btnModalClose");
const btnModalCancel = document.getElementById("btnModalCancel");
const btnModalOk = document.getElementById("btnModalOk");

let modalResolve = null;
function openModal({ title, subtitle = "", bodyHtml, okText = "Guardar" }) {
  modalTitle.textContent = title;
  modalSubtitle.textContent = subtitle;
  modalBody.innerHTML = bodyHtml;
  btnModalOk.textContent = okText;
  modalBackdrop.style.display = "grid";

  return new Promise((resolve) => {
    modalResolve = resolve;
  });
}
function closeModal(result = null) {
  modalBackdrop.style.display = "none";
  modalBody.innerHTML = "";
  if (modalResolve) modalResolve(result);
  modalResolve = null;
}
btnModalClose.addEventListener("click", () => closeModal(null));
btnModalCancel.addEventListener("click", () => closeModal(null));
btnModalOk.addEventListener("click", () => closeModal({ ok: true }));

// ---- login ----
const loginBackdrop = document.getElementById("loginBackdrop");
const btnOpenLogin = document.getElementById("btnOpenLogin");
const btnLogin = document.getElementById("btnLogin");
const btnLoginClose = document.getElementById("btnLoginClose");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");

function openLogin() {
  loginError.style.display = "none";
  loginBackdrop.style.display = "grid";
}
function closeLogin() {
  loginBackdrop.style.display = "none";
}
btnOpenLogin.addEventListener("click", openLogin);
btnLoginClose.addEventListener("click", closeLogin);

btnLogin.addEventListener("click", async () => {
  try {
    loginError.style.display = "none";
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
      loginError.textContent = "Completá email y contraseña.";
      loginError.style.display = "block";
      return;
    }

    const data = await apiPost("/auth/login", { email, password });
    if (!data.token) throw new Error("No recibí token");

    setToken(data.token);
    closeLogin();
    toast("Login OK ✅", "ok");
    await loadShopHeader();
    showView(getRoute());
  } catch (e) {
    loginError.textContent = "Error: " + e.message;
    loginError.style.display = "block";
  }
});

document.getElementById("btnLogout").addEventListener("click", () => {
  clearToken();
  toast("Sesión cerrada", "info");
  openLogin();
});

// ---- shop header ----
async function loadShopHeader() {
  try {
    const data = await apiGet("/barbershops/mine");

    document.getElementById("shopName").textContent = data.name || "BarberCloud";
    document.getElementById("shopCity").textContent = data.city || "Admin";
    document.getElementById("shopAvatar").textContent = (data.name || "B").trim().charAt(0).toUpperCase();

    const filled = ["name", "city", "address", "phone", "slug"].filter(k => data[k]).length;
    const pct = Math.round((filled / 5) * 100);
    document.getElementById("setupPct").textContent = `${pct}%`;
    document.getElementById("setupBar").style.width = `${pct}%`;
  } catch (e) {
    console.warn("No pude cargar barbería (mine):", e.message);
  }
}

// ---- Agenda ----
function setDefaultDateRangeIfEmpty() {
  const fromEl = document.getElementById("fromDate");
  const toEl = document.getElementById("toDate");
  if (!fromEl || !toEl) return;

  const from = fromEl.value;
  const to = toEl.value;

  if (from || to) return;

  const today = new Date();
  const plus7 = new Date();
  plus7.setDate(today.getDate() + 7);

  const fmt = (d) => d.toISOString().slice(0, 10);

  fromEl.value = fmt(today);
  toEl.value = fmt(plus7);
}

async function loadAppointments() {
  const tbody = document.querySelector("#appointmentsTable tbody");
  const empty = document.getElementById("appointmentsEmpty");

  // ✅ rango por defecto estilo Agendito
  setDefaultDateRangeIfEmpty();

  const q = document.getElementById("qAppointments").value.trim();
  const status = document.getElementById("statusFilter").value;
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;

  tbody.innerHTML = "";
  empty.style.display = "none";

  try {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    if (q) params.set("q", q);

    const data = await apiGet(`/appointments?${params.toString()}`);
    const items = data.items || data || [];

    if (!items.length) {
      empty.style.display = "block";
      empty.textContent = "No tenés turnos para este rango.";
      return;
    }

    for (const a of items) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(a.date || "")}</td>
        <td>${escapeHtml(a.time || "")}</td>
        <td>${escapeHtml(a.service?.name || "")}</td>
        <td>${escapeHtml(a.customerName || "")}</td>
        <td>${escapeHtml(a.customerPhone || "")}</td>
        <td>${statusBadge(a.status)}</td>
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

// ✅ filtros reactivos (sin romper tu botón)
const debouncedReloadAppointments = debounce(loadAppointments, 500);
document.getElementById("qAppointments").addEventListener("input", debouncedReloadAppointments);
document.getElementById("statusFilter").addEventListener("change", loadAppointments);
document.getElementById("fromDate").addEventListener("change", loadAppointments);
document.getElementById("toDate").addEventListener("change", loadAppointments);

document.querySelector("#appointmentsTable").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  const act = btn.dataset.act;
  if (!id || !act) return;

  try {
    if (act === "confirm") {
      await apiPut(`/appointments/${id}/status`, { status: "confirmed" });
      toast("Turno confirmado ✅", "ok");
    }
    if (act === "cancel") {
      await apiPut(`/appointments/${id}/status`, { status: "canceled" });
      toast("Turno cancelado", "warn");
    }
    await loadAppointments();
  } catch (err) {
    toast("Error: " + err.message, "error");
  }
});

// ---- Servicios ----
async function loadServices() {
  const grid = document.getElementById("servicesGrid");
  grid.innerHTML = "";

  try {
    const data = await apiGet("/services/mine");
    const items = data.items || data || [];

    if (!items.length) {
      grid.innerHTML = `<div class="muted">Todavía no tenés servicios. Creá el primero.</div>`;
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

document.getElementById("btnNewService").addEventListener("click", async () => {
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
    const name = document.getElementById("srvName").value.trim();
    const price = Number(document.getElementById("srvPrice").value);
    const durationMinutes = Number(document.getElementById("srvDur").value || 30);
    const depRaw = document.getElementById("srvDep").value;
    const depositPercentage = depRaw === "" ? null : Number(depRaw);
    const description = document.getElementById("srvDesc").value.trim();

    if (!name || Number.isNaN(price)) throw new Error("Nombre y precio son obligatorios");

    await apiPost("/services", {
      name,
      price,
      durationMinutes,
      depositPercentage,
      description: description || null,
    });

    closeModal();
    toast("Servicio creado ✅", "ok");
    await loadServices();
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
});

document.getElementById("servicesGrid").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const editId = btn.dataset.edit;
  const delId = btn.dataset.del;

  if (delId) {
    if (!confirm("¿Seguro que querés borrar este servicio?")) return;
    try {
      await apiDelete(`/services/${delId}`);
      toast("Servicio borrado", "warn");
      await loadServices();
    } catch (err) {
      toast("Error: " + err.message, "error");
    }
  }

  if (editId) {
    try {
      const services = await apiGet("/services/mine");
      const items = services.items || services || [];
      const s = items.find(x => x.id === editId);
      if (!s) return toast("No encontré el servicio", "error");

      const result = await openModal({
        title: "Editar servicio",
        subtitle: "Actualizá precio, duración o seña",
        bodyHtml: `
          <label class="label">Nombre</label>
          <input class="input" id="srvName" value="${escapeAttr(s.name)}" />
          <label class="label">Precio</label>
          <input class="input" id="srvPrice" type="number" value="${escapeAttr(String(s.price))}" />
          <label class="label">Duración (min)</label>
          <input class="input" id="srvDur" type="number" value="${escapeAttr(String(s.durationMinutes || 30))}" />
          <label class="label">Seña (%) (vacío = usa por defecto)</label>
          <input class="input" id="srvDep" type="number" value="${s.depositPercentage == null ? "" : escapeAttr(String(s.depositPercentage))}" />
          <label class="label">Descripción (opcional)</label>
          <input class="input" id="srvDesc" value="${s.description ? escapeAttr(String(s.description)) : ""}" />
        `,
        okText: "Guardar",
      });

      if (!result?.ok) return;

      const name = document.getElementById("srvName").value.trim();
      const price = Number(document.getElementById("srvPrice").value);
      const durationMinutes = Number(document.getElementById("srvDur").value || 30);
      const depRaw = document.getElementById("srvDep").value;
      const depositPercentage = depRaw === "" ? null : Number(depRaw);
      const description = document.getElementById("srvDesc").value.trim();

      await apiPut(`/services/${editId}`, {
        name,
        price,
        durationMinutes,
        depositPercentage,
        description: description || null,
      });

      closeModal();
      toast("Servicio guardado ✅", "ok");
      await loadServices();
    } catch (err) {
      toast("Error: " + err.message, "error");
    }
  }
});

// ---- Config ----
async function loadConfig() {
  try {
    const shop = await apiGet("/barbershops/mine");
    document.getElementById("cfgName").value = shop.name || "";
    document.getElementById("cfgCity").value = shop.city || "";
    document.getElementById("cfgAddress").value = shop.address || "";
    document.getElementById("cfgPhone").value = shop.phone || "";
    document.getElementById("cfgSlug").value = shop.slug || "";
    document.getElementById("cfgDepositPct").value =
      (shop.defaultDepositPercentage != null ? String(shop.defaultDepositPercentage) : "");
  } catch (e) {
    console.warn(e.message);
  }
}

document.getElementById("btnSaveConfig").addEventListener("click", async () => {
  try {
    const name = document.getElementById("cfgName").value.trim();
    const city = document.getElementById("cfgCity").value.trim();
    const address = document.getElementById("cfgAddress").value.trim();
    const phone = document.getElementById("cfgPhone").value.trim();
    const slug = document.getElementById("cfgSlug").value.trim();
    const pct = Number(document.getElementById("cfgDepositPct").value);

    // 1) datos generales
    await apiPut("/barbershops/mine", {
      name,
      city: city || null,
      address: address || null,
      phone: phone || null,
      slug: slug || null,
    });

    // 2) seña por defecto
    if (!Number.isNaN(pct)) {
      await apiPut("/barbershops/mine/settings", { defaultDepositPercentage: pct });
    }

    await loadShopHeader();
    toast("Guardado ✅", "ok");
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
});

// ---- utils ----
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[s]));
}
function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// botones top
document.getElementById("btnReload").addEventListener("click", async () => {
  await loadShopHeader();
  showView(getRoute());
});

// init
(async function init(){
  // si no hay token, abrimos login
  if (!getToken()) openLogin();

  await loadShopHeader();
  showView(getRoute());
})();
