import { fetchApi } from './client';

export type UserRole = 'admin' | 'team';

export type TeamProfile = {
  id: string;
  name: string;
  tag?: string | null;
  identifier?: string;
};

export type AuthUser = {
  id: string;
  identifier: string;
  role: UserRole;
  team?: TeamProfile | null;
};

export type AdminTeamItem = {
  id: string;
  userId: string;
  identifier: string;
  name: string;
  tag: string | null;
  enabled: boolean;
  createdAt: string;
};

export async function loginApi(payload: { identifier: string; password: string }): Promise<AuthUser> {
  const res = await fetchApi<{ user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.user;
}

export async function logoutApi(): Promise<void> {
  await fetchApi<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
  });
}

export async function getMeApi(): Promise<AuthUser> {
  const res = await fetchApi<{ user: AuthUser }>('/auth/me', {
    method: 'GET',
  });
  return res.user;
}

export async function getTeamMeApi(): Promise<{ team: TeamProfile; inventorySummary: unknown }> {
  return fetchApi<{ team: TeamProfile; inventorySummary: unknown }>('/teams/me', {
    method: 'GET',
  });
}

export async function adminListTeamsApi(): Promise<AdminTeamItem[]> {
  const res = await fetchApi<{ teams: AdminTeamItem[] }>('/admin/teams', {
    method: 'GET',
  });
  return res.teams;
}

export async function adminCreateTeamApi(data: {
  identifier: string;
  password: string;
  name: string;
  tag?: string;
}): Promise<AdminTeamItem> {
  const res = await fetchApi<{ team: AdminTeamItem }>('/admin/teams', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.team;
}

export async function adminResetTeamPasswordApi(
  teamId: string,
  password: string,
): Promise<{ ok: boolean }> {
  return fetchApi<{ ok: boolean }>(`/admin/teams/${teamId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function adminDisableTeamApi(teamId: string): Promise<AdminTeamItem> {
  const res = await fetchApi<{ team: AdminTeamItem }>(`/admin/teams/${teamId}/disable`, {
    method: 'POST',
  });
  return res.team;
}

export async function adminEnableTeamApi(teamId: string): Promise<AdminTeamItem> {
  const res = await fetchApi<{ team: AdminTeamItem }>(`/admin/teams/${teamId}/enable`, {
    method: 'POST',
  });
  return res.team;
}
