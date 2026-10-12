import React, { useCallback, useEffect, useState } from 'react';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKeycloak } from '@/hooks/useKeycloak';
import { formatDate } from '@/lib/formatters';
import { getListItems, getTotalCount, tdisAiRequest } from '@/services/tdisAiApi';
import { PageError, PageHeader, StatusBadge } from './AdminUi';

const LIMIT = 20;

function SignupRequestsPage() {
  const { getToken } = useKeycloak();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [savingId, setSavingId] = useState(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await tdisAiRequest(getToken(), '/signup/admin/signup-requests', {
        params: { limit: LIMIT, offset },
      });
      const items = getListItems(payload, ['signup_requests', 'requests']);
      setRequests(items);
      setTotal(getTotalCount(payload, items.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load signup requests');
    } finally {
      setLoading(false);
    }
  }, [getToken, offset]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const approveRequest = async (request) => {
    setSavingId(request.id);
    setError(null);
    try {
      await tdisAiRequest(
        getToken(),
        `/signup/admin/signup-requests/${encodeURIComponent(request.id)}/approve`,
        {
          method: 'POST',
          body: {},
        }
      );
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve signup request');
    } finally {
      setSavingId(null);
    }
  };

  const rejectRequest = async (request) => {
    setSavingId(request.id);
    setError(null);
    try {
      await tdisAiRequest(
        getToken(),
        `/signup/admin/signup-requests/${encodeURIComponent(request.id)}/reject`,
        {
          method: 'POST',
          body: { rejection_reason: rejectionReason },
        }
      );
      setRejectingId(null);
      setRejectionReason('');
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject signup request');
    } finally {
      setSavingId(null);
    }
  };

  const columns = [
    { key: 'org_name', label: 'Organisation' },
    { key: 'org_type', label: 'Org Type' },
    { key: 'admin_name', label: 'Admin Name' },
    { key: 'admin_email', label: 'Admin Email' },
    { key: 'created_at', label: 'Created', render: (value) => formatDate(value) },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge>{value ?? 'N/A'}</StatusBadge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => {
        const status = String(row.status ?? '').toLowerCase();
        if (status !== 'pending') {
          return <StatusBadge>{row.status ?? 'N/A'}</StatusBadge>;
        }
        return (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={savingId === row.id}
              onClick={() => approveRequest(row)}
            >
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={savingId === row.id}
              onClick={() => {
                setRejectingId(row.id);
                setRejectionReason('');
              }}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  const renderExpandedRow = (row) => {
    if (row.id !== rejectingId) return null;
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={rejectionReason}
          onChange={(event) => setRejectionReason(event.target.value)}
          placeholder="Rejection reason"
          aria-label="Rejection reason"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="destructive"
            disabled={savingId === row.id}
            onClick={() => rejectRequest(row)}
          >
            Confirm Reject
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setRejectingId(null);
              setRejectionReason('');
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  return (
    <section>
      <PageHeader
        title="Signup Requests"
        description="Review and approve organisation signup requests."
      />
      {error ? <PageError message={error} onRetry={loadRequests} /> : null}
      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={requests}
          loading={loading}
          empty="No pending signup requests."
          renderExpandedRow={renderExpandedRow}
        />
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {requests.length} of {total}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={offset + LIMIT >= total || loading}
            onClick={() => setOffset(offset + LIMIT)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}

export default SignupRequestsPage;
