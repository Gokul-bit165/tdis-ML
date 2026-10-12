import React, { useCallback, useEffect, useState } from 'react';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { useKeycloak } from '@/hooks/useKeycloak';
import { formatActor, formatDate, formatMoneyCents } from '@/lib/formatters';
import { getListItems, getTotalCount, tdisAiRequest } from '@/services/tdisAiApi';
import { PageError, PageHeader } from '../admin/AdminUi';

const LIMIT = 20;

const columns = [
  { key: 'billing_period_start', label: 'Period Start', render: (value) => formatDate(value) },
  { key: 'renewal_date', label: 'Renewal Date', render: (value) => formatDate(value) },
  { key: 'amount_cents', label: 'Amount', render: (value) => formatMoneyCents(value, true) },
  { key: 'actioned_by', label: 'Actioned By', render: (value) => formatActor(value, true) },
];

function BillingPage() {
  const { user, getToken } = useKeycloak();
  const orgId = user?.organization_id;
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const loadInvoices = useCallback(async () => {
    if (!orgId) {
      setError('Organisation ID is missing from your session.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await tdisAiRequest(
        getToken(),
        `/organizations/${encodeURIComponent(orgId)}/billing/invoices`,
        {
          params: { limit: LIMIT, offset },
        }
      );
      const items = getListItems(payload, ['invoices']);
      setInvoices(items);
      setTotal(getTotalCount(payload, items.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing history');
    } finally {
      setLoading(false);
    }
  }, [getToken, offset, orgId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  return (
    <section>
      <PageHeader title="Billing" description="View organisation billing history." />
      {error ? <PageError message={error} onRetry={loadInvoices} /> : null}
      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={invoices}
          loading={loading}
          empty="No billing records yet."
        />
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {invoices.length} of {total}
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

export default BillingPage;
