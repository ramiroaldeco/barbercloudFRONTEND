// Panel de administración BarberCloud
const API_URL = 'https://barbercloud.onrender.com/api';

let barbershops = [];
let appointments = [];
const serviceMap = new Map();
const barbershopMap = new Map();

function $(id) {
  return document.getElementById(id);
}

// --------- Carga inicial ---------
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();

  $('filterBarbershop').addEventListener('change', renderAll);
  $('filterDate').addEventListener('change', renderAll);

  $('clearFilters').addEventListener('click', () => {
    $('filterBarbershop').value = '';
    $('filterDate').value = '';
    renderAll();
  });
});

async function loadDashboard() {
  try {
    // 1) Traigo barberías y turnos en paralelo
    const [barbRes, appRes] = await Promise.all([
      fetch(`${API_URL}/barbershops`),
      fetch(`${API_URL}/appointments`),
    ]);

    if (!barbRes.ok || !appRes.ok) {
      throw new Error('Error al cargar datos desde la API');
    }

    barbershops = await barbRes.json();
    appointments = await appRes.json();

    // Creo maps para lookup rápido
    barbershops.forEach((b) => barbershopMap.set(b.id, b));

    // 2) Traigo servicios de cada barbería (para mostrar nombres)
    await loadAllServices();

    // 3) Lleno filtros y renderizo todo
    fillBarbershopFilter();
    renderAll();
  } catch (err) {
    console.error(err);
    const body = $('appointmentsBody');
    body.innerHTML =
      '<tr><td colspan="7" class="table-empty">No se pudieron cargar los datos. Probá recargar la página.</td></tr>';
  }
}

async function loadAllServices() {
  for (const shop of barbershops) {
    try {
      const res = await fetch(`${API_URL}/services?barbershopId=${shop.id}`);
      if (!res.ok) continue;
      const services = await res.json();
      services.forEach((s) => serviceMap.set(s.id, s));
    } catch (err) {
      console.error('Error cargando servicios de', shop.name, err);
    }
  }
}

function fillBarbershopFilter() {
  const select = $('filterBarbershop');
  select.innerHTML = '<option value="">Todas</option>';

  barbershops.forEach((shop) => {
    const opt = document.createElement('option');
    opt.value = shop.id;
    opt.textContent = shop.name;
    select.appendChild(opt);
  });
}

// --------- Render principal ---------
function renderAll() {
  renderTable();
  renderStats();
  renderTodayList();
}

function getFilteredAppointments() {
  const barbershopId = Number($('filterBarbershop').value || 0);
  const dateValue = $('filterDate').value; // formato yyyy-mm-dd

  return appointments
    .filter((app) => {
      if (barbershopId && app.barbershopId !== barbershopId) return false;
      if (dateValue && app.date !== dateValue) return false;
      return true;
    })
    .sort((a, b) => {
      const da = toDateTime(a);
      const db = toDateTime(b);
      return da - db;
    });
}

function renderTable() {
  const body = $('appointmentsBody');
  const data = getFilteredAppointments();

  $('turnosCount').textContent = `${data.length} turno${
    data.length === 1 ? '' : 's'
  }`;

  if (!data.length) {
    body.innerHTML =
      '<tr><td colspan="7" class="table-empty">No hay turnos para los filtros seleccionados.</td></tr>';
    return;
  }

  body.innerHTML = data
    .map((app) => {
      const shop = barbershopMap.get(app.barbershopId);
      const service = serviceMap.get(app.serviceId);

      return `
        <tr>
          <td>${escapeHtml(app.date)}</td>
          <td>${escapeHtml(app.time)}</td>
          <td>${escapeHtml(app.customerName)}</td>
          <td>${service ? escapeHtml(service.name) : '—'}</td>
          <td>${shop ? escapeHtml(shop.name) : '—'}</td>
          <td>${escapeHtml(app.customerPhone || '')}</td>
          <td>${formatCreatedAt(app.createdAt)}</td>
        </tr>
      `;
    })
    .join('');
}

// --------- Stats ---------
function renderStats() {
  const todayStr = new Date().toISOString().slice(0, 10);

  const total = appointments.length;

  const today = appointments.filter((a) => a.date === todayStr).length;

  const now = new Date();
  const next7 = appointments.filter((a) => {
    const d = toDateTime(a);
    const diffMs = d - now;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  $('statToday').textContent = today;
  $('statNext7').textContent = next7;
  $('statTotal').textContent = total;
}

// --------- Lista de hoy a la derecha ---------
function renderTodayList() {
  const list = $('todayList');
  const todayStr = new Date().toISOString().slice(0, 10);

  const todayApps = appointments
    .filter((a) => a.date === todayStr)
    .sort((a, b) => toDateTime(a) - toDateTime(b));

  if (!todayApps.length) {
    list.innerHTML = '<li class="table-empty">Sin turnos para hoy todavía.</li>';
    return;
  }

  list.innerHTML = todayApps
    .map((app) => {
      const service = serviceMap.get(app.serviceId);
      return `
        <li class="today-item">
          <div class="today-time">${escapeHtml(app.time)}</div>
          <div class="today-main">
            <div class="today-client">${escapeHtml(app.customerName)}</div>
            <div class="today-service">
              ${service ? escapeHtml(service.name) : 'Servicio'} • 
              <span class="today-phone">${escapeHtml(app.customerPhone)}</span>
            </div>
          </div>
        </li>
      `;
    })
    .join('');
}

// --------- Helpers ---------
function toDateTime(app) {
  // app.date = 'YYYY-MM-DD', app.time = 'HH:MM'
  return new Date(`${app.date}T${app.time}:00`);
}

function formatCreatedAt(createdAt) {
  if (!createdAt) return '—';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '—';

  const dia = d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  });
  const hora = d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dia} ${hora}`;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
