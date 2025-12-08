const API_URL = 'http://localhost:4000/api'; // después lo cambiamos al dominio de Render

async function loadBarbershops() {
  const res = await fetch(`${API_URL}/barbershops`);
  const data = await res.json();

  const select = document.getElementById('barbershopSelect');
  data.forEach((shop) => {
    const option = document.createElement('option');
    option.value = shop.id;
    option.textContent = `${shop.name} - ${shop.city}`;
    select.appendChild(option);
  });

  // Dispara carga de servicios para la primera barbería
  if (data.length > 0) {
    loadServices(data[0].id);
  }
}

async function loadServices(barbershopId) {
  const res = await fetch(`${API_URL}/services?barbershopId=${barbershopId}`);
  const data = await res.json();

  const select = document.getElementById('serviceSelect');
  select.innerHTML = ''; // limpio

  data.forEach((service) => {
    const option = document.createElement('option');
    option.value = service.id;
    option.textContent = `${service.name} - $${service.price}`;
    select.appendChild(option);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadBarbershops();

  document.getElementById('barbershopSelect').addEventListener('change', (e) => {
    const barbershopId = e.target.value;
    loadServices(barbershopId);
  });

  const form = document.getElementById('appointmentForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

	const API_URL = 'https://barbercloud.onrender.com/api';
    const barbershopId = Number(document.getElementById('barbershopSelect').value);
    const serviceId = Number(document.getElementById('serviceSelect').value);
    const customerName = document.getElementById('customerName').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;

    const body = { barbershopId, serviceId, customerName, customerPhone, date, time };

    try {
      const res = await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        alert('Error al crear turno: ' + (error.error || 'desconocido'));
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
