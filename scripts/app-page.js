import { STORAGE_KEYS } from "./config.js";
import {
  ApiError,
  fetchAdminOverview,
  fetchDashboardSession,
  fetchFreelancers,
  fetchMessages,
  fetchMyFreelancerProfile,
  saveMyFreelancerProfile,
  sendMessage as apiSendMessage,
  updateAdminStatus,
  createJob as apiCreateJob,
  fetchJobs,
  applyToJob as apiApplyToJob,
  fetchJobApplications,
  updateApplicationStatus as apiUpdateApplicationStatus,
  deactivateAccount as apiDeactivateAccount,
  reactivateAccount,
  deleteAccount as apiDeleteAccount,
  getAccountStatus,
  completeJob as apiCompleteJob,
  fetchBillingStatus,
  createCheckoutSession,
  createBillingPortalSession,
} from "./api-client.js";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "./notification-api.js";

const elements = {
  welcomeMessage: document.getElementById("welcomeMessage"),
  feedbackMessage: document.getElementById("feedbackMessage"),
  editProfileButton: document.getElementById("editProfileButton"),
  logoutButton: document.getElementById("logoutButton"),
  freelancerSearchInput: document.getElementById("freelancerSearchInput"),
  freelancerSearchButton: document.getElementById("freelancerSearchButton"),
  freelancerList: document.getElementById("freelancerList"),
  freelancerProfilePanel: document.getElementById("freelancerProfilePanel"),
  freelancerProfileForm: document.getElementById("freelancerProfileForm"),
  profileProfessionalTitle: document.getElementById("profileProfessionalTitle"),
  profileSkills: document.getElementById("profileSkills"),
  profileHourlyRate: document.getElementById("profileHourlyRate"),
  profileLocation: document.getElementById("profileLocation"),
  profilePortfolioUrl: document.getElementById("profilePortfolioUrl"),
  profileBio: document.getElementById("profileBio"),
  adminPanel: document.getElementById("adminPanel"),
  adminSummary: document.getElementById("adminSummary"),
  adminUsersTableBody: document.getElementById("adminUsersTableBody"),
  adminStatusForm: document.getElementById("adminStatusForm"),
  adminTargetEmail: document.getElementById("adminTargetEmail"),
  adminTargetStatus: document.getElementById("adminTargetStatus"),
  messagesPanel: document.querySelector(".messages-panel"),
  messagesList: document.getElementById("messagesList"),
  refreshMessagesButton: document.getElementById("refreshMessagesButton"),
  messageModal: document.getElementById("messageModal"),
  messageForm: document.getElementById("messageForm"),
  messageText: document.getElementById("messageText"),
  closeMessageModal: document.getElementById("closeMessageModal"),
  jobsTitle: document.getElementById("jobsTitle"),
  jobsList: document.getElementById("jobsList"),
  jobStatusFilter: document.getElementById("jobStatusFilter"),
  refreshJobsButton: document.getElementById("refreshJobsButton"),
  createJobButton: document.getElementById("createJobButton"),
  jobModal: document.getElementById("jobModal"),
  jobForm: document.getElementById("jobForm"),
  jobTitle: document.getElementById("jobTitle"),
  jobDescription: document.getElementById("jobDescription"),
  jobBudget: document.getElementById("jobBudget"),
  jobDeadline: document.getElementById("jobDeadline"),
  jobSkills: document.getElementById("jobSkills"),
  closeJobModal: document.getElementById("closeJobModal"),
  applicationsModal: document.getElementById("applicationsModal"),
  applicationsList: document.getElementById("applicationsList"),
  closeApplicationsModal: document.getElementById("closeApplicationsModal"),
  deactivateAccountButton: document.getElementById("deactivateAccountButton"),
  deleteAccountButton: document.getElementById("deleteAccountButton"),
  accountStatus: document.getElementById("accountStatus"),
  notificationBell: document.getElementById("notificationBell"),
  notificationPanel: document.getElementById("notificationPanel"),
  notificationsList: document.getElementById("notificationsList"),
  notificationBadge: document.getElementById("notificationBadge"),
  markAllRead: document.getElementById("markAllRead"),
  premiumStatusText: document.getElementById("premiumStatusText"),
  premiumSubscribeButton: document.getElementById("premiumSubscribeButton"),
  premiumManageButton: document.getElementById("premiumManageButton"),
};

