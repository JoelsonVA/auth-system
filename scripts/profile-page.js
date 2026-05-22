import { STORAGE_KEYS } from "./config.js";
import {
  ApiError,
  fetchDashboardSession,
  fetchMyFreelancerProfile,
  updateProfile,
  saveMyFreelancerProfile,
  fetchMyPayout,
  updateMyPayout,
  deactivateAccount as apiDeactivateAccount,
  deleteAccount as apiDeleteAccount,
} from "./api-client.js";

const elements = {
  welcomeMessage: document.getElementById("welcomeMessage"),
  feedbackMessage: document.getElementById("feedbackMessage"),
  backButton: document.getElementById("backButton"),
  profileForm: document.getElementById("profileForm"),
  cancelButton: document.getElementById("cancelButton"),
  fullName: document.getElementById("fullName"),
  email: document.getElementById("email"),
  currentPassword: document.getElementById("currentPassword"),
  newPassword: document.getElementById("newPassword"),
  confirmPassword: document.getElementById("confirmPassword"),
  professionalTitle: document.getElementById("professionalTitle"),
  skills: document.getElementById("skills"),
  bio: document.getElementById("bio"),
  location: document.getElementById("location"),
  hourlyRate: document.getElementById("hourlyRate"),
  portfolioUrl: document.getElementById("portfolioUrl"),
  professionalEmail: document.getElementById("professionalEmail"),
  payoutMethod: document.getElementById("payoutMethod"),
  payoutDetails: document.getElementById("payoutDetails"),
  profileAvatar: document.getElementById("profileAvatar"),
  profilePhoto: document.getElementById("profilePhoto"),
  deactivateBtn: document.getElementById("deactivateBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
};

let currentUser = null;
let photoBase64 = null;
let initialProfile = {};

const accountTypeLabels = {
  client: "Cliente",
  freelancer: "Freelancer",
};

function getToken() {
  return localStorage.getItem(STORAGE_KEYS.authToken);
}

function clearSessionAndRedirect() {
  localStorage.removeItem(STORAGE_KEYS.authToken);
  localStorage.removeItem(STORAGE_KEYS.authUser);
  window.location.href = "./index.html?reason=session";
}

function showFeedback(message, type = "info") {
  elements.feedbackMessage.textContent = message;
  elements.feedbackMessage.dataset.type = type;
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

async function loadFreelancerProfile(token) {
  if (!currentUser || currentUser.accountType !== "freelancer") {
    return;
  }

  const profileResponse = await fetchMyFreelancerProfile(token);

  const profile = profileResponse.profile || {};

  elements.professionalTitle.value = profile.professionalTitle || "";
  elements.professionalEmail.value = profile.professionalEmail || "";
  elements.skills.value = profile.skills || "";
  elements.bio.value = profile.bio || "";
  elements.location.value = profile.location || "";
  elements.hourlyRate.value = profile.hourlyRate || "";
  elements.portfolioUrl.value = profile.portfolioUrl || "";
}

async function loadSession() {
  const token = getToken();

  if (!token) {
    clearSessionAndRedirect();
    return false;
  }

  try {
    console.log("loadSession: carregando sessão");
    const payload = await fetchDashboardSession(token);
    console.log("loadSession: payload da API:", payload);
    currentUser = payload.user;
    localStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(currentUser));
    console.log("loadSession: currentUser definido:", currentUser);

    const accountTypeLabel = accountTypeLabels[currentUser.accountType] || currentUser.accountType;
    elements.welcomeMessage.textContent = `${currentUser.name} • ${accountTypeLabel}${currentUser.isAdmin ? " • Admin" : ""}`;

    // Preencher formulário com dados atuais
    elements.fullName.value = currentUser.name || "";
    elements.email.value = currentUser.email || "";    elements.professionalEmail.value = currentUser.professionalEmail || "";    elements.profileAvatar.src = currentUser.profilePhoto || createAvatarSVG(currentUser.name || "Usuário");

    const isFreelancer = currentUser.accountType?.toLowerCase() === "freelancer";

    // Mostrar/ocultar campos freelancer
    const freelancerFieldset = document.getElementById('freelancerFields');
    if (freelancerFieldset) {
      freelancerFieldset.style.display = isFreelancer ? 'block' : 'none';
    }

    const payoutFieldset = document.getElementById('payoutFields');
    if (payoutFieldset) {
      payoutFieldset.style.display = isFreelancer ? 'block' : 'none';
    }

    if (isFreelancer) {
      try {
        await loadFreelancerProfile(token);
      } catch (e) {
        console.log("Dados profissionais não disponíveis", e);
      }

      try {
        const payout = await fetchMyPayout(token);
        if (elements.payoutMethod) {
          elements.payoutMethod.value = payout.payoutMethod || "";
        }
        if (elements.payoutDetails) {
          elements.payoutDetails.value = payout.payoutDetails || "";
        }
      } catch (e) {
        console.log("Payout não disponível", e);
      }
    }

    initialProfile = {
      fullName: elements.fullName.value,
      email: elements.email.value,
      professionalEmail: elements.professionalEmail.value,
      professionalTitle: elements.professionalTitle.value,
      skills: elements.skills.value,
      bio: elements.bio.value,
      location: elements.location.value,
      hourlyRate: elements.hourlyRate.value,
      portfolioUrl: elements.portfolioUrl.value,
    };

    console.log("loadSession: initialProfile definido:", initialProfile);
    return true;
  } catch (error) {
    showFeedback(getApiMessage(error, "Sessão inválida. Faça login novamente."), "error");
    setTimeout(() => {
      clearSessionAndRedirect();
    }, 350);
    return false;
  }
}

function generateAvatarLetters(name) {
  const letters = name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return letters || "U";
}

function createAvatarSVG(name) {
  const letters = generateAvatarLetters(name);
  const colors = ["667eea", "764ba2", "f093fb", "4facfe"];
  const colorIndex = name.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];

  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Ccircle cx='100' cy='100' r='100' fill='%23${bgColor}'/%3E%3Ctext x='50%25' y='50%25' font-size='80' fill='white' text-anchor='middle' dominant-baseline='middle' font-family='Arial' font-weight='bold'%3E${letters}%3C/text%3E%3C/svg%3E`;
}

function handlePhotoUpload(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  // Validar tamanho (máx 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showFeedback("Arquivo muito grande. Máximo 5MB.", "error");
    return;
  }

  // Validar tipo
  if (!file.type.startsWith("image/")) {
    showFeedback("Selecione uma imagem válida.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    photoBase64 = e.target.result;
    elements.profileAvatar.src = photoBase64;
    showFeedback("Foto atualizada. Salve o perfil para aplicar.", "info");
  };
  reader.readAsDataURL(file);
}

async function handleFormSubmit(event) {
  event.preventDefault();

  const fullName = elements.fullName.value.trim();
  const email = elements.email.value.trim();
  const newPassword = elements.newPassword.value.trim();
  const confirmPassword = elements.confirmPassword.value.trim();
  const currentPassword = elements.currentPassword.value.trim();

  // Validações básicas
  if (!fullName || !email) {
    showFeedback("Nome e email são obrigatórios.", "error");
    return;
  }

  // Se tentar mudar senha, verificar se atual foi informada
  if (newPassword && !currentPassword) {
    showFeedback("Informe sua senha atual para alterar a senha.", "error");
    return;
  }

  // Se tentar mudar senha, verificar se senhas batem
  if (newPassword && newPassword !== confirmPassword) {
    showFeedback("As senhas não coincidem.", "error");
    return;
  }

  // Se tentar mudar email, verificar se atual foi informada
  if (email !== currentUser.email && !currentPassword) {
    showFeedback("Informe sua senha atual para alterar o email.", "error");
    return;
  }

  try {
    const payload = {
      name: fullName,
      email: email,
      professionalEmail: elements.professionalEmail.value.trim(),
      password: newPassword || undefined,
      currentPassword: currentPassword || undefined,
      photo: photoBase64 || undefined,
    };

    const updateResult = await updateProfile(getToken(), payload);

    const isFreelancer = currentUser.accountType?.toLowerCase() === "freelancer";
    console.log("isFreelancer:", isFreelancer);

    if (isFreelancer) {
      const freelancerPayload = {
        professionalTitle: elements.professionalTitle.value.trim(),
        professionalEmail: elements.professionalEmail.value.trim(),
        skills: elements.skills.value.trim(),
        bio: elements.bio.value.trim(),
        location: elements.location.value.trim(),
        hourlyRate: elements.hourlyRate.value.trim(),
        portfolioUrl: elements.portfolioUrl.value.trim(),
      };

      await saveMyFreelancerProfile(getToken(), freelancerPayload);

      if (elements.payoutMethod && elements.payoutMethod.value) {
        await updateMyPayout(getToken(), {
          payoutMethod: elements.payoutMethod.value,
          payoutDetails: elements.payoutDetails ? elements.payoutDetails.value.trim() : "",
        });
      }
    }

    currentUser.name = updateResult.user?.name || fullName;
    currentUser.email = updateResult.user?.email || email;
    if (updateResult.user?.profilePhoto) {
      currentUser.profilePhoto = updateResult.user.profilePhoto;
    }
    localStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(currentUser));

    showFeedback("Perfil atualizado com sucesso!", "success");

    elements.currentPassword.value = "";
    elements.newPassword.value = "";
    elements.confirmPassword.value = "";
    photoBase64 = null;

    await loadSession();
    await loadFreelancerProfile(getToken());

    initialProfile = {
      fullName: elements.fullName.value,
      email: elements.email.value,
      professionalTitle: elements.professionalTitle.value,
      professionalEmail: elements.professionalEmail.value,
      skills: elements.skills.value,
      bio: elements.bio.value,
      location: elements.location.value,
      hourlyRate: elements.hourlyRate.value,
      portfolioUrl: elements.portfolioUrl.value,
    };

    setTimeout(() => {
      window.location.href = "./app.html";
    }, 1500);
  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
    showFeedback(getApiMessage(error, "Erro ao salvar perfil."), "error");
  }
}

function handleCancel() {
  const hasChanges =
    elements.fullName.value !== initialProfile.fullName ||
    elements.email.value !== initialProfile.email ||
    elements.professionalTitle.value !== initialProfile.professionalTitle ||
    elements.professionalEmail.value !== initialProfile.professionalEmail ||
    elements.skills.value !== initialProfile.skills ||
    elements.bio.value !== initialProfile.bio ||
    elements.location.value !== initialProfile.location ||
    elements.hourlyRate.value !== initialProfile.hourlyRate ||
    elements.portfolioUrl.value !== initialProfile.portfolioUrl;

  if (hasChanges) {
    if (!confirm("Há alterações não salvas. Descartar e voltar?")) {
      return;
    }
  }
  window.location.href = "./app.html";
}

async function deactivateAccount() {
  if (
    !confirm(
      "Tem certeza que deseja desativar sua conta por 180 dias? Você não poderá acessar a plataforma durante este período."
    )
  ) {
    return;
  }

  try {
    await apiDeactivateAccount(getToken());
    showFeedback("Conta desativada com sucesso. Você será redirecionado.", "success");
    setTimeout(() => {
      clearSessionAndRedirect();
    }, 2000);
  } catch (error) {
    console.error("Erro ao desativar conta:", error);
    showFeedback(getApiMessage(error, "Erro ao desativar conta."), "error");
  }
}

async function deleteAccount() {
  if (
    !confirm(
      "ATENÇÃO: Esta ação não pode ser desfeita. Todos os seus dados serão excluídos permanentemente. Tem certeza?"
    )
  ) {
    return;
  }

  const confirmation = prompt("Digite 'EXCLUIR' para confirmar a exclusão permanente da conta:");
  if (confirmation !== "EXCLUIR") {
    showFeedback("Exclusão cancelada.", "error");
    return;
  }

  try {
    await apiDeleteAccount(getToken());
    showFeedback("Conta excluída com sucesso. Você será redirecionado.", "success");
    setTimeout(() => {
      clearSessionAndRedirect();
    }, 2000);
  } catch (error) {
    console.error("Erro ao excluir conta:", error);
    showFeedback(getApiMessage(error, "Erro ao excluir conta."), "error");
  }
}

function bindEvents() {
  elements.backButton.addEventListener("click", () => {
    window.location.href = "./app.html";
  });

  elements.cancelButton.addEventListener("click", handleCancel);
  elements.profileForm.addEventListener("submit", handleFormSubmit);
  elements.profilePhoto.addEventListener("change", handlePhotoUpload);
  elements.deactivateBtn.addEventListener("click", deactivateAccount);
  elements.deleteBtn.addEventListener("click", deleteAccount);
}

async function initialize() {
  bindEvents();
  showFeedback("Carregando perfil...", "info");

  const isSessionValid = await loadSession();
  if (!isSessionValid) {
    return;
  }

  elements.profileAvatar.src = currentUser.profilePhoto || createAvatarSVG(currentUser.name);

  showFeedback("Perfil carregado com sucesso.", "success");
}

initialize();
