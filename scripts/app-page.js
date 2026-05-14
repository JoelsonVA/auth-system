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
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "./api-client.js";

const elements = {
  welcomeMessage: document.getElementById("welcomeMessage"),
  feedbackMessage: document.getElementById("feedbackMessage"),
  notificationBell: document.getElementById("notificationBell"),
  notificationBadge: document.getElementById("notificationBadge"),
  notificationPanel: document.getElementById("notificationPanel"),
  notificationsList: document.getElementById("notificationsList"),
  markAllRead: document.getElementById("markAllRead"),
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
};

let currentUser = null;
let currentMessageReceiver = null;
let notificationRefreshInterval = null;

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
    showFeedback(getApiMessage(error, "Erro ao enviar mensagem"), "error");
  }
}

async function loadMessages() {
  try {
    const response = await fetchMessages(getToken());
    displayMessages(response.messages || []);
  } catch (error) {
    console.error("Erro ao carregar mensagens:", error);
    showFeedback(getApiMessage(error, "Erro ao carregar mensagens"), "error");
  }
}

function displayMessages(messages) {
  if (!elements.messagesList) return;

  if (!messages || messages.length === 0) {
    elements.messagesList.innerHTML = '<p class="no-messages">Nenhuma mensagem encontrada.</p>';
    return;
  }

  elements.messagesList.innerHTML = messages.map(message => `
    <div class="message-card ${message.sender_id === currentUser.id ? 'sent' : 'received'}">
      <div class="message-meta">
        ${message.sender_id === currentUser.id ? 'Você' : message.sender_name} para ${message.receiver_id === currentUser.id ? 'você' : message.receiver_name}
        - ${new Date(message.createdAt).toLocaleString()}
      </div>
      <p class="message-text">${message.message}</p>
    </div>
  `).join('');
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

  elements.jobsList.innerHTML = jobs.map(job => `
    <div class="job-card">
      <div class="job-header">
        <h3 class="job-title">${job.title}</h3>
        <span class="job-meta">${new Date(job.created_at).toLocaleDateString('pt-BR')}</span>
      </div>

      <p class="job-meta">Por: ${job.client_name}</p>

      <p class="job-description">${job.description}</p>

      <div class="job-details">
        ${job.budget ? `<div class="job-detail"><strong>Orçamento:</strong> R$ ${parseFloat(job.budget).toFixed(2)}</div>` : ''}
        ${job.deadline ? `<div class="job-detail"><strong>Prazo:</strong> ${new Date(job.deadline).toLocaleDateString('pt-BR')}</div>` : ''}
        ${job.skills_required ? `<div class="job-detail"><strong>Skills:</strong> ${job.skills_required}</div>` : ''}
        <div class="job-detail"><strong>Aplicações:</strong> ${job.applications_count || 0}</div>
      </div>

      <div class="job-actions">
        ${currentUser.accountType === 'freelancer' ?
          `<button class="job-apply-btn ${job.has_applied ? 'disabled' : ''}"
                   ${job.has_applied ? 'disabled' : ''}
                   onclick="window.applyToJob(${job.id}, '${job.title}')">
            ${job.has_applied ? 'Já Aplicou' : 'Aplicar'}
          </button>` :
          `<button class="view-applications-btn" onclick="window.viewApplications(${job.id}, '${job.title}')">
            Ver Aplicações
          </button>`
        }
      </div>
    </div>
  `).join('');
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

  elements.applicationsList.innerHTML = applications.map(app => `
    <div class="application-card">
      <div class="application-header">
        <div class="application-freelancer">${app.freelancer_name}</div>
        <span class="application-status ${app.status}">${app.status}</span>
      </div>

      <div class="application-info">
        ${app.professional_title ? `<p><strong>Título:</strong> ${app.professional_title}</p>` : ''}
        ${app.skills ? `<p><strong>Skills:</strong> ${app.skills}</p>` : ''}
        ${app.hourly_rate ? `<p><strong>Valor/hora:</strong> R$ ${app.hourly_rate}</p>` : ''}
        <p><strong>Email:</strong> ${app.freelancer_email}</p>
        <p><strong>Data:</strong> ${new Date(app.created_at).toLocaleString('pt-BR')}</p>
      </div>

      ${app.message ? `<div class="application-message">${app.message}</div>` : ''}

      ${app.status === 'pending' ? `
        <div class="application-actions">
          <button class="accept-btn" onclick="window.updateApplicationStatus(${app.id}, 'accepted', ${jobId})">
            Aceitar
          </button>
          <button class="reject-btn" onclick="window.updateApplicationStatus(${app.id}, 'rejected', ${jobId})">
            Rejeitar
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');
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

  elements.accountStatus.innerHTML = `<p><strong>Status:</strong> ${statusText}</p>`;
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

async function loadNotifications() {
  const token = getToken();
  if (!token) return;

  try {
    const response = await getUnreadNotificationCount(token);
    const count = response.count || 0;
    elements.notificationBadge.textContent = count;
    
    if (count > 0) {
      elements.notificationBadge.classList.add("active");
    } else {
      elements.notificationBadge.classList.remove("active");
    }
  } catch (e) {
    console.error("Erro ao carregar notificações:", e);
  }
}

function toggleNotificationPanel() {
  elements.notificationPanel.classList.toggle("hidden");
  
  if (!elements.notificationPanel.classList.contains("hidden")) {
    renderNotifications();
  }
}

async function renderNotifications() {
  const token = getToken();
  if (!token) return;

  try {
    const response = await getNotifications(token, 50);
    const notifications = response.notifications || [];

    if (notifications.length === 0) {
      elements.notificationsList.innerHTML = `
        <p class="empty-message">Nenhuma notificação</p>
      `;
      return;
    }

    elements.notificationsList.innerHTML = notifications.map(n => `
      <div class="notification-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}">
        <span class="notification-item-badge ${n.type}">${n.type === 'message' ? '💬' : n.type === 'job_proposal' ? '📋' : '📢'}</span>
        <div class="notification-content">
          <div class="notification-item-title">${n.title}</div>
          <div class="notification-item-content">${n.message}</div>
          <div class="notification-item-time">${new Date(n.createdAt).toLocaleString('pt-BR')}</div>
        </div>
      </div>
    `).join('');

    // Adicionar listeners aos itens
    document.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        try {
          await markNotificationAsRead(token, id);
          item.classList.remove('unread');
          await loadNotifications();
        } catch (e) {
          console.error("Erro ao marcar notificação como lida:", e);
        }
      });
    });
  } catch (e) {
    console.error("Erro ao renderizar notificações:", e);
    elements.notificationsList.innerHTML = `
      <p class="empty-message">Erro ao carregar notificações</p>
    `;
  }
}

