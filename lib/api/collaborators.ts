import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type CollaboratorRecord = ApiRecord & {
  nama: string;
  tipe: "collaborator" | "advisor";
  rekening?: string | null;
  privy?: boolean;
  kewajiban?: string[];
  services?: Array<{ label?: string; rate?: string }>;
  background?: string | null;
  status?: string | null;
  catatan?: string | null;
  foto_url?: string | null;
};

const collaborators = createTableApi<CollaboratorRecord>("collaborators", {
  orderBy: "created_at",
  ascending: true,
});

export const listCollaborators = collaborators.list;
export const countCollaborators = collaborators.count;
export const getCollaborator = collaborators.get;
export const createCollaborator = collaborators.create;
export const updateCollaborator = collaborators.update;
export const deleteCollaborator = collaborators.remove;
