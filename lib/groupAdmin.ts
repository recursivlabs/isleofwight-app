/**
 * Running a group: the calls an owner, admin or moderator makes.
 *
 * Prefer the public SDK methods. The transport fallback keeps the app working
 * until a newly added method reaches the published SDK, then disappears from
 * the runtime path automatically on the next package bump.
 */
export type GroupRole = 'owner' | 'admin' | 'moderator' | 'member';

const RANK: Record<string, number> = { owner: 3, admin: 2, moderator: 1, member: 0 };

export function roleRank(role: string | null | undefined): number {
  return RANK[String(role ?? '')] ?? -1;
}

/** Moderator or higher: the people who run the group. */
export function canRunGroup(role: string | null | undefined): boolean {
  return roleRank(role) >= RANK.moderator;
}

export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'owner': return 'Owner';
    case 'admin': return 'Admin';
    case 'moderator': return 'Moderator';
    default: return '';
  }
}

type Http = {
  get: (path: string, params?: Record<string, unknown>) => Promise<any>;
  post: (path: string, body?: unknown) => Promise<any>;
  put: (path: string, body?: unknown) => Promise<any>;
  patch: (path: string, body?: unknown) => Promise<any>;
  delete: (path: string) => Promise<any>;
};

export function groupAdmin(sdk: any) {
  const communities: Record<string, any> | undefined = sdk?.communities;
  const http: Http | undefined = (sdk?.posts as any)?.client;
  if (!communities) throw new Error('Sign in to manage a group');
  const base = (id: string) => `/communities/${encodeURIComponent(id)}`;
  const member = (id: string, userId: string) => `${base(id)}/members/${encodeURIComponent(userId)}`;
  const call = (method: string, args: unknown[], fallback: (client: Http) => Promise<any>) => {
    const publicMethod = communities[method];
    if (typeof publicMethod === 'function') return publicMethod.apply(communities, args);
    if (!http?.get) throw new Error('Update the Minds SDK to manage this group');
    return fallback(http);
  };
  return {
    update: (id: string, input: { name?: string; description?: string; image?: string | null; banner?: string | null; privacy?: 'public' | 'private' }) =>
      call('update', [id, input], (client) => client.put(base(id), input)),
    remove: (id: string) => call('delete', [id], (client) => client.delete(base(id))),
    members: (id: string, params?: { limit?: number; offset?: number }) =>
      call('members', [id, params], (client) => client.get(`${base(id)}/members`, params)),
    requests: (id: string, params?: { limit?: number; offset?: number }) =>
      call('requests', [id, params], (client) => client.get(`${base(id)}/requests`, params)),
    bans: (id: string, params?: { limit?: number; offset?: number }) =>
      call('bans', [id, params], (client) => client.get(`${base(id)}/bans`, params)),
    approve: (id: string, userId: string) =>
      call('approveMember', [id, userId], (client) => client.post(`${member(id, userId)}/approve`)),
    decline: (id: string, userId: string) =>
      call('declineMember', [id, userId], (client) => client.post(`${member(id, userId)}/decline`)),
    removeMember: (id: string, userId: string) =>
      call('removeMember', [id, userId], (client) => client.delete(member(id, userId))),
    ban: (id: string, userId: string, reason?: string) =>
      call('banMember', [id, userId, reason], (client) => client.post(`${member(id, userId)}/ban`, reason ? { reason } : {})),
    unban: (id: string, userId: string) =>
      call('unbanMember', [id, userId], (client) => client.post(`${member(id, userId)}/unban`)),
    setRole: (id: string, userId: string, role: 'admin' | 'moderator' | 'member') =>
      call('setMemberRole', [id, userId, role], (client) => client.patch(member(id, userId), { role })),
    pinPost: (id: string, postId: string) =>
      call('pinPost', [id, postId], (client) => client.post(`${base(id)}/posts/${encodeURIComponent(postId)}/pin`)),
    unpinPost: (id: string, postId: string) =>
      call('unpinPost', [id, postId], (client) => client.delete(`${base(id)}/posts/${encodeURIComponent(postId)}/pin`)),
    removePost: (id: string, postId: string) =>
      call('removePost', [id, postId], (client) => client.delete(`${base(id)}/posts/${encodeURIComponent(postId)}`)),
    createInvite: (id: string, input?: { role?: 'member' | 'moderator'; expires_days?: number }) =>
      call('createInvite', [id, input], (client) => client.post(`${base(id)}/invites`, input ?? {})),
  };
}
