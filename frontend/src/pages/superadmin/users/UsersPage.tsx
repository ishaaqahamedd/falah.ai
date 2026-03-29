import { useEffect, useState, useCallback } from 'react';
import { Card } from '../../../shared/ui/Card';
import { Button } from '../../../shared/ui/Button';
import { Avatar } from '../../../shared/ui/Avatar';
import { StatusDot } from '../../../shared/ui/StatusDot';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { SearchInput } from '../../../shared/ui/SearchInput';
import { UserCircleIcon, ChevronLeftIcon, ChevronRightIcon } from '../../../shared/ui/Icons';
import { fetchAdminUsers } from '../../../features/superadmin/api';
import type { AdminUser } from '../../../features/superadmin/types';

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'text-purple-400 bg-purple-400/10',
  admin:      'text-blue-400   bg-blue-400/10',
  creator:    'text-amber-400  bg-amber-400/10',
  user:       'text-text-muted bg-surface-tertiary',
};

const ROLE_OPTIONS = ['', 'user', 'creator', 'admin'];

export function UsersPage() {
  const [users, setUsers]   = useState<AdminUser[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole]     = useState('');
  const [loading, setLoading] = useState(true);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminUsers({ page, limit, search, role: role || undefined });
      setUsers(res.users);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, search, role]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1); }, [search, role]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Users</h1>
        <p className="text-sm text-text-muted mt-0.5">{total} total users on the platform</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or email..."
          className="flex-1 max-w-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-3 py-2.5 bg-surface border border-border-primary rounded-lg text-sm text-text-primary focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.filter(Boolean).map((r) => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card padding="sm" className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-text-muted text-sm">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UserCircleIcon className="w-10 h-10" />}
            title="No users found"
            description="Try adjusting your search or filter."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary text-left">
                <th className="px-4 py-3 text-text-muted font-medium">User</th>
                <th className="px-4 py-3 text-text-muted font-medium">Role</th>
                <th className="px-4 py-3 text-text-muted font-medium">Status</th>
                <th className="px-4 py-3 text-text-muted font-medium">Sessions</th>
                <th className="px-4 py-3 text-text-muted font-medium">Agents</th>
                <th className="px-4 py-3 text-text-muted font-medium">Joined</th>
                <th className="px-4 py-3 text-text-muted font-medium">Auth</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr
                  key={u.id}
                  className={[
                    'border-b border-border-primary last:border-0',
                    i % 2 === 0 ? '' : 'bg-surface/40',
                  ].join(' ')}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.full_name} size="sm" />
                      <div>
                        <p className="font-medium text-text-primary leading-tight">{u.full_name}</p>
                        <p className="text-text-muted text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${ROLE_COLORS[u.role] ?? ROLE_COLORS.user}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusDot color={u.is_active ? 'emerald' : 'red'} />
                      <span className="text-text-secondary">{u.is_active ? 'Active' : 'Banned'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-primary font-medium">{u.session_count}</td>
                  <td className="px-4 py-3 text-text-primary font-medium">{u.agent_count}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-text-muted capitalize">{u.auth_provider}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-text-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              intent="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </Button>
            <Button
              intent="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
