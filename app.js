// Usamos siempre la API online en Render
const API_URL = 'https://barbercloud.onrender.com/api';

async function loadBarbershops() {
  try {
    const resp = await fetch(`${API_BASE}/barbershops`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "API error");
    barbershopSelect.innerHTML = "";
    if (data.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "No hay barberías disponibles";
      opt.disabled = true;
      opt.selected = true;
      barbershopSelect.appendChild(opt);
      serviceSelect.innerHTML = "";
      return;
    }
    data.forEach(bs => {
      const opt = document.createElement("option");
      opt.value = bs.id;
      opt.textContent = bs.name;
      barbershopSelect.appendChild(opt);
    });
    // Carga servicios de la primera barbería
    loadServices(data[0].id);
  } catch (e) {
    alert(e.message || "No se pudieron cargar las barberías.");
  }
}


async function loadServices(barbershopId) {
  try {
    const res = await fetch(`${API_URL}/services?barbershopId=${barbershopId}`);
    if (!res.ok) {
      throw new Error('Error al cargar servicios');
    }

    const data = await res.json();
    const select = document.getElementById('serviceSelect');
    select.innerHTML = ''; // limpio

    if (!Array.isArray(data) || data.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No hay servicios disponibles';
      select.appendChild(option);
      return;
    }

    data.forEach((service) => {
      const option = document.createElement('option');
      option.value = service.id;
      option.textContent = `${service.name} - $${service.price}`;
      select.appendChild(option);
    });
  } catch (err) {
    console.error(err);
    alert('No se pudieron cargar los servicios.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadBarbershops();

  document
    .getElementById('barbershopSelect')
    .addEventListener('change', (e) => {
      const barbershopId = e.target.value;
      if (barbershopId) {
        loadServices(barbershopId);
      }
    });

  const form = document.getElementById('appointmentForm');
  const submitBtn = form.querySelector('button[type="submit"]');

  let isSubmitting = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Evita doble envío
    if (isSubmitting) return;
    isSubmitting = true;
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Reservando...';

    const barbershopId = Number(
      document.getElementById('barbershopSelect').value
    );
    const serviceId = Number(
      document.getElementById('serviceSelect').value
    );
    const customerName = document.getElementById('customerName').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;

    const body = {
      barbershopId,
      serviceId,
      customerName,
      customerPhone,
      date,
      time,
    };

    try {
      const res = await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = 'Error al crear turno.';
        try {
          const error = await res.json();
          msg = error.error || msg;
        } catch (_) {}
        alert(msg);
        return;
      }

      const created = await res.json();
      console.log('Turno creado:', created);
      alert('Turno creado correctamente. (Por ahora sin pago de seña)');

      form.reset();
    } catch (err) {
      console.error(err);
      alert('Error de conexión con el servidor');
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
});