let currentUser = null;
let currentMessageReceiver = null;
let notificationRefreshInterval = null;
let billingStatus = null;

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

function shouldOfferPremiumUpgrade(error) {
  return (
    error instanceof ApiError &&
    error.status === 402 &&
    error.data?.code === "PREMIUM_REQUIRED"
  );
}

function isFreelancerConcurrentLimit(error) {
  return (
    error instanceof ApiError &&
    error.status === 402 &&
    error.data?.code === "FREELANCER_CONCURRENT_LIMIT"
  );
}

async function startPremiumCheckout(planType) {
  try {
    const response = await createCheckoutSession(getToken(), { planType });
    if (response?.url) {
      window.location.href = response.url;
      return;
    }
    showFeedback("Não foi possível iniciar o checkout.", "error");
  } catch (error) {
    console.error("Erro ao iniciar checkout:", error);
    showFeedback(getApiMessage(error, "Erro ao iniciar checkout"), "error");
  }
}

async function openBillingPortal() {
  try {
    const response = await createBillingPortalSession(getToken());
    if (response?.url) {
      window.location.href = response.url;
      return;
    }
    showFeedback("Não foi possível abrir o portal.", "error");
  } catch (error) {
    console.error("Erro ao abrir portal:", error);
    showFeedback(getApiMessage(error, "Erro ao abrir portal"), "error");
  }
}

