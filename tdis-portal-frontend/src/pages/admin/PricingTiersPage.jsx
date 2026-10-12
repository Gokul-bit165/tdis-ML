import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useKeycloak } from '@/hooks/useKeycloak';
import { formatDate, formatMoneyCents, formatYesNo } from '@/lib/formatters';
import { getListItems, tdisAiRequest } from '@/services/tdisAiApi';
import { PageError, PageHeader, StatusBadge } from './AdminUi';

const orgTypes = ['university', 'state', 'corporate'];
const tiers = ['free', 'basic', 'pro', 'enterprise'];

function buildEditState(tier) {
  return {
    monthly_query_limit: tier?.monthly_query_limit ?? '',
    max_users: tier?.max_users ?? '',
    monthly_price_dollars: Number(tier?.monthly_price_cents ?? 0) / 100,
    description: tier?.description ?? '',
  };
}

function PricingTiersPage() {
  const { getToken } = useKeycloak();
  const [pricingTiers, setPricingTiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [editForm, setEditForm] = useState(buildEditState());
  const [saving, setSaving] = useState(false);

  const loadPricing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await tdisAiRequest(getToken(), '/admin/pricing-tiers');
      setPricingTiers(getListItems(payload, ['pricing_tiers', 'tiers']));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing tiers');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  const pricingMap = useMemo(() => {
    const map = new Map();
    pricingTiers.forEach((item) => {
      map.set(`${String(item.org_type).toLowerCase()}-${String(item.tier).toLowerCase()}`, item);
    });
    return map;
  }, [pricingTiers]);

  const startEdit = (orgType, tier, data) => {
    setEditingKey(`${orgType}-${tier}`);
    setEditForm(buildEditState(data));
  };

  const saveEdit = async (orgType, tier) => {
    setSaving(true);
    setError(null);
    try {
      await tdisAiRequest(
        getToken(),
        `/admin/pricing-tiers/${encodeURIComponent(tier)}/${encodeURIComponent(orgType)}`,
        {
          method: 'PUT',
          body: {
            monthly_query_limit: Number(editForm.monthly_query_limit),
            max_users: Number(editForm.max_users),
            monthly_price_cents: Math.round(Number(editForm.monthly_price_dollars) * 100),
            description: editForm.description,
          },
        }
      );
      setEditingKey(null);
      await loadPricing();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing tier');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <PageHeader
        title="Pricing Tiers"
        description="Manage pricing and limits by organisation type."
      />
      {error ? <PageError message={error} onRetry={loadPricing} /> : null}
      {loading ? (
        <div className="mt-4 grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-6">
          {orgTypes.map((orgType) => (
            <section key={orgType} className="rounded-md border border-border p-4">
              <h3 className="text-lg font-semibold capitalize">{orgType}</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                {tiers.map((tier) => {
                  const key = `${orgType}-${tier}`;
                  const data = pricingMap.get(key);
                  const isEditing = editingKey === key;
                  return (
                    <div key={key} className="rounded-md border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-semibold capitalize">{tier}</h4>
                        <StatusBadge>
                          {data?.is_active == null ? 'N/A' : formatYesNo(data.is_active)}
                        </StatusBadge>
                      </div>

                      {isEditing ? (
                        <div className="mt-4 grid gap-3">
                          <div className="grid gap-2">
                            <Label htmlFor={`${key}-query-limit`}>Monthly query limit</Label>
                            <Input
                              id={`${key}-query-limit`}
                              type="number"
                              value={editForm.monthly_query_limit}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  monthly_query_limit: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`${key}-max-users`}>Max users</Label>
                            <Input
                              id={`${key}-max-users`}
                              type="number"
                              value={editForm.max_users}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  max_users: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`${key}-price`}>Monthly price</Label>
                            <Input
                              id={`${key}-price`}
                              type="number"
                              value={editForm.monthly_price_dollars}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  monthly_price_dollars: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`${key}-description`}>Description</Label>
                            <Input
                              id={`${key}-description`}
                              value={editForm.description}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  description: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              disabled={saving}
                              onClick={() => saveEdit(orgType, tier)}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setEditingKey(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-2 text-sm">
                          <p>
                            <span className="font-medium">Queries:</span>{' '}
                            {data?.monthly_query_limit ?? 'N/A'}
                          </p>
                          <p>
                            <span className="font-medium">Max users:</span>{' '}
                            {data?.max_users ?? 'N/A'}
                          </p>
                          <p>
                            <span className="font-medium">Price:</span>{' '}
                            {formatMoneyCents(data?.monthly_price_cents)}
                          </p>
                          <p>
                            <span className="font-medium">Effective:</span>{' '}
                            {formatDate(data?.effective_from)}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => startEdit(orgType, tier, data)}
                          >
                            Edit
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

export default PricingTiersPage;
