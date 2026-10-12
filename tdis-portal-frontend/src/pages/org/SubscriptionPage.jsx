import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useKeycloak } from '@/hooks/useKeycloak';
import { formatDate, formatDateRange, formatYesNo } from '@/lib/formatters';
import { tdisAiRequest } from '@/services/tdisAiApi';
import { PageError, PageHeader, StatusBadge } from '../admin/AdminUi';

function SubscriptionField({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function CurrentSubscriptionSection({
  subscription,
  showUpgradeForm,
  setShowUpgradeForm,
  upgradeTier,
  setUpgradeTier,
  upgradeReason,
  setUpgradeReason,
  saving,
  onRequestTierChange,
}) {
  const userCount = subscription?.current_user_count ?? 0;
  const maxUsers = subscription?.max_users ?? 'N/A';

  return (
    <section className="rounded-md border border-border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Current Subscription</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {subscription ? `${userCount} of ${maxUsers} users` : 'No subscription found.'}
          </p>
        </div>
        <StatusBadge>{subscription?.status ?? 'N/A'}</StatusBadge>
      </div>
      {subscription?.access_disabled ? (
        <div className="mt-4 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          Account access is currently disabled. Contact your administrator.
        </div>
      ) : null}
      <dl className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <SubscriptionField label="Tier">{subscription?.tier ?? 'N/A'}</SubscriptionField>
        <SubscriptionField label="Status">{subscription?.status ?? 'N/A'}</SubscriptionField>
        <SubscriptionField label="Access Disabled">
          {formatYesNo(subscription?.access_disabled)}
        </SubscriptionField>
        <SubscriptionField label="Anniversary">
          {formatDate(subscription?.anniversary_date)}
        </SubscriptionField>
        <SubscriptionField label="Next Billing">
          {formatDate(subscription?.next_billing_date)}
        </SubscriptionField>
        <SubscriptionField label="Users">
          {userCount} vs {maxUsers}
        </SubscriptionField>
      </dl>
      {subscription?.pending_tier_change ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Pending tier change: {subscription.pending_tier_change}
        </p>
      ) : null}
      <div className="mt-4">
        <Button type="button" onClick={() => setShowUpgradeForm(true)}>
          Request Upgrade
        </Button>
      </div>
      {showUpgradeForm ? (
        <div className="mt-4 grid gap-3 rounded-md border border-border p-4">
          <div className="grid gap-2">
            <Label htmlFor="tier-change-tier">Tier</Label>
            <Select value={upgradeTier} onValueChange={setUpgradeTier}>
              <SelectTrigger id="tier-change-tier" className="w-48">
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tier-change-reason">Reason</Label>
            <Textarea
              id="tier-change-reason"
              value={upgradeReason}
              onChange={(event) => setUpgradeReason(event.target.value)}
              placeholder="Reason for upgrade"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={saving} onClick={onRequestTierChange}>
              Submit Request
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowUpgradeForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function QuotaSection({ quota }) {
  const allocated = Number(quota?.queries_allocated ?? 0);
  const consumed = Number(quota?.queries_consumed ?? 0);
  const remaining = Number(quota?.queries_remaining ?? Math.max(allocated - consumed, 0));
  const consumedPercent =
    allocated > 0 ? Math.min(100, Math.round((consumed / allocated) * 100)) : 0;
  const remainingPercent = allocated > 0 ? (remaining / allocated) * 100 : 0;
  const progressClass =
    remaining <= 0 ? 'bg-destructive' : remainingPercent < 25 ? 'bg-accent' : 'bg-primary';

  return (
    <section className="rounded-md border border-border p-4">
      <h3 className="text-lg font-semibold">Current Quota</h3>
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span>
            {consumed} / {allocated} queries consumed
          </span>
          <span className="font-semibold">{remaining} remaining</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
          <div className={progressClass} style={{ width: `${consumedPercent}%`, height: '100%' }} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {formatDateRange(quota?.billing_period_start, quota?.billing_period_end)}
        </p>
        {remaining === 0 ? (
          <p className="mt-3 text-sm text-destructive">
            Query limit reached. Resets on {formatDate(quota?.reset_date)}.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SubscriptionPage() {
  const { user, getToken } = useKeycloak();
  const orgId = user?.organization_id;
  const [subscription, setSubscription] = useState(null);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [upgradeTier, setUpgradeTier] = useState('basic');
  const [upgradeReason, setUpgradeReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSubscription = useCallback(async () => {
    if (!orgId) {
      setError('Organisation ID is missing from your session.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const [subscriptionPayload, quotaPayload] = await Promise.all([
        tdisAiRequest(token, `/organizations/${encodeURIComponent(orgId)}/subscriptions/current`),
        tdisAiRequest(token, `/organizations/${encodeURIComponent(orgId)}/quotas/current`),
      ]);
      setSubscription(subscriptionPayload?.subscription ?? subscriptionPayload);
      setQuota(quotaPayload?.quota ?? quotaPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, [getToken, orgId]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const requestTierChange = async () => {
    if (!orgId) return;
    setSaving(true);
    setError(null);
    try {
      await tdisAiRequest(
        getToken(),
        `/organizations/${encodeURIComponent(orgId)}/subscriptions/tier-change`,
        {
          method: 'POST',
          body: { tier: upgradeTier, reason: upgradeReason },
        }
      );
      setShowUpgradeForm(false);
      setUpgradeReason('');
      await loadSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request tier change');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <PageHeader
        title="Subscription"
        description="Review current tier, quota, and upgrade requests."
      />
      {error ? <PageError message={error} onRetry={loadSubscription} /> : null}
      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="grid gap-6">
          <CurrentSubscriptionSection
            subscription={subscription}
            showUpgradeForm={showUpgradeForm}
            setShowUpgradeForm={setShowUpgradeForm}
            upgradeTier={upgradeTier}
            setUpgradeTier={setUpgradeTier}
            upgradeReason={upgradeReason}
            setUpgradeReason={setUpgradeReason}
            saving={saving}
            onRequestTierChange={requestTierChange}
          />
          <QuotaSection quota={quota} />
        </div>
      )}
    </section>
  );
}

export default SubscriptionPage;
