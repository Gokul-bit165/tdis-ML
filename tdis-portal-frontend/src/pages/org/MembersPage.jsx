import React, { useCallback, useEffect, useState } from 'react';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useKeycloak } from '@/hooks/useKeycloak';
import { formatDate } from '@/lib/formatters';
import { ROLES } from '@/lib/roles';
import { getListItems, tdisAiRequest } from '@/services/tdisAiApi';
import { PageError, PageHeader, StatusBadge } from '../admin/AdminUi';

function getMemberId(member) {
  return member.id ?? member.user_id ?? member.member_id;
}

function MembersPage() {
  const { user, getToken } = useKeycloak();
  const orgId = user?.organization_id;
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [changingId, setChangingId] = useState(null);
  const [nextRole, setNextRole] = useState(ROLES.USER);
  const [removingId, setRemovingId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const loadMembers = useCallback(async () => {
    if (!orgId) {
      setError('Organisation ID is missing from your session.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await tdisAiRequest(
        getToken(),
        `/organizations/${encodeURIComponent(orgId)}/members`
      );
      setMembers(getListItems(payload, ['members']));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [getToken, orgId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const inviteMember = async () => {
    if (!orgId || !inviteEmail.trim()) return;
    setSavingId('invite');
    setError(null);
    try {
      await tdisAiRequest(getToken(), `/organizations/${encodeURIComponent(orgId)}/members`, {
        method: 'POST',
        body: { username: inviteEmail.trim(), role: ROLES.USER },
      });
      setInviteEmail('');
      setShowInviteForm(false);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setSavingId(null);
    }
  };

  const updateRole = async (member) => {
    const memberId = getMemberId(member);
    if (!orgId || !memberId) return;
    setSavingId(memberId);
    setError(null);
    try {
      await tdisAiRequest(
        getToken(),
        `/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}/role`,
        {
          method: 'PATCH',
          body: { role: nextRole },
        }
      );
      setChangingId(null);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member role');
    } finally {
      setSavingId(null);
    }
  };

  const runMemberAction = async (member, action, method = 'POST') => {
    const memberId = getMemberId(member);
    if (!orgId || !memberId) return;
    setSavingId(memberId);
    setError(null);
    try {
      await tdisAiRequest(
        getToken(),
        `/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}${action}`,
        {
          method,
        }
      );
      setRemovingId(null);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member');
    } finally {
      setSavingId(null);
    }
  };

  const renderActions = (member) => {
    const memberId = getMemberId(member);
    const isSelf = [memberId, member.user_id, member.keycloak_id].includes(user?.user_id);
    if (isSelf) {
      return <StatusBadge>Current user</StatusBadge>;
    }

    if (changingId === memberId) {
      return (
        <div className="grid gap-2">
          <Select value={nextRole} onValueChange={setNextRole}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROLES.USER}>User</SelectItem>
              <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={savingId === memberId}
              onClick={() => updateRole(member)}
            >
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setChangingId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    if (removingId === memberId) {
      return (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">Are you sure?</p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={savingId === memberId}
              onClick={() => runMemberAction(member, '', 'DELETE')}
            >
              Remove
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setRemovingId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    const status = String(member.status ?? '').toLowerCase();
    return (
      <div className="flex flex-wrap gap-2">
        {status === 'active' ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setChangingId(memberId);
                setNextRole(member.role ?? ROLES.USER);
              }}
            >
              Change Role
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={savingId === memberId}
              onClick={() => runMemberAction(member, '/suspend')}
            >
              Suspend
            </Button>
          </>
        ) : null}
        {status === 'suspended' ? (
          <Button
            type="button"
            size="sm"
            disabled={savingId === memberId}
            onClick={() => runMemberAction(member, '/reactivate')}
          >
            Reactivate
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={() => setRemovingId(memberId)}>
          Remove
        </Button>
      </div>
    );
  };

  const columns = [
    { key: 'username', label: 'Username' },
    { key: 'role', label: 'Role' },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge>{value ?? 'N/A'}</StatusBadge>,
    },
    { key: 'joined_at', label: 'Joined', render: (value) => formatDate(value) },
    { key: 'actions', label: 'Actions', render: (_, row) => renderActions(row) },
  ];

  return (
    <section>
      <PageHeader
        title="Members"
        description="Invite, suspend, and manage organisation members."
        action={
          <Button type="button" onClick={() => setShowInviteForm(true)}>
            Invite Member
          </Button>
        }
      />
      {showInviteForm ? (
        <div className="mb-4 rounded-md border border-border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="Member email"
              aria-label="Member email"
            />
            <Button type="button" disabled={savingId === 'invite'} onClick={inviteMember}>
              Invite
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowInviteForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <PageError message={error} onRetry={loadMembers} /> : null}
      <div className="mt-4">
        <DataTable columns={columns} rows={members} loading={loading} empty="No members found." />
      </div>
    </section>
  );
}

export default MembersPage;
