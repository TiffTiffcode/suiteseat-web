document.addEventListener("DOMContentLoaded", () => {
  // --- helpers
  const $ = (id) => document.getElementById(id);
  const show = (el) => el && (el.style.display = "block");
  const hide = (el) => el && (el.style.display = "none");

  // --- top toggles
  const clientToggle   = $("clientToggle");
  const proToggle      = $("proToggle");
  const clientSection  = $("clientSection");
  const proSection     = $("proSection");

  // default: client visible
  show(clientSection); hide(proSection);
  clientToggle?.classList.add("active");
  proToggle?.classList.remove("active");

  clientToggle?.addEventListener("click", () => {
    show(clientSection); hide(proSection);
    clientToggle.classList.add("active");
    proToggle.classList.remove("active");
  });
  proToggle?.addEventListener("click", () => {
    show(proSection); hide(clientSection);
    proToggle.classList.add("active");
    clientToggle.classList.remove("active");
  });

  // --- client login/signup card toggles
  const clientSignUpCard = $("clientSignUpCard");
  const clientLoginCard  = $("clientLoginCard");
  $("showClientLogin")?.addEventListener("click", (e) => {
    e.preventDefault(); hide(clientSignUpCard); show(clientLoginCard);
  });
  $("showClientSignup")?.addEventListener("click", (e) => {
    e.preventDefault(); hide(clientLoginCard); show(clientSignUpCard);
  });

  // --- pro login/signup card toggles
  const proSignUpCard = $("proSignUpCard");
  const proLoginCard  = $("proLoginCard");
  $("showProLogin")?.addEventListener("click", (e) => {
    e.preventDefault(); hide(proSignUpCard); show(proLoginCard);
  });
  $("showProSignup")?.addEventListener("click", (e) => {
    e.preventDefault(); hide(proLoginCard); show(proSignUpCard);
  });

  // --- optional: read ?next=/some/path for where to go after auth
  const params = new URLSearchParams(location.search);
  const next = params.get("next"); // e.g. /client-dashboard or a booking page

  // ========= PRO SIGN UP =========
  $("proSignUpForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName = $("pro-first-name")?.value.trim();
    const lastName  = $("pro-last-name")?.value.trim();
    const email     = $("pro-signup-email")?.value.trim().toLowerCase();
    const phone     = $("signup-phone-number")?.value.trim();
    const password  = $("pro-signup-password")?.value;
    const confirm   = $("signup-reenter-pro-password")?.value;

    if (!firstName || !lastName || !email || !password) return alert("Please fill in all required fields.");
    if (password !== confirm) return alert("Passwords do not match");
    if (password.length < 8 || password.length > 64) return alert("Password must be 8–64 characters.");

    try {
      const r = await fetch("/signup/pro", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: "include",
        body: JSON.stringify({ firstName, lastName, email, password, phone })
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) return alert(data.message || "Sign up failed");

      // logged in as pro now
      window.currentUser = data.user;
      location.href = data.redirect || next || "/appointment-settings";
    } catch (err) {
      console.error(err); alert("Sign up error.");
    }
  });

  // ========= PRO LOGIN =========
  $("proLoginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      email: $("pro-log-in-email")?.value,
      password: $("pro-log-in-password")?.value
    };
    try {
      const r = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return alert(data.message || "Login failed");
      window.currentUser = data.user;
      location.href = data.redirect || next || "/appointment-settings";
    } catch (err) {
      console.error(err); alert("Login error.");
    }
  });

  // ========= CLIENT SIGN UP (NO /welcome REDIRECT) =========
  $("clientSignUpForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName = $("client-first-name")?.value.trim();
    const lastName  = $("client-last-name")?.value.trim();
    const email     = $("client-signup-email")?.value.trim().toLowerCase();
    const phone     = $("client-signup-phone-number")?.value.trim();
    const password  = $("client-signup-password")?.value;
    const confirm   = $("client-signup-reenter-password")?.value;

    if (!firstName || !lastName || !email || !password) return alert("Please fill in all required fields.");
    if (password !== confirm) return alert("Passwords do not match");
    if (password.length < 8 || password.length > 64) return alert("Password must be 8–64 characters.");

    try {
      const r = await fetch("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: "include",
        body: JSON.stringify({ firstName, lastName, email, password, phone })
      });

      if (r.status === 409) {
        const d = await r.json().catch(() => ({}));
        return alert(d.message || "Email already in use");
      }

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) return alert(data.message || "Signup failed");

      // logged in as client now (session cookie is set)
      window.currentUser = data.user;

      // EITHER: stay on page and show success
      // alert("Account created! You can now book appointments.");

      // OR: redirect to the intended place (preferred)
      location.href = next || "/client-dashboard";
    } catch (err) {
      console.error(err); alert("Signup error.");
    }
  });

  // ========= CLIENT LOGIN =========
  $("clientLoginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      email: $("client-log-in-email")?.value,
      password: $("client-log-in-password")?.value
    };
    try {
      const r = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return alert(data.message || "Login failed");

      window.currentUser = data.user;
      location.href = data.redirect || next || "/client-dashboard";
    } catch (err) {
      console.error(err); alert("Login error.");
    }
  });

  // ====== show/hide password buttons (safe optional chaining) ======
  $("toggleClientSignupPassword")?.addEventListener("click", () => {
    const input = $("client-signup-password");
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
  });
  $("toggleClientPassword")?.addEventListener("click", () => {
    const input = $("client-log-in-password");
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    const eye = $("toggleClientPassword");
    if (eye) eye.textContent = input.type === "password" ? "👁️" : "🙈";
  });

  $("toggleProSignupPassword")?.addEventListener("click", function () {
    const input = $("pro-signup-password");
    if (!input) return;
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    this.textContent = isHidden ? "🙈" : "👁️";
  });
  $("toggleProPassword")?.addEventListener("click", function () {
    const input = $("pro-log-in-password");
    if (!input) return;
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    this.textContent = isHidden ? "🙈" : "👁️";
  });
});
