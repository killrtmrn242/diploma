async function handleJWTLogin(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = {
    email: formData.get("email"),
    password: formData.get("password")
  };

  const responseBox = document.getElementById("jwtResponseBox");

  try {
    const response = await fetch("/login-jwt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "JWT login failed.");
    }

    localStorage.setItem("jwtToken", result.token);
    localStorage.setItem("jwtUserEmail", result.user.email);

    responseBox.classList.remove("d-none");
    responseBox.innerHTML = `
      <div class="token-label">JWT token generated</div>
      <code>${result.token}</code>
      <p class="small-note mt-3 mb-0">Token saved in localStorage. Redirecting to the dashboard demonstration...</p>
    `;

    setTimeout(() => {
      window.location.href = `${result.redirectUrl}&token=${encodeURIComponent(result.token)}`;
    }, 1200);
  } catch (error) {
    responseBox.classList.remove("d-none");
    responseBox.innerHTML = `<div class="text-danger fw-semibold">${error.message}</div>`;
  }
}

async function fetchJWTProfile() {
  const profileBox = document.getElementById("jwtApiProfile");
  const token = localStorage.getItem("jwtToken");

  if (!profileBox || !token) {
    return;
  }

  try {
    const response = await fetch("/api/jwt-profile", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Unable to fetch JWT profile.");
    }

    profileBox.textContent = JSON.stringify(result.user, null, 2);
  } catch (error) {
    profileBox.textContent = error.message;
  }
}

function hydrateDashboardToken() {
  const preview = document.getElementById("dashboardTokenPreview");
  if (!preview) {
    return;
  }

  const token = localStorage.getItem("jwtToken");
  if (token) {
    preview.textContent = `${token.slice(0, 36)}...`;
  }
}

function setupLogoutCleanup() {
  const logoutForms = document.querySelectorAll('form[action="/logout"]');
  logoutForms.forEach((form) => {
    form.addEventListener("submit", () => {
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("jwtUserEmail");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const jwtLoginForm = document.getElementById("jwtLoginForm");
  if (jwtLoginForm) {
    jwtLoginForm.addEventListener("submit", handleJWTLogin);
  }

  hydrateDashboardToken();
  fetchJWTProfile();
  setupLogoutCleanup();
});
