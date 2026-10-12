import { useCallback, useEffect, useRef, useState } from 'react';
import keycloak from '@/services/keycloak';

const REFRESH_INTERVAL_MS = 60_000;
const UPDATE_TOKEN_MIN_VALIDITY_SEC = 70;

const AUTH_ERROR_MESSAGE = 'Authentication service unavailable. Please try again.';

/** Abort init if silent SSO hangs (CSP/network); allow time for iframe + redirect + postMessage chain. */
const KEYCLOAK_INIT_TIMEOUT_MS = 12_000;

let initPromise = null;

function getOrStartInit() {
  if (!initPromise) {
    let timeoutId;
    initPromise = Promise.race([
      keycloak
        .init({
          onLoad: 'check-sso',
          silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
          pkceMethod: 'S256',
        })
        .finally(() => {
          if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
          }
        }),
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('timeout')), KEYCLOAK_INIT_TIMEOUT_MS);
      }),
    ]);
  }
  return initPromise;
}

function buildUserFromTokenParsed(parsed) {
  if (!parsed) {
    return null;
  }
  const roles = parsed.realm_access?.roles;
  return {
    user_id: parsed.sub ?? null,
    tenant_id: parsed.tenant_id ?? null,
    organization_id: parsed.organization_id ?? null,
    session_id: parsed.sid ?? parsed.session_state ?? null,
    preferredUsername: parsed.preferred_username ?? null,
    roles: Array.isArray(roles) ? roles : [],
  };
}

function hasRequiredKeycloakEnv() {
  const url = import.meta.env.VITE_KEYCLOAK_URL;
  const realm = import.meta.env.VITE_KEYCLOAK_REALM;
  const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;
  return [url, realm, clientId].every((v) => typeof v === 'string' && v.trim() !== '');
}

export function useKeycloak() {
  const [initialising, setInitialising] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    if (!hasRequiredKeycloakEnv()) {
      setError(AUTH_ERROR_MESSAGE);
      setInitialising(false);
      return undefined;
    }

    (async () => {
      try {
        await getOrStartInit();
        if (cancelled) {
          return;
        }
        setAuthenticated(Boolean(keycloak.authenticated));
        setUser(
          keycloak.authenticated && keycloak.tokenParsed
            ? buildUserFromTokenParsed(keycloak.tokenParsed)
            : null
        );
      } catch {
        if (!cancelled) {
          setAuthenticated(false);
          setError(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setInitialising(false);
        }
      }
    })();

    intervalRef.current = window.setInterval(() => {
      if (!keycloak.authenticated) {
        return;
      }
      keycloak
        .updateToken(UPDATE_TOKEN_MIN_VALIDITY_SEC)
        .then(() => {
          if (keycloak.authenticated && keycloak.tokenParsed) {
            setUser(buildUserFromTokenParsed(keycloak.tokenParsed));
          }
        })
        .catch(() => {
          setAuthenticated(false);
          setUser(null);
        });
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const login = useCallback(() => {
    keycloak.login({ redirectUri: window.location.href });
  }, []);

  const logout = useCallback(() => {
    keycloak.logout({ redirectUri: window.location.origin });
  }, []);

  const getToken = useCallback(() => keycloak.token ?? null, []);

  return {
    initialising,
    authenticated,
    error,
    user,
    login,
    logout,
    getToken,
  };
}
