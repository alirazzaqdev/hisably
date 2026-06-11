import { apiUpload } from "@/lib/api-client";

export interface Attachment {
  id: string;
  entity_type: string;
  file_url: string;
  file_type: string;
}

export const attachmentsApi = {
  upload: (file: File, entityType: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entity_type", entityType);
    return apiUpload<Attachment>("/attachments", formData);
  },
};
