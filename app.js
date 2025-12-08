// Usamos siempre la API online en Render
const API_URL = 'https://barbercloud.onrender.com/api';

async function loadBarbershops() {
  try {
    const res = await fetch(`${API_URL}/barbershops`);
    if (!res.ok) {
      throw new Error('Error al cargar barberías');
    }

    const data = await res.json();
    const select = document.getElementById('barbershopSelect');
    select.innerHTML = '';

    if (!Array.isArray(data) || data.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No hay barberías disponibles';
      select.appendChild(option);
      return;
    }

    data.forEach((shop) => {
      const option = document.createElement('option');
      option.value = shop.id;
      option.textContent = `${shop.name} - ${shop.city}`;
      select.appendChild(option);
    });

    // Dispara carga de servicios para la primera barbería
    loadServices(data[0].id);
  } catch (err) {
    console.error(err);
    alert('No se pudieron cargar las barberías. Revisá la API.');
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
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

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
    }
  });
});