async function loadBillingStatus() {
  if (!elements.premiumStatusText) return;

  try {
    billingStatus = await fetchBillingStatus(getToken());
  } catch (error) {
    console.error("Erro ao carregar status premium:", error);
    billingStatus = null;
  }

  const planType = currentUser?.accountType === "freelancer" ? "freelancer" : "client";
  const isPremium = Boolean(billingStatus?.[planType]?.isPremium);

  elements.premiumStatusText.textContent = isPremium
    ? "Premium ativo"
    : "Premium desativado";

  if (elements.premiumSubscribeButton) {
    elements.premiumSubscribeButton.textContent = isPremium ? "Upgrade Premium" : "Assinar Premium";
    elements.premiumSubscribeButton.onclick = () => startPremiumCheckout(planType);
  }

  if (elements.premiumManageButton) {
    elements.premiumManageButton.disabled = !isPremium;
    elements.premiumManageButton.onclick = () => openBillingPortal();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setPanelVisibility(isFreelancer, isAdmin) {
  elements.freelancerProfilePanel.classList.toggle("hidden", !isFreelancer);
  elements.adminPanel.classList.toggle("hidden", !isAdmin);
  elements.createJobButton.classList.toggle("hidden", currentUser?.accountType !== "client");

  // Jobs panel is visible for all authenticated users
  // Account management is visible for all authenticated users
}

function renderFreelancerList(freelancers) {
  if (!freelancers.length) {
    elements.freelancerList.innerHTML = `
      <article class="freelancer-card">
        <h3>Nenhum freelancer encontrado</h3>
        <p class="freelancer-meta">Tente outro termo de busca.</p>
      </article>
    `;
    return;
  }

  elements.freelancerList.innerHTML = "";

  freelancers.forEach((freelancer) => {
    const card = document.createElement("article");
    card.className = "freelancer-card";

    const title = document.createElement("h3");
    const roleLine = document.createElement("p");
    const contactLine = document.createElement("p");
    const skillsLine = document.createElement("p");
    const bioLine = document.createElement("p");
    const actionsDiv = document.createElement("div");

    title.textContent = freelancer.name || "Freelancer";

    const titleText = freelancer.professionalTitle || "Perfil em construção";
    const locationText = freelancer.location ? ` | ${freelancer.location}` : "";
    const rateText = freelancer.hourlyRate !== null
      ? ` | R$ ${freelancer.hourlyRate}/h`
      : "";

    roleLine.className = "freelancer-meta";
    roleLine.textContent = `${titleText}${locationText}${rateText}`;

    contactLine.className = "freelancer-meta";
    contactLine.textContent = freelancer.professionalEmail || freelancer.email || "-";

    skillsLine.className = "freelancer-skills";
    skillsLine.textContent = freelancer.skills
      ? `Skills: ${freelancer.skills}`
      : "Skills: não informadas";

    bioLine.className = "freelancer-meta";
    bioLine.textContent = freelancer.bio || "Sem bio informada.";

    actionsDiv.className = "freelancer-actions";
    if (currentUser && currentUser.accountType === "client") {
      const messageButton = document.createElement("button");
      messageButton.className = "message-button";
      messageButton.type = "button";
      messageButton.textContent = "Enviar mensagem";
      messageButton.addEventListener("click", () => openMessageModal(freelancer.id, freelancer.name));
      actionsDiv.appendChild(messageButton);
    }

    card.append(title, roleLine, contactLine, skillsLine, bioLine, actionsDiv);
    elements.freelancerList.appendChild(card);
  });
}

async function loadSession() {
  const token = getToken();

  if (!token) {
    clearSessionAndRedirect();
    return false;
  }

  try {
    const payload = await fetchDashboardSession(token);
    currentUser = payload.user;
    localStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(currentUser));

    const accountTypeLabel = accountTypeLabels[currentUser.accountType] || currentUser.accountType;
    elements.welcomeMessage.textContent =
      `${payload.user.name} • ${accountTypeLabel}${payload.user.isAdmin ? " • Admin" : ""}`;

    const isFreelancer = currentUser.accountType?.toLowerCase() === "freelancer";
    setPanelVisibility(
      isFreelancer,
      currentUser.isAdmin === true,
    );
    return true;
  } catch (error) {
    showFeedback(getApiMessage(error, "Sessão inválida. Faça login novamente."), "error");
    setTimeout(() => {
      clearSessionAndRedirect();
    }, 350);
    return false;
  }
}

async function loadFreelancers() {
  const token = getToken();
  const search = elements.freelancerSearchInput.value.trim();

  try {
    const payload = await fetchFreelancers(token, search);
    renderFreelancerList(payload.freelancers || []);
  } catch (error) {
    showFeedback(getApiMessage(error, "Falha ao carregar freelancers."), "error");
  }
}

async function loadMyFreelancerProfile() {
  const isFreelancer = currentUser?.accountType?.toLowerCase() === "freelancer";
  if (!currentUser || !isFreelancer) {
    return;
  }

  const token = getToken();

  try {
    const payload = await fetchMyFreelancerProfile(token);
    const profile = payload.profile || {};

    elements.profileProfessionalTitle.value = profile.professionalTitle || "";
    elements.profileSkills.value = profile.skills || "";
    elements.profileHourlyRate.value = profile.hourlyRate !== "" ? profile.hourlyRate : "";
    elements.profileLocation.value = profile.location || "";
    elements.profilePortfolioUrl.value = profile.portfolioUrl || "";
    elements.profileBio.value = profile.bio || "";
  } catch (error) {
    showFeedback(getApiMessage(error, "Falha ao carregar perfil freelancer."), "error");
  }
}

async function loadAdminOverview() {
  if (!currentUser || !currentUser.isAdmin) {
    return;
  }

  const token = getToken();

  try {
    const payload = await fetchAdminOverview(token);
    elements.adminSummary.textContent =
      `Pessoas que entraram: ${payload.summary.uniqueUsers} | Total de acessos: ${payload.summary.totalEntries}`;
    renderAdminUsers(payload.users || []);
  } catch (error) {
    showFeedback(getApiMessage(error, "Falha ao carregar painel admin."), "error");
  }
}

async function handleProfileSubmit(event) {
  event.preventDefault();

  const token = getToken();
  const payload = {
    professionalTitle: elements.profileProfessionalTitle.value.trim(),
    skills: elements.profileSkills.value.trim(),
    hourlyRate: elements.profileHourlyRate.value.trim(),
    location: elements.profileLocation.value.trim(),
    portfolioUrl: elements.profilePortfolioUrl.value.trim(),
    bio: elements.profileBio.value.trim(),
  };

  try {
    await saveMyFreelancerProfile(token, payload);
    showFeedback("Perfil freelancer atualizado com sucesso.", "success");
    await loadMyFreelancerProfile();
    await loadFreelancers();
  } catch (error) {
    showFeedback(getApiMessage(error, "Falha ao salvar perfil freelancer."), "error");
  }
}

async function handleAdminStatusSubmit(event) {
  event.preventDefault();

  const token = getToken();
  const email = elements.adminTargetEmail.value.trim();
  const isAdmin = elements.adminTargetStatus.value === "true";

  if (!email) {
    showFeedback("Informe o email para atualizar o status.", "error");
    return;
  }

  try {
    const payload = await updateAdminStatus(token, { email, isAdmin });
    showFeedback(payload.message || "Status atualizado com sucesso.", "success");
    elements.adminStatusForm.reset();
    await loadAdminOverview();
  } catch (error) {
    showFeedback(getApiMessage(error, "Falha ao atualizar status de admin."), "error");
  }
}

async function sendMessage(receiverId, message) {
  try {
    await apiSendMessage(getToken(), {
      receiverId,
      message,
    });
    showFeedback("Mensagem enviada com sucesso!", "success");
    closeMessageModal();
    await loadMessages();
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    if (shouldOfferPremiumUpgrade(error)) {
      const proceed = confirm(
        "Mensagens são um recurso Premium. Deseja assinar agora?"
      );
      if (proceed) {
        await startPremiumCheckout(currentUser?.accountType || "client");
      }
      return;
    }
    showFeedback(getApiMessage(error, "Erro ao enviar mensagem"), "error");
  }
}

async function loadMessages() {
  try {
    const response = await fetchMessages(getToken());
    displayMessages(response.messages || []);
  } catch (error) {
    console.error("Erro ao carregar mensagens:", error);
    if (shouldOfferPremiumUpgrade(error)) {
      showFeedback("Mensagens disponíveis apenas para Premium.", "error");
      displayMessages([]);
      return;
    }
    showFeedback(getApiMessage(error, "Erro ao carregar mensagens"), "error");
  }
}

function displayMessages(messages) {
  if (!elements.messagesList) return;

  elements.messagesList.innerHTML = "";

  if (!messages || messages.length === 0) {
    elements.messagesList.innerHTML = '<p class="no-messages">Nenhuma mensagem encontrada.</p>';
    return;
  }

  messages.forEach((message) => {
    const card = document.createElement("div");
    card.className = `message-card ${message.sender_id === currentUser.id ? "sent" : "received"}`;

    const meta = document.createElement("div");
    meta.className = "message-meta";
    const senderName = message.sender_id === currentUser.id
      ? "Você"
      : escapeHtml(message.sender_name || "Remetente");
    const receiverName = message.receiver_id === currentUser.id
      ? "você"
      : escapeHtml(message.receiver_name || "Destinatário");
    meta.textContent = `${senderName} para ${receiverName} - ${new Date(message.createdAt).toLocaleString()}`;

    const messageText = document.createElement("p");
    messageText.className = "message-text";
    messageText.textContent = message.message || "";

    card.append(meta, messageText);
    elements.messagesList.appendChild(card);
  });
}

function openMessageModal(receiverId, receiverName) {
  currentMessageReceiver = { id: receiverId, name: receiverName };
  const header = elements.messageModal.querySelector('.modal-header h3');
  if (header) {
    header.textContent = `Enviar mensagem para ${receiverName}`;
  }
  elements.messageText.value = '';
  elements.messageModal.classList.remove('hidden');
}

function closeMessageModal() {
  elements.messageModal.classList.add('hidden');
  currentMessageReceiver = null;
}

async function createJob(jobData) {
  try {
    await apiCreateJob(getToken(), jobData);
    showFeedback("Trabalho criado com sucesso!", "success");
    closeJobModal();
    await loadJobs();
  } catch (error) {
    console.error("Erro ao criar trabalho:", error);
    showFeedback(getApiMessage(error, "Erro ao criar trabalho"), "error");
  }
}

async function loadJobs() {
  try {
    const status = elements.jobStatusFilter.value;
    const response = await fetchJobs(getToken(), status);
    displayJobs(response.jobs || []);
    updateJobsTitle();
  } catch (error) {
    console.error("Erro ao carregar trabalhos:", error);
    showFeedback(getApiMessage(error, "Erro ao carregar trabalhos"), "error");
  }
}

function displayJobs(jobs) {
  if (!elements.jobsList) return;

  if (!jobs || jobs.length === 0) {
    elements.jobsList.innerHTML = '<p class="no-jobs">Nenhum trabalho encontrado.</p>';
    return;
  }

  elements.jobsList.innerHTML = "";

  jobs.forEach((job) => {
    const card = document.createElement("div");
    card.className = "job-card";

    const header = document.createElement("div");
    header.className = "job-header";

    const title = document.createElement("h3");
    title.className = "job-title";
    title.textContent = job.title || "Sem título";

    const meta = document.createElement("span");
    meta.className = "job-meta";
    meta.textContent = new Date(job.created_at).toLocaleDateString("pt-BR");

    header.append(title, meta);

    const clientInfo = document.createElement("p");
    clientInfo.className = "job-meta";
    clientInfo.textContent = `Por: ${job.client_name || "Cliente"}`;

    const description = document.createElement("p");
    description.className = "job-description";
    description.textContent = job.description || "Sem descrição disponível.";

    const details = document.createElement("div");
    details.className = "job-details";

    if (job.budget) {
      const budgetDetail = document.createElement("div");
      budgetDetail.className = "job-detail";
      const budgetLabel = document.createElement("strong");
      budgetLabel.textContent = "Orçamento:";
      budgetDetail.append(budgetLabel, ` R$ ${parseFloat(job.budget).toFixed(2)}`);
      details.appendChild(budgetDetail);
    }

    if (job.deadline) {
      const deadlineDetail = document.createElement("div");
      deadlineDetail.className = "job-detail";
      const deadlineLabel = document.createElement("strong");
      deadlineLabel.textContent = "Prazo:";
      deadlineDetail.append(deadlineLabel, ` ${new Date(job.deadline).toLocaleDateString("pt-BR")}`);
      details.appendChild(deadlineDetail);
    }

    if (job.skills_required) {
      const skillsDetail = document.createElement("div");
      skillsDetail.className = "job-detail";
      const skillsLabel = document.createElement("strong");
      skillsLabel.textContent = "Skills:";
      skillsDetail.append(skillsLabel, ` ${escapeHtml(job.skills_required)}`);
      details.appendChild(skillsDetail);
    }

    const applicationsDetail = document.createElement("div");
    applicationsDetail.className = "job-detail";
    const applicationsLabel = document.createElement("strong");
    applicationsLabel.textContent = "Aplicações:";
    applicationsDetail.append(applicationsLabel, ` ${job.applications_count || 0}`);
    details.appendChild(applicationsDetail);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "job-actions";

    if (currentUser.accountType === "freelancer") {
      const applyButton = document.createElement("button");
      applyButton.className = `job-apply-btn ${job.has_applied ? "disabled" : ""}`;
      applyButton.type = "button";
      applyButton.textContent = job.has_applied ? "Já Aplicou" : "Aplicar";
      if (job.has_applied) {
        applyButton.disabled = true;
      } else {
        applyButton.addEventListener("click", () => applyToJob(job.id, job.title));
      }
      actionsDiv.appendChild(applyButton);
    } else {
      const viewButton = document.createElement("button");
      viewButton.className = "view-applications-btn";
      viewButton.type = "button";
      viewButton.textContent = "Ver Aplicações";
      viewButton.addEventListener("click", () => viewApplications(job.id, job.title));
      actionsDiv.appendChild(viewButton);

      if (job.status === "in_progress") {
        const completeButton = document.createElement("button");
        completeButton.className = "accept-btn";
        completeButton.type = "button";
        completeButton.textContent = "Concluir";
        completeButton.addEventListener("click", () => completeJob(job.id, job.title));
        actionsDiv.appendChild(completeButton);
      }
    }

    card.append(header, clientInfo, description, details, actionsDiv);
    elements.jobsList.appendChild(card);
  });
}

function updateJobsTitle() {
  if (!elements.jobsTitle) return;

  const status = elements.jobStatusFilter.value;
  const titles = {
    open: "Trabalhos Disponíveis",
    in_progress: "Trabalhos em Andamento",
    completed: "Trabalhos Concluídos"
  };

  elements.jobsTitle.textContent = titles[status] || "Trabalhos";
}

function openJobModal() {
  elements.jobTitle.value = '';
  elements.jobDescription.value = '';
  elements.jobBudget.value = '';
  elements.jobDeadline.value = '';
  elements.jobSkills.value = '';
  elements.jobModal.classList.remove('hidden');
}

function closeJobModal() {
  elements.jobModal.classList.add('hidden');
}

async function applyToJob(jobId, jobTitle) {
  const message = prompt(`Digite uma mensagem para sua aplicação ao trabalho "${jobTitle}":`);
  if (message === null) return; // Cancelado

  if (!message.trim()) {
    showFeedback("Digite uma mensagem para sua aplicação", "error");
    return;
  }

  try {
    await apiApplyToJob(getToken(), { jobId, message: message.trim() });
    showFeedback("Aplicação enviada com sucesso!", "success");
    await loadJobs();
  } catch (error) {
    console.error("Erro ao aplicar para trabalho:", error);
    showFeedback(getApiMessage(error, "Erro ao aplicar para trabalho"), "error");
  }
}

async function completeJob(jobId, jobTitle) {
  if (!confirm(`Concluir o trabalho "${jobTitle}"?`)) {
    return;
  }

  try {
    await apiCompleteJob(getToken(), jobId);
    showFeedback("Trabalho concluído com sucesso!", "success");
    await loadJobs();
  } catch (error) {
    console.error("Erro ao concluir trabalho:", error);
    showFeedback(getApiMessage(error, "Erro ao concluir trabalho"), "error");
  }
}

async function viewApplications(jobId, jobTitle) {
  try {
    const response = await fetchJobApplications(getToken(), jobId);
    displayApplications(response.applications || [], jobId, jobTitle);
    elements.applicationsModal.classList.remove('hidden');
  } catch (error) {
    console.error("Erro ao carregar aplicações:", error);
    showFeedback(getApiMessage(error, "Erro ao carregar aplicações"), "error");
  }
}

function displayApplications(applications, jobId, jobTitle) {
  if (!elements.applicationsList) return;

  const header = elements.applicationsModal.querySelector('.modal-header h3');
  if (header) {
    header.textContent = `Aplicações: ${jobTitle}`;
  }

  if (!applications || applications.length === 0) {
    elements.applicationsList.innerHTML = '<p class="no-applications">Nenhuma aplicação recebida ainda.</p>';
    return;
  }

  elements.applicationsList.innerHTML = "";

  applications.forEach((app) => {
    const card = document.createElement("div");
    card.className = "application-card";

    const headerWrap = document.createElement("div");
    headerWrap.className = "application-header";

    const freelancerName = document.createElement("div");
    freelancerName.className = "application-freelancer";
    freelancerName.textContent = app.freelancer_name || "Freelancer";

    const statusBadge = document.createElement("span");
    statusBadge.className = "application-status " + app.status;
    statusBadge.textContent = app.status;

    headerWrap.append(freelancerName, statusBadge);

    const info = document.createElement("div");
    info.className = "application-info";

    if (app.professional_title) {
      const title = document.createElement("p");
      const titleLabel = document.createElement("strong");
      titleLabel.textContent = "Título:";
      title.append(titleLabel, ` ${escapeHtml(app.professional_title)}`);
      info.appendChild(title);
    }

    if (app.skills) {
      const skills = document.createElement("p");
      const skillsLabel = document.createElement("strong");
      skillsLabel.textContent = "Skills:";
      skills.append(skillsLabel, ` ${escapeHtml(app.skills)}`);
      info.appendChild(skills);
    }

    if (app.hourly_rate) {
      const hourly = document.createElement("p");
      const hourlyLabel = document.createElement("strong");
      hourlyLabel.textContent = "Valor/hora:";
      hourly.append(hourlyLabel, ` R$ ${app.hourly_rate}`);
      info.appendChild(hourly);
    }

    const email = document.createElement("p");
    const emailLabel = document.createElement("strong");
    emailLabel.textContent = "Email:";
    email.append(emailLabel, ` ${escapeHtml(app.freelancer_email || "")}`);
    info.appendChild(email);

    const date = document.createElement("p");
    const dateLabel = document.createElement("strong");
    dateLabel.textContent = "Data:";
    date.append(dateLabel, ` ${new Date(app.created_at).toLocaleDateString("pt-BR")}`);
    info.appendChild(date);

    card.append(headerWrap, info);

    if (app.message) {
      const messageBlock = document.createElement("div");
      messageBlock.className = "application-message";
      messageBlock.textContent = app.message;
      card.appendChild(messageBlock);
    }

    if (app.status === "pending") {
      const actions = document.createElement("div");
      actions.className = "application-actions";

      const acceptBtn = document.createElement("button");
      acceptBtn.className = "accept-btn";
      acceptBtn.type = "button";
      acceptBtn.textContent = "Aceitar";
      acceptBtn.addEventListener("click", () => updateApplicationStatus(app.id, "accepted", jobId));

      const rejectBtn = document.createElement("button");
      rejectBtn.className = "reject-btn";
      rejectBtn.type = "button";
      rejectBtn.textContent = "Rejeitar";
      rejectBtn.addEventListener("click", () => updateApplicationStatus(app.id, "rejected", jobId));

      actions.append(acceptBtn, rejectBtn);
      card.appendChild(actions);
    }

    elements.applicationsList.appendChild(card);
  });
}

function closeApplicationsModal() {
  elements.applicationsModal.classList.add('hidden');
}

async function updateApplicationStatus(applicationId, status, jobId) {
  try {
    await apiUpdateApplicationStatus(getToken(), { applicationId, status });
    showFeedback(`Aplicação ${status === 'accepted' ? 'aceita' : 'rejeitada'} com sucesso!`, "success");
    const jobTitle = elements.applicationsModal.querySelector('.modal-header h3').textContent.replace('Aplicações: ', '');
    await viewApplications(jobId, jobTitle);
  } catch (error) {
    console.error("Erro ao atualizar aplicação:", error);
    if (isFreelancerConcurrentLimit(error)) {
      showFeedback(getApiMessage(error, "Freelancer atingiu o limite de trabalhos."), "error");
      return;
    }
    showFeedback(getApiMessage(error, "Erro ao atualizar aplicação"), "error");
  }
}

async function deactivateAccount() {
  if (!confirm("Tem certeza que deseja desativar sua conta por 180 dias? Você não poderá acessar a plataforma durante este período.")) {
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
    showFeedback(getApiMessage(error, "Erro ao desativar conta"), "error");
  }
}

async function deleteAccount() {
  if (!confirm("ATENÇÃO: Esta ação não pode ser desfeita. Todos os seus dados serão excluídos permanentemente. Tem certeza?")) {
    return;
  }

  const confirmation = prompt("Digite 'EXCLUIR' para confirmar a exclusão permanente da conta:");
  if (confirmation !== 'EXCLUIR') {
    showFeedback("Exclusão cancelada", "error");
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
    showFeedback(getApiMessage(error, "Erro ao excluir conta"), "error");
  }
}

async function loadAccountStatus() {
  try {
    const response = await getAccountStatus(getToken());
    displayAccountStatus(response);
  } catch (error) {
    console.error("Erro ao carregar status da conta:", error);
  }
}

function displayAccountStatus(status) {
  if (!elements.accountStatus) return;

  let statusText = "Conta ativa";

  if (!status.isActive) {
    const reactivationDate = new Date(status.deactivatedUntil);
    statusText = `Conta desativada até ${reactivationDate.toLocaleDateString('pt-BR')}`;

    if (status.canReactivate) {
      statusText += ' (pode reativar agora)';
    }
  }

  const statusParagraph = document.createElement("p");
  const statusStrong = document.createElement("strong");
  statusStrong.textContent = "Status:";
  statusParagraph.append(statusStrong, ` ${statusText}`);
  elements.accountStatus.innerHTML = "";
  elements.accountStatus.appendChild(statusParagraph);
}

async function handleMessageSubmit(event) {
  event.preventDefault();

  if (!currentMessageReceiver) {
    showFeedback("Destinatário não selecionado", "error");
    return;
  }

  const message = elements.messageText.value.trim();
  if (!message) {
    showFeedback("Digite uma mensagem", "error");
    return;
  }

  await sendMessage(currentMessageReceiver.id, message);
}

async function refreshAllData() {
  showFeedback("Atualizando dados...", "info");
  
  const isSessionValid = await loadSession();
  if (!isSessionValid) {
    return;
  }

  await loadFreelancers();
  await loadMyFreelancerProfile();
  await loadAdminOverview();
  await loadMessages();
  await loadJobs();
  await loadAccountStatus();
  await loadBillingStatus();
  
  showFeedback("Dados atualizados com sucesso!", "success");
}

async function handleJobSubmit(event) {
  event.preventDefault();

  const jobData = {
    title: elements.jobTitle.value.trim(),
    description: elements.jobDescription.value.trim(),
    budget: elements.jobBudget.value.trim(),
    deadline: elements.jobDeadline.value.trim(),
    skillsRequired: elements.jobSkills.value.trim(),
  };

  if (!jobData.title || !jobData.description) {
    showFeedback("Título e descrição são obrigatórios", "error");
    return;
  }

  await createJob(jobData);
}

function bindEvents() {
  elements.logoutButton.addEventListener("click", clearSessionAndRedirect);
  elements.editProfileButton.addEventListener("click", () => {
    window.location.href = "./profile.html";
  });
  elements.freelancerSearchButton.addEventListener("click", loadFreelancers);
  elements.freelancerSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadFreelancers();
    }
  });
  elements.freelancerProfileForm.addEventListener("submit", handleProfileSubmit);
  elements.adminStatusForm.addEventListener("submit", handleAdminStatusSubmit);
  elements.messageForm.addEventListener("submit", handleMessageSubmit);
  elements.closeMessageModal.addEventListener("click", closeMessageModal);
  elements.refreshMessagesButton.addEventListener("click", loadMessages);

  // Jobs events
  elements.jobStatusFilter.addEventListener("change", loadJobs);
  elements.refreshJobsButton.addEventListener("click", loadJobs);
  elements.createJobButton.addEventListener("click", openJobModal);
  elements.jobForm.addEventListener("submit", handleJobSubmit);
  elements.closeJobModal.addEventListener("click", closeJobModal);
  elements.closeApplicationsModal.addEventListener("click", closeApplicationsModal);

  // Account events
  elements.deactivateAccountButton.addEventListener("click", deactivateAccount);
  elements.deleteAccountButton.addEventListener("click", deleteAccount);

  if (elements.premiumSubscribeButton) {
    elements.premiumSubscribeButton.addEventListener("click", () => {
      const planType = currentUser?.accountType || "client";
      startPremiumCheckout(planType);
    });
  }

  if (elements.premiumManageButton) {
    elements.premiumManageButton.addEventListener("click", openBillingPortal);
  }
}

// Global functions for onclick handlers
window.applyToJob = applyToJob;
window.viewApplications = viewApplications;
window.updateApplicationStatus = updateApplicationStatus;

async function initialize() {
  bindEvents();
  showFeedback("Carregando plataforma...", "info");
  await refreshAllData();
  showFeedback("Plataforma pronta para uso.", "success");
}

initialize();
