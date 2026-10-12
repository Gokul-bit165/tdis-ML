import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useKeycloak } from '@/hooks/useKeycloak';
import { formatDate, formatYesNo } from '@/lib/formatters';
import { getOrganisationName } from '@/lib/organisations';
import { getListItems, getTotalCount, tdisAiRequest } from '@/services/tdisAiApi';
import { PageError, PageHeader, StatusBadge } from './AdminUi';

const LIMIT = 20;

const columns = [
  { key: 'name', label: 'Name', render: (_, row) => getOrganisationName(row) ?? 'N/A' },
  { key: 'org_type', label: 'Org Type' },
  { key: 'current_tier', label: 'Current Tier' },
  {
    key: 'subscription_status',
    label: 'Subscription',
    render: (value) => <StatusBadge>{value ?? 'N/A'}</StatusBadge>,
  },
  { key: 'access_disabled', label: 'Access Disabled', render: (value) => formatYesNo(value) },
  { key: 'current_user_count', label: 'Users' },
  { key: 'next_billing_date', label: 'Next Billing', render: (value) => formatDate(value) },
  { key: 'created_at', label: 'Created', render: (value) => formatDate(value) },
];

function OrganisationsPage() {
  const { getToken } = useKeycloak();
  const navigate = useNavigate();
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [orgTypeFilter, setOrgTypeFilter] = useState('all');

  const loadOrganisations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await tdisAiRequest(getToken(), '/organizations', {
        params: {
          limit: LIMIT,
          offset,
          org_type: orgTypeFilter === 'all' ? undefined : orgTypeFilter,
        },
      });
      const items = getListItems(payload, ['organizations', 'organisations']);
      setOrganisations(items);
      setTotal(getTotalCount(payload, items.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organisations');
    } finally {
      setLoading(false);
    }
  }, [getToken, offset, orgTypeFilter]);

  useEffect(() => {
    loadOrganisations();
  }, [loadOrganisations]);

  const handleFilterChange = (value) => {
    setOrgTypeFilter(value);
    setOffset(0);
  };

  return (
    <section>
      <PageHeader
        title="Organisations"
        description="Monitor organisation subscription and usage state."
        action={
          <Select value={orgTypeFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Org type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="university">University</SelectItem>
              <SelectItem value="state">State</SelectItem>
              <SelectItem value="corporate">Corporate</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      {error ? <PageError message={error} onRetry={loadOrganisations} /> : null}
      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={organisations}
          loading={loading}
          empty="No organisations found."
          onRowClick={(row) => {
            const id = row.id ?? row.organization_id;
            if (id) navigate(`/admin/organisations/${encodeURIComponent(id)}`);
          }}
        />
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {organisations.length} of {total}
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

export default OrganisationsPage;
