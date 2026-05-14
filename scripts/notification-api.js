import { API_BASE_URL } from "./config.js";

export async function getNotifications(token, limit = 20, offset = 0) {
  const response = await fetch(
    `${API_BASE_URL}/marketplace/notifications?limit=${limit}&offset=${offset}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      mode: "cors",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erro ao carregar notificações");
  }

  return data;
}

export async function markNotificationAsRead(token, notificationId) {
  const response = await fetch(
    `${API_BASE_URL}/marketplace/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      mode: "cors",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erro ao marcar notificação como lida");
  }

  return data;
}

export async function markAllNotificationsAsRead(token) {
  const response = await fetch(
    `${API_BASE_URL}/marketplace/notifications/read-all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      mode: "cors",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erro ao marcar notificações como lidas");
  }

  return data;
}

export async function deleteNotification(token, notificationId) {
  const response = await fetch(
    `${API_BASE_URL}/marketplace/notifications/${notificationId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      mode: "cors",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erro ao deletar notificação");
  }

  return data;
}
