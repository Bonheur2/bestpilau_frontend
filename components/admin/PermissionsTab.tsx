'use client';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAction, useApi } from '@/lib/hooks';
import { ROLE_LABELS } from '@/lib/constants';
import type { Module, PermissionMatrix, Role } from '@/lib/types';
import { Alert, Loader } from '@/components/ui';

export function PermissionsTab() {
  const { data, error, loading, reload } = useApi<PermissionMatrix>('/permissions');
  const { busy, error: actionError, setError, run } = useAction();
  const { can } = useAuth();

  if (!can('permissions')) return null;

  const toggle = (role: Role, module: Module, enabled: boolean) =>
    run(`${role}:${module}`, async () => {
      await api('/permissions', { method: 'PUT', body: { role, module, enabled } });
      await reload();
    });

  return (
    <section className="card">
      <h2>Role permissions</h2>
      <Alert onClose={() => setError(null)}>{actionError}</Alert>
      {error && <Alert>{error.message}</Alert>}
      {loading || !data ? (
        <Loader />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Module</th>
                {data.roles.map((role) => (
                  <th key={role} className="center">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.modules.map((m) => (
                <tr key={m.key}>
                  <td>
                    <strong>{m.label}</strong>
                    <div className="muted small">{m.description}</div>
                  </td>
                  {data.roles.map((role) => (
                    <td key={role} className="center">
                      <input
                        type="checkbox"
                        className="checkbox"
                        aria-label={`${ROLE_LABELS[role]} can use ${m.label}`}
                        checked={data.matrix[role].includes(m.key)}
                        disabled={role === 'ADMIN' || busy === `${role}:${m.key}`}
                        onChange={(e) => toggle(role, m.key, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
