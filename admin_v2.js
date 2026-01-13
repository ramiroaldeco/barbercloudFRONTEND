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

// ---- routing ----
const views = {
  agenda: $("view-agenda"),
  clientes: $("view-clientes"),
  servicios: $("view-servicios"),
  horarios: $("view-horarios"),
  config: $("view-config"),
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
  if (route === "horarios") {
    if (pageTitle) pageTitle.textContent = "Plantilla Horaria";
    if (pageSubtitle) pageSubtitle.textContent = "Horarios semanales";
  }
  if (route === "config") {
    if (pageTitle) pageTitle.textContent = "Configuración";
    if (pageSubtitle) pageSubtitle.textContent = "Datos de tu barbería";
    loadConfig();
  }
  if (route === "clientes") {
    if (pageTitle) pageTitle.textContent = "Clientes";
    if (pageSubtitle) pageSubtitle.textContent = "Historial y búsqueda";
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
    await loadShopHeader();
    showView(getRoute());
  } catch (e) {
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
    const avatar = (data.name || "B").trim().charAt(0).toUpperCase();
    safeText("shopAvatar", avatar);

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
function statusBadge(status) {
  if (status === "confirmed") return `<span class="badge good">● Confirmado</span>`;
  if (status === "canceled") return `<span class="badge bad">● Cancelado</span>`;
  return `<span class="badge warn">● Pendiente</span>`;
}

async function loadAppointments() {
  const tbody = document.querySelector("#appointmentsTable tbody");
  const empty = $("appointmentsEmpty");

  // ✅ NO explota si falta algún input en tu HTML
  const q = (safeVal("qAppointments", "") || "").trim();
  const status = safeVal("statusFilter", "");
  const from = safeVal("fromDate", "");
  const to = safeVal("toDate", "");

  if (tbody) tbody.innerHTML = "";
  if (empty) empty.style.display = "none";

  try {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    if (q) params.set("q", q);

    const data = await apiGet(`/appointments?${params.toString()}`);
    const items = data.items || data || [];

    if (!items.length) {
      if (empty) {
        empty.style.display = "block";
        empty.textContent = "No tenés turnos para este rango.";
      }
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
      tbody?.appendChild(tr);
    }
  } catch (e) {
    if (empty) {
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
    if (act === "confirm") await apiPut(`/appointments/${id}/status`, { status: "confirmed" });
    if (act === "cancel") await apiPut(`/appointments/${id}/status`, { status: "canceled" });
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
    // 1) pedir lista de servicios (del dueño)
    const resp = await apiGet("/services/mine");
    const services = resp.items || resp || [];

    if (!services.length) {
      alert("Primero creá al menos 1 servicio en la sección 'Servicios'.");
      location.hash = "#/servicios";
      return;
    }

    const optionsHtml = services
      .map(
        (s) =>
          `<option value="${s.id}">${escapeHtml(s.name)} ($${escapeHtml(String(s.price))})</option>`
      )
      .join("");

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const result = await openModal({
      title: "Nuevo turno",
      subtitle: "Cargá cliente, fecha y servicio",
      bodyHtml: `
        <label class="label">Fecha</label>
        <input class="input" id="apptDate" type="date" value="${todayStr}" />

        <label class="label">Hora</label>
        <input class="input" id="apptTime" type="time" value="10:00" />

        <label class="label">Servicio</label>
        <select class="input" id="apptService">
          ${optionsHtml}
        </select>

        <label class="label">Cliente</label>
        <input class="input" id="apptName" placeholder="Nombre y apellido" />

        <label class="label">Teléfono</label>
        <input class="input" id="apptPhone" placeholder="3534..." />
      `,
      okText: "Crear turno",
    });

    if (!result?.ok) return;

    // 2) leer valores (safeVal valida existencia del input)
    const date = String(safeVal("apptDate", "")).trim();
    const time = String(safeVal("apptTime", "")).trim();
    const serviceIdRaw = safeVal("apptService", "");
    const serviceId = Number(serviceIdRaw);
    const customerName = String(safeVal("apptName", "")).trim();
    const customerPhone = String(safeVal("apptPhone", "")).trim();

    if (!date || !time || !serviceIdRaw || Number.isNaN(serviceId)) {
      alert("Completá fecha, hora y servicio.");
      return;
    }
    if (!customerName) {
      alert("Completá el nombre del cliente.");
      return;
    }

    // 3) crear turno desde el admin (dueño) ✅ /appointments/owner
    await apiPost("/appointments/owner", {
      serviceId,
      date,
      time,
      customerName,
      customerPhone: customerPhone || null,
      status: "pending",
    });

    await loadAppointments();
    alert("Turno creado ✅");
  } catch (e) {
    alert("Error creando turno: " + e.message);
  }
}

// ✅ Enganche pedido: un único addEventListener por ID
(function bindQuickAddOnce() {
  const btn = document.getElementById("btnQuickAdd");
  if (!btn) return;
  // evita duplicar listeners si el script se carga 2 veces
  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", openAddTurnModal);
})();

// ---- Servicios ----
async function loadServices() {
  const grid = $("servicesGrid");
  if (!grid) return;
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
  } catch (e) {
    console.warn(e.message);
  }
}

$("btnSaveConfig")?.addEventListener("click", async () => {
  try {
    const name = safeVal("cfgName", "").trim();
    const city = safeVal("cfgCity", "").trim();
    const address = safeVal("cfgAddress", "").trim();
    const phone = safeVal("cfgPhone", "").trim();
    const slug = safeVal("cfgSlug", "").trim();
    const pctRaw = safeVal("cfgDepositPct", "").trim();
    const pct = pctRaw === "" ? NaN : Number(pctRaw);

    await apiPut("/barbershops/mine", {
      name,
      city: city || null,
      address: address || null,
      phone: phone || null,
      slug: slug || null,
    });

    if (!Number.isNaN(pct)) {
      await apiPut("/barbershops/mine/settings", { defaultDepositPercentage: pct });
    }

    await loadShopHeader();
    alert("Guardado ✅");
  } catch (e) {
    alert("Error: " + e.message);
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

// botones top
$("btnReload")?.addEventListener("click", async () => {
  await loadShopHeader();
  showView(getRoute());
});

// init
(async function init() {
  if (!getToken()) openLogin();

  await loadShopHeader();
  showView(getRoute());
})();
