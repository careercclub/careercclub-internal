// Modules a Claude access key can be allowed to update. Shared by Settings (browser) and the
// API (server); no runtime imports.
export const AGENT_MODULES = [
  { id: "job-vacancy-mt", label: "Job Vacancy MT" },
  { id: "instagram", label: "Instagram & Content Evaluation" },
  { id: "customer-knowledge", label: "Customer Knowledge" },
] as const;
export type AgentModule = (typeof AGENT_MODULES)[number]["id"];

export function isAgentModule(value: string): value is AgentModule {
  return AGENT_MODULES.some((module) => module.id === value);
}