async function handleMarkAllNotificationsAsRead() {
  const token = getToken();
  if (!token) return;

  try {
    await markAllNotificationsAsRead(token);
    await loadNotifications();
    await renderNotifications();
  } catch (e) {
    console.error("Erro ao marcar todas as notificações como lidas:", e);
  }
}

function bindEvents() {
  elements.logoutButton.addEventListener("click", clearSessionAndRedirect);
  elements.editProfileButton.addEventListener("click", () => {
    window.location.href = "./profile.html";
  });
  
  // Notification events
  elements.notificationBell.addEventListener("click", toggleNotificationPanel);
  elements.markAllRead.addEventListener("click", handleMarkAllNotificationsAsRead);
  
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
}

// Global functions for onclick handlers
window.applyToJob = applyToJob;
window.viewApplications = viewApplications;
window.updateApplicationStatus = updateApplicationStatus;

async function initialize() {
  bindEvents();
  showFeedback("Carregando plataforma...", "info");
  await refreshAllData();
  await loadNotifications();
  showFeedback("Plataforma pronta para uso.", "success");
  
  // Recarregar notificações a cada 30 segundos
  setInterval(async () => {
    try {
      await loadNotifications();
    } catch (e) {
      console.error("Erro ao atualizar notificações:", e);
    }
  }, 30000);
}

initialize();
