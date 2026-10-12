import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { User } from 'lucide-react';

function getRoleLabel(roles) {
  if (!Array.isArray(roles)) return 'Member';
  const hasAdminRole = roles.some(
    (role) => typeof role === 'string' && role.toLowerCase().includes('admin')
  );
  return hasAdminRole ? 'Admin' : 'Member';
}

const UserBar = ({ user, preferredUsername, onLogout, adminActionLabel, onAdminAction }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);

  const displayName = preferredUsername || user?.user_id || 'Signed-in user';
  const roleLabel = getRoleLabel(user?.roles);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      const el = rootRef.current;
      if (el && !el.contains(event.target)) {
        closeMenu();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, closeMenu]);

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className={`flex h-9 w-9 items-center justify-center rounded-full border border-[#e2e8f0] bg-white text-[#324755] hover:bg-[#f8fafc] ${
          menuOpen ? 'ring-1 ring-[#324755]/25' : ''
        }`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="Account and sign out"
      >
        <User className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>

      {menuOpen ? (
        <div
          className="absolute right-0 top-full z-[60] mt-1 w-56 rounded-md border border-[#e2e8f0] bg-white py-2"
          role="menu"
        >
          <div className="border-b border-[#e2e8f0] px-3 pb-2">
            <p className="truncate text-xs font-medium text-[#1b1c20]">{displayName}</p>
            <p className="mt-1">
              <span className="inline-block rounded border border-[#e2e8f0] bg-[#f8fafc] px-1.5 py-0.5 text-[10px] font-medium text-[#324755]">
                {roleLabel}
              </span>
            </p>
          </div>
          <div className="mt-1">
            {adminActionLabel && onAdminAction ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onAdminAction();
                }}
                className="w-full px-3 py-2 text-left text-xs font-medium text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1b1c20]"
              >
                {adminActionLabel}
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onLogout();
              }}
              className="w-full px-3 py-2 text-left text-xs font-medium text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1b1c20]"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

UserBar.propTypes = {
  user: PropTypes.shape({
    user_id: PropTypes.string,
    tenant_id: PropTypes.string,
    organization_id: PropTypes.string,
    roles: PropTypes.arrayOf(PropTypes.string),
  }),
  preferredUsername: PropTypes.string,
  onLogout: PropTypes.func.isRequired,
  adminActionLabel: PropTypes.string,
  onAdminAction: PropTypes.func,
};

UserBar.defaultProps = {
  user: null,
  preferredUsername: null,
  adminActionLabel: null,
  onAdminAction: null,
};

export default UserBar;
