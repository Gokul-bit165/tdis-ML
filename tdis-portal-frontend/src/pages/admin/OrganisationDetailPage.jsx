import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useKeycloak } from '@/hooks/useKeycloak';
import { formatActor, formatDate, formatMoneyCents, formatYesNo } from '@/lib/formatters';
import { getOrganisationName, getOrganisationPayload } from '@/lib/organisations';
import { getListItems, tdisAiRequest } from '@/services/tdisAiApi';
import { PageError, PageHeader, StatusBadge } from './AdminUi';

const invoiceColumns = [
  { key: 'billing_period_start', label: 'Period Start', render: (value) => formatDate(value) },
  { key: 'renewal_date', label: 'Renewal Date', render: (value) => formatDate(value) },
  { key: 'amount_cents', label: 'Amount', render: (value) => formatMoneyCents(value) },
  { key: 'actioned_by', label: 'Actioned By', render: (value) => formatActor(value) },
];

function DetailRow({ label, value }) {
  return (
    <div className="grid gap-1 rounded-md border border-border p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm text-foreground">{value ?? 'N/A'}</dd>
    </div>
  );
}

DetailRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
};

function OrganisationDetailPage() {
  const { id } = useParams();
  const { getToken } = useKeycloak();
  const [organisation, setOrganisation] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const [orgPayload, invoicePayload] = await Promise.all([
        tdisAiRequest(token, `/organizations/${encodeURIComponent(id)}`),
        tdisAiRequest(token, `/organizations/${encodeURIComponent(id)}/billing/invoices`),
      ]);
      setOrganisation(getOrganisationPayload(orgPayload));
      setInvoices(getListItems(invoicePayload, ['invoices']));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organisation detail');
    } finally {
      setLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const subscription =
    organisation?.subscription ?? organisation?.current_subscription ?? organisation ?? {};
  const organisationName = getOrganisationName(organisation);
  const renewalEligible =
    typeof subscription.renewal_eligible === 'boolean'
      ? subscription.renewal_eligible
      : !subscription.skip_renewal;

  const runSubscriptionAction = async (path, body = {}) => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await tdisAiRequest(getToken(), `/organizations/${encodeURIComponent(id)}${path}`, {
        method: path === '/subscriptions/renewal-eligibility' ? 'PATCH' : 'POST',
        body,
      });
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <PageHeader
        title="Organisation Detail"
        description="Review subscription, access, and billing history."
      />
      {error ? <PageError message={error} onRetry={loadDetail} /> : null}
      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="grid gap-6">
          <section className="rounded-md border border-border p-4">
            <h3 className="text-lg font-semibold">Organisation Details</h3>
            <dl className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="Name" value={organisationName} />
              <DetailRow label="Org Type" value={organisation?.org_type} />
              <DetailRow label="Admin Email" value={organisation?.admin_email} />
              <DetailRow label="Tenant ID" value={organisation?.tenant_id} />
              <DetailRow label="Created" value={formatDate(organisation?.created_at)} />
            </dl>
          </section>

          <section className="rounded-md border border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Subscription</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage renewal and access state.
                </p>
              </div>
              <StatusBadge>{subscription.status ?? 'N/A'}</StatusBadge>
            </div>
            <dl className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="Tier" value={subscription.tier ?? organisation?.current_tier} />
              <DetailRow
                label="Status"
                value={subscription.status ?? organisation?.subscription_status}
              />
              <DetailRow
                label="Access Disabled"
                value={formatYesNo(subscription.access_disabled)}
              />
              <DetailRow
                label="Anniversary Date"
                value={formatDate(subscription.anniversary_date)}
              />
              <DetailRow
                label="Next Billing Date"
                value={formatDate(subscription.next_billing_date)}
              />
              <DetailRow label="Current User Count" value={subscription.current_user_count} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {subscription.status === 'active' ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={saving}
                  onClick={() => runSubscriptionAction('/subscriptions/cancel')}
                >
                  Cancel
                </Button>
              ) : null}
              {subscription.status === 'cancelled' || subscription.status === 'free_expired' ? (
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => runSubscriptionAction('/subscriptions/reactivate')}
                >
                  Reactivate
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() =>
                  runSubscriptionAction('/subscriptions/renewal-eligibility', {
                    renewal_eligible: !renewalEligible,
                  })
                }
              >
                {renewalEligible ? 'Skip Renewal' : 'Enable Renewal'}
              </Button>
            </div>
          </section>

          <section className="rounded-md border border-border p-4">
            <h3 className="text-lg font-semibold">Billing History</h3>
            <div className="mt-4">
              <DataTable
                columns={invoiceColumns}
                rows={invoices}
                loading={loading}
                empty="No billing records yet."
              />
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default OrganisationDetailPage;
