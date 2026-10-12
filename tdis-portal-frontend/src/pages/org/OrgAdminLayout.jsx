import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useKeycloak } from '@/hooks/useKeycloak';
import { getOrganisationName, getOrganisationPayload } from '@/lib/organisations';
import { isAdmin } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { tdisAiRequest } from '@/services/tdisAiApi';

const navItems = [
  { label: 'Members', path: '/org/members' },
  { label: 'Subscription', path: '/org/subscription' },
  { label: 'Billing', path: '/org/billing' },
];

const adminThemeStyle = {
  '--primary': '#324755',
  '--primary-foreground': '#ffffff',
  '--secondary': '#F0F3F4',
  '--secondary-foreground': '#324755',
  '--muted': '#F0F3F4',
  '--muted-foreground': '#334755',
  '--accent': '#F0F3F4',
  '--accent-foreground': '#324755',
  '--border': '#CBD1D3',
  '--input': '#CBD1D3',
  '--ring': '#87BCBF',
};

const headerOutlineButtonClass =
  'border-white/35 bg-transparent text-white hover:border-white hover:bg-white/10 hover:text-white';

const headerPrimaryButtonClass =
  'border-white bg-white text-[#324755] hover:bg-[#F0F3F4] hover:text-[#324755]';

function OrgAdminLayout() {
  const { initialising, authenticated, user, logout, getToken } = useKeycloak();
  const navigate = useNavigate();
  const location = useLocation();
  const [organisation, setOrganisation] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const organisationName = getOrganisationName(organisation);

  useEffect(() => {
    if (!authenticated || !isAdmin(user?.roles) || !user?.organization_id) return;

    let cancelled = false;
    setLoadingOrg(true);
    tdisAiRequest(getToken(), `/organizations/${encodeURIComponent(user.organization_id)}`)
      .then((payload) => {
        if (!cancelled) {
          setOrganisation(getOrganisationPayload(payload));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOrganisation(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOrg(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authenticated, getToken, user?.organization_id, user?.roles]);

  if (initialising) {
    return (
      <div className="min-h-screen bg-[#F0F3F4] p-6 text-[#324755]" style={adminThemeStyle}>
        <div className="rounded-lg border border-[#CBD1D3] bg-white p-6">
          <Skeleton className="h-10 w-64" />
          <div className="mt-6 grid gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin(user?.roles)) {
    return (
      <div className="min-h-screen bg-[#F0F3F4] p-6 text-[#324755]" style={adminThemeStyle}>
        <div className="mx-auto max-w-xl rounded-lg border border-[#CBD1D3] bg-white p-6">
          <h1 className="text-xl font-bold">Access denied</h1>
          <p className="mt-2 text-sm text-[#334755]/80">Access denied. Org Admin role required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F3F4] text-[#324755]" style={adminThemeStyle}>
      <header className="flex min-h-16 items-center justify-between bg-[#324755] px-6 py-3 text-white">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Org Admin</p>
          <h1 className="truncate text-xl font-bold">
            {loadingOrg
              ? 'Loading organisation'
              : (organisationName ?? user?.organization_id ?? 'Organisation')}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={headerOutlineButtonClass}
            onClick={() => navigate('/?tab=ai-assistant')}
          >
            Main Page
          </Button>
          <Button
            type="button"
            variant="outline"
            className={headerOutlineButtonClass}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            className={headerPrimaryButtonClass}
            onClick={logout}
          >
            Logout
          </Button>
        </div>
      </header>
      <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="border-b border-[#CBD1D3] bg-white p-4 md:border-b-0 md:border-r">
          <div className="mb-4 rounded-lg bg-[#F0F3F4] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#334755]/70">
              Navigation
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[#324755]">
              {organisationName ?? 'Organisation workspace'}
            </p>
          </div>
          <nav className="grid gap-1">
            {navItems.map((item) => {
              const active = location.pathname.startsWith(item.path);
              return (
                <Button
                  key={item.path}
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-11 justify-start rounded-lg px-4 text-[#324755] hover:bg-[#F0F3F4]',
                    active
                      ? 'bg-[#324755] font-semibold text-white hover:bg-[#334755] hover:text-white'
                      : ''
                  )}
                  onClick={() => navigate(item.path)}
                >
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <Separator />
    </div>
  );
}

export default OrgAdminLayout;
