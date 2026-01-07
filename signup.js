// signup.js
const API_BASE = "https://barbercloud.onrender.com";

const form = document.getElementById("signupForm");
const msg = document.getElementById("msg");
const btn = document.getElementById("btnCreate");

function setMsg(text, ok = false) {
  msg.textContent = text;
  msg.style.color = ok ? "#41d17a" : "#ff6b6b";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");
  btn.disabled = true;
  btn.textContent = "Creando...";

  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());

  try {
    const r = await fetch(`${API_BASE}/api/onboarding/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (!r.ok || !data.ok) {
      setMsg(data?.error || "No se pudo crear la cuenta.");
      btn.disabled = false;
      btn.textContent = "Crear cuenta";
      return;
    }

   // Guardamos token para que el admin pueda levantar sesión
localStorage.setItem("token", data.token);
localStorage.setItem("jwt", data.token);
localStorage.setItem("authToken", data.token);
localStorage.setItem("bc_token", data.token);    // 👈 nueva línea a añadir
localStorage.setItem("barbershopId", String(data.barbershop.id));


    setMsg("Cuenta creada ✅ Redirigiendo al panel...", true);

    setTimeout(() => {
      window.location.href = "./admin.html";
    }, 700);
  } catch (err) {
    console.error(err);
    setMsg("Error de red. Probá de nuevo.");
    btn.disabled = false;
    btn.textContent = "Crear cuenta";
  }
});
