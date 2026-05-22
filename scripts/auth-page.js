import { STORAGE_KEYS } from "./config.js";
import { ApiError, loginUser, registerUser } from "./api-client.js";

const elements = {
  feedbackMessage: document.getElementById("feedbackMessage"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  loginAccountType: document.getElementById("loginAccountType"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  registerAccountType: document.getElementById("registerAccountType"),
  registerName: document.getElementById("registerName"),
  registerEmail: document.getElementById("registerEmail"),
  registerPassword: document.getElementById("registerPassword"),
};

const accountTypeLabels = {
  client: "Cliente",
  freelancer: "Freelancer",
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidAccountType(accountType) {
  return accountType === "client" || accountType === "freelancer";
}

function showFeedback(message, type = "info") {
  elements.feedbackMessage.textContent = message;
  elements.feedbackMessage.dataset.type = type;
}

function saveSession(token, user) {
  localStorage.setItem(STORAGE_KEYS.authToken, token);
  localStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(user));
}

function getApiMessage(error, fallbackMessage) {
  if (error instanceof ApiError) {
    return error.message || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

function validateLoginPayload(accountType, email, password) {
  if (!isValidAccountType(accountType)) {
    throw new Error("Selecione como você está entrando.");
  }

  if (!email || !password) {
    throw new Error("Preencha todos os campos do login.");
  }

  if (!isValidEmail(email)) {
    throw new Error("Digite um email válido.");
  }

  if (password.length < 8) {
    throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  }
}

function validateRegisterPayload(accountType, name, email, password) {
  if (!isValidAccountType(accountType)) {
    throw new Error("Selecione o tipo da conta.");
  }

  if (!name || !email || !password) {
    throw new Error("Preencha todos os campos do cadastro.");
  }

  if (!isValidEmail(email)) {
    throw new Error("Digite um email válido.");
  }

  if (password.length < 8) {
    throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  }
}

function redirectToApp() {
  window.location.href = "/app";
}

async function onLoginSubmit(event) {
  event.preventDefault();

  const accountType = elements.loginAccountType.value;
  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value.trim();

  try {
    validateLoginPayload(accountType, email, password);

    const payload = await loginUser({ accountType, email, password });
    saveSession(payload.token, payload.user);
    showFeedback(`Login realizado como ${accountTypeLabels[accountType]}.`, "success");

    setTimeout(() => {
      redirectToApp();
    }, 250);
  } catch (error) {
    showFeedback(getApiMessage(error, "Falha no login."), "error");
  }
}

async function onRegisterSubmit(event) {
  event.preventDefault();

  const accountType = elements.registerAccountType.value;
  const name = elements.registerName.value.trim();
  const email = elements.registerEmail.value.trim();
  const password = elements.registerPassword.value.trim();

  try {
    validateRegisterPayload(accountType, name, email, password);

    await registerUser({ accountType, name, email, password });
    const loginPayload = await loginUser({ accountType, email, password });
    saveSession(loginPayload.token, loginPayload.user);

    showFeedback("Cadastro concluído e acesso liberado.", "success");

    setTimeout(() => {
      redirectToApp();
    }, 250);
  } catch (error) {
    showFeedback(getApiMessage(error, "Falha no cadastro."), "error");
  }
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", onLoginSubmit);
  elements.registerForm.addEventListener("submit", onRegisterSubmit);
}

function initialize() {
  bindEvents();
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason");

  if (reason === "session") {
    showFeedback("Sua sessão expirou. Faça login novamente para entrar na plataforma.", "info");
    return;
  }

  showFeedback("Selecione seu tipo de conta para continuar.", "info");
}

initialize();
