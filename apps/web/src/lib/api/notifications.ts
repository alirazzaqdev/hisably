import { apiRequest } from "@/lib/api-client";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationSummary {
  unread_count: number;
  items: NotificationItem[];
}

export const notificationsApi = {
  list: () => apiRequest<NotificationSummary>("/notifications"),
  markRead: (id: string) => apiRequest<NotificationItem>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => apiRequest<{ marked_read: number }>("/notifications/read-all", { method: "POST" }),
};
