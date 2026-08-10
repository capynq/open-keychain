export type ExportIntent = {
  token: string;
  expiresAt: string;
};
export type HostedUser = {
  id: string;
  name: string;
  email: string;
};
export type HostedProject = {
  id: string;
  name: string;
  params: Record<string, unknown>;
  thumbnail?: string | null;
  schema_version: number;
  created_at: string;
  updated_at: string;
};
export const hostedMode = import.meta.env.VITE_HOSTED_MODE === 'true';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? `Hosted API request failed (${response.status}).`);
  }
  return (await response.json()) as T;
};
export const requestExportIntent = (): Promise<ExportIntent> => {
  return apiRequest<ExportIntent>('/api/usage/export-intent', { method: 'POST' });
};
export const completeExportIntent = (
  token: string,
): Promise<{
  recorded: boolean;
}> => {
  return apiRequest<{
    recorded: boolean;
  }>(`/api/usage/export-complete/${encodeURIComponent(token)}`, {
    method: 'POST',
  });
};
export const currentUser = async (): Promise<HostedUser | undefined> => {
  try {
    return (
      await apiRequest<{
        user: HostedUser;
      }>('/api/me')
    ).user;
  } catch {
    return undefined;
  }
};
export const signUp = (
  name: string,
  email: string,
  password: string,
): Promise<{
  user: HostedUser;
}> => {
  return apiRequest<{
    user: HostedUser;
  }>('/api/auth/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
};
export const signIn = (
  email: string,
  password: string,
): Promise<{
  user: HostedUser;
}> => {
  return apiRequest<{
    user: HostedUser;
  }>('/api/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};
export const signOut = async (): Promise<void> => {
  await apiRequest('/api/auth/sign-out', { method: 'POST' });
};
export const listProjects = async (): Promise<HostedProject[]> => {
  return (
    await apiRequest<{
      projects: HostedProject[];
    }>('/api/projects')
  ).projects;
};
export const saveProject = (
  name: string,
  params: Record<string, unknown>,
): Promise<{
  project: HostedProject;
}> => {
  return apiRequest<{
    project: HostedProject;
  }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, params }),
  });
};
