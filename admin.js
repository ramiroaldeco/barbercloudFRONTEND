// admin.js
// ❌ NO definir API_BASE acá (viene de config.js, que ya incluye /api)

const $ = (id) => document.getElementById(id);

const loginBox = $("loginBox");
const settingsBox = $("settingsBox");

const email = $("email");
const password = $("password");
const btnLogin = $("btnLogin");
const loginMsg = $("loginMsg");

const bsName = $("bsName");
const bsCity = $("bsCity");

const publicLinkInput = $("publicLink");
const copyLinkBtn = $("copyLink");

const depositRange = $("depositRange");
const depositLabel = $("depositLabel");
const platformFee = $("platformFee");
const btnSave = $("btnSave");
const saveMsg = $("saveMsg");
const btnLogout = $("btnLogout");

function setMsg(el, text, ok = true) {
  el.textContent = text || "";
  el.className = ok ? "muted ok" : "muted bad";
}

function getToken() {
  return localStorage.getItem("bc_token") || "";
}

function setToken(t) {
  localStorage.setItem("bc_token", t);
}

function clearToken() {
  localStorage.removeItem("bc_token");
  localStorage.removeItem("barbershopId");
}

depositRange.addEventListener("input", () => {
  depositLabel.textContent = `${depositRange.value}%`;
});

async function api(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  // Seteamos JSON solo si no te pasaron ya otro content-type
  if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// arma y muestra el link público book.html?shop=ID
function setPublicLink(barbershopId) {
  if (!publicLinkInput || !barbershopId) return;

  // base = carpeta actual (GitHub Pages / Vercel / etc.)
  const base = window.location.href.replace(/admin\.html.*$/, "");
  const link = `${base}book.html?shop=${barbershopId}`;
  publicLinkInput.value = link;

  if (copyLinkBtn) {
    copyLinkBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(link);
        copyLinkBtn.textContent = "Copiado ✅";
        setTimeout(() => (copyLinkBtn.textContent = "Copiar link"), 1200);
      } catch {
        publicLinkInput.select();
        document.execCommand("copy");
      }
    };
  }
}

async function loadSettings() {
  // ✅ OJO: sin /api acá porque API_BASE ya lo tiene incluido
  const bs = await api("/barbershops/mine");

  localStorage.setItem("barbershopId", String(bs.id));

  bsName.textContent = bs.name || "";
  bsCity.textContent = bs.city || "";

  depositRange.value = bs.defaultDepositPercentage ?? 15;
  depositLabel.textContent = `${depositRange.value}%`;
  platformFee.value = bs.platformFee ?? 200;

  setPublicLink(bs.id);

  loginBox.style.display = "none";
  settingsBox.style.display = "block";
  setMsg(saveMsg, "Cargado ✅", true);
}

btnLogin.addEventListener("click", async () => {
  try {
    setMsg(loginMsg, "Ingresando...", true);

    // ✅ sin /api
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: email.value.trim(),
        password: password.value,
      }),
    });

    setToken(data.token);

    setMsg(loginMsg, "OK ✅", true);
    await loadSettings();
  } catch (e) {
    setMsg(loginMsg, e.message, false);
  }
});

btnSave.addEventListener("click", async () => {
  try {
    setMsg(saveMsg, "Guardando...", true);

    const body = {
      defaultDepositPercentage: Number(depositRange.value),
      platformFee: Number(platformFee.value),
    };

    // ✅ sin /api
    await api("/barbershops/mine/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    });

    setMsg(saveMsg, "Guardado ✅", true);
  } catch (e) {
    setMsg(saveMsg, e.message, false);
  }
});

btnLogout.addEventListener("click", () => {
  clearToken();
  settingsBox.style.display = "none";
  loginBox.style.display = "block";
  setMsg(loginMsg, "Sesión cerrada.", true);
});

// Auto-load si ya hay token guardado
(async function init() {
  if (getToken()) {
    try {
      await loadSettings();
    } catch (e) {
      clearToken();
      // opcional: mostrar error amigable
      setMsg(loginMsg, "Tu sesión venció. Iniciá sesión de nuevo.", false);
    }
  }
})();
