// book.js
// ❌ NO definir API_BASE acá (viene de config.js, que ya incluye /api)

const qs = new URLSearchParams(window.location.search);
const barbershopId = Number(qs.get("shop"));

const shopTitle = document.getElementById("shopTitle");
const shopSub = document.getElementById("shopSub");
const shopInfo = document.getElementById("shopInfo");
const err = document.getElementById("err");

const serviceSelect = document.getElementById("serviceSelect");
const form = document.getElementById("form");
const btn = document.getElementById("btn");
const pricingBox = document.getElementById("pricingBox");

function setErr(msg) {
  err.textContent = msg || "";
}

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR");
}

async function loadBarbershop() {
  if (!barbershopId || Number.isNaN(barbershopId)) {
    setErr("Falta el parámetro ?shop=ID en la URL. Ej: book.html?shop=1");
    shopTitle.textContent = "Barbería no encontrada";
    return null;
  }

  // Como quizá no tengas GET /barbershops/:id, levantamos la lista y filtramos.
  const r = await fetch(`${API_BASE}/barbershops`);
  const data = await r.json().catch(() => null);

  if (!r.ok || !Array.isArray(data)) {
    throw new Error(data?.error || "No se pudo cargar la barbería.");
  }

  const shop = data.find((s) => Number(s.id) === barbershopId);
  if (!shop) throw new Error("No existe esa barbería (shopId inválido).");

  shopTitle.textContent = shop.name || "Barbería";
  shopSub.textContent = shop.city || "";
  shopInfo.textContent = `${shop.name || ""}${shop.city ? " · " + shop.city : ""}${
    shop.address ? " · " + shop.address : ""
  }`;

  return shop;
}

async function loadServices() {
  const r = await fetch(`${API_BASE}/services?barbershopId=${barbershopId}`);
  const data = await r.json().catch(() => null);

  if (!r.ok || !Array.isArray(data)) {
    throw new Error(data?.error || "No se pudieron cargar los servicios.");
  }

  serviceSelect.innerHTML = "";
  serviceSelect.disabled = false;

  for (const s of data) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.name} — $${money(s.price)}`;
    opt.dataset.price = s.price;
    serviceSelect.appendChild(opt);
  }

  if (data.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No hay servicios cargados";
    serviceSelect.appendChild(opt);
    serviceSelect.disabled = true;
  }
}

function minTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

(async function init() {
  try {
    setErr("");
    const dateInput = document.getElementById("date");
    if (dateInput) dateInput.min = minTodayISO();

    await loadBarbershop();
    await loadServices();
  } catch (e) {
    console.error(e);
    setErr(e.message || "Error cargando la página.");
  }
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setErr("");
  pricingBox.style.display = "none";
  pricingBox.innerHTML = "";

  const serviceId = Number(serviceSelect.value);
  const customerName = document.getElementById("customerName").value.trim();
  const customerPhone = document.getElementById("customerPhone").value.trim();
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  if (!serviceId || !customerName || !customerPhone || !date || !time) {
    setErr("Completá todos los campos.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Reservando...";

  try {
    const r = await fetch(`${API_BASE}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barbershopId,
        serviceId,
        customerName,
        customerPhone,
        date,
        time,
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data) {
      setErr(data?.error || "No se pudo reservar.");
      btn.disabled = false;
      btn.textContent = "Confirmar reserva";
      return;
    }

    // Mostramos pricing (según campos que devuelva tu API)
    const depPct = data.depositPercentageAtBooking ?? data.depositPercentage ?? 0;
    const depAmt = data.depositAmount ?? 0;
    const fee = data.platformFee ?? 0;
    const total = data.totalToPay ?? (depAmt + fee);

    pricingBox.style.display = "block";
    pricingBox.innerHTML = `
      <div><b>Reserva creada</b> (estado: ${data.status || "pending"} / ${data.paymentStatus || "unpaid"})</div>
      <div>Seña (${depPct}%): <b>$${money(depAmt)}</b></div>
      <div>Costo BarberCloud: <b>$${money(fee)}</b></div>
      <div>Total a pagar ahora: <b>$${money(total)}</b></div>
      <div class="muted" style="margin-top:6px;">Siguiente paso: botón “Pagar seña” con MercadoPago.</div>
    `;

    btn.textContent = "Reservado ✅";
  } catch (err) {
    console.error(err);
    setErr("Error de red.");
    btn.disabled = false;
    btn.textContent = "Confirmar reserva";
  }
});
