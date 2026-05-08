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

    await runJWTProtectedRequest(result.token);

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

async function runJWTProtectedRequest(token) {
  const response = await fetch("/api/profile", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Unable to run JWT protected request.");
  }

  return result;
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

async function getAuthState() {
  try {
    const response = await fetch("/auth/state");
    const state = await response.json();

    return {
      hasSession: Boolean(state.hasSession),
      hasJwt: Boolean(localStorage.getItem("jwtToken"))
    };
  } catch (error) {
    const metricsPage = document.querySelector(".metrics-page");

    return {
      hasSession: metricsPage ? metricsPage.dataset.hasSessionAuth === "true" : false,
      hasJwt: Boolean(localStorage.getItem("jwtToken"))
    };
  }
}

async function showMixedAuthWarningIfNeeded() {
  const metricsPage = document.querySelector(".metrics-page");
  const warning = document.getElementById("mixedAuthWarning");
  const sessionIndicator = document.getElementById("sessionStateIndicator");
  const jwtIndicator = document.getElementById("jwtStateIndicator");
  const mixedIndicator = document.getElementById("mixedStateIndicator");

  if (!metricsPage || !warning) {
    return;
  }

  const state = await getAuthState();
  const hasMixedState = state.hasSession === true && state.hasJwt === true;

  if (sessionIndicator) {
    sessionIndicator.textContent = state.hasSession ? "yes" : "no";
  }

  if (jwtIndicator) {
    jwtIndicator.textContent = state.hasJwt ? "yes" : "no";
  }

  if (mixedIndicator) {
    mixedIndicator.textContent = hasMixedState ? "yes" : "no";
  }

  if (hasMixedState) {
    warning.classList.remove("d-none");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const jwtLoginForm = document.getElementById("jwtLoginForm");
  if (jwtLoginForm) {
    jwtLoginForm.addEventListener("submit", handleJWTLogin);
  }

  hydrateDashboardToken();
  fetchJWTProfile();
  setupLogoutCleanup();
  showMixedAuthWarningIfNeeded();
});
