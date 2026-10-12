/**
 * @fileoverview App component that serves as the root component of the Event Detection application.
 * Manages application routing, layout structure, and global state through context providers.
 * Implements a responsive design with header, main content, and footer sections.
 *
 * @module App
 * @requires ./components/MainLayout
 * @requires @/components/ui/sidebar
 * @requires react-router-dom
 * @requires ./components/AppDatasetIntakeDetails
 * @requires ./components/Header
 * @requires ./components/Footer
 * @requires ./utils/googleAnalytics
 */

import MainLayout from './components/MainLayout.jsx';
import { Provider } from 'react-redux';
import { SidebarProvider } from '@/components/ui/sidebar.jsx';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { usePageViews } from './utils/googleAnalytics.js';
import AppDatasetIntakeDetails from './components/AppDatasetIntakeDetails.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { disclaimerConfig } from './config/disclaimerConfig.js';
import { AI_ASSISTANT_TAB, isTdisAiEnabled } from './config/featureFlags.js';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import SignupRequestsPage from './pages/admin/SignupRequestsPage.jsx';
import OrganisationsPage from './pages/admin/OrganisationsPage.jsx';
import OrganisationDetailPage from './pages/admin/OrganisationDetailPage.jsx';
import PricingTiersPage from './pages/admin/PricingTiersPage.jsx';
import OrgAdminLayout from './pages/org/OrgAdminLayout.jsx';
import MembersPage from './pages/org/MembersPage.jsx';
import SubscriptionPage from './pages/org/SubscriptionPage.jsx';
import BillingPage from './pages/org/BillingPage.jsx';
import RequestAccessPage from './pages/RequestAccessPage.jsx';

import store from './store';

import 'react-toastify/dist/ReactToastify.css';
/**
 * App Component
 *
 * The root component that orchestrates the entire application structure and routing.
 * Provides global state management through context providers and implements
 * the main application layout.
 *
 * Features:
 * - Global state management with SidebarProvider
 * - Client-side routing with React Router
 * - Responsive layout structure
 * - Consistent header and footer
 * - Fallback route handling
 * - Component composition
 *
 * Component Structure:
 * - SidebarProvider: Global sidebar state management
 * - Header: Application navigation and branding
 * - Routes: Application routing configuration
 *   - MainLayout: Home page content
 *   - AppDatasetIntakeDetails: Application intake form
 *   - Fallback route: Redirects to home
 * - Footer: Application footer content
 *
 * Routes:
 * - "/": Main application layout with map and content
 * - "/application-in-take": Dataset intake form details
 * - "*": Fallback route redirecting to home
 *
 * @component
 * @returns {JSX.Element} The complete application structure
 *
 * @example
 * ```jsx
 * // Basic usage in index.jsx or main.jsx
 * import { BrowserRouter } from 'react-router-dom';
 *
 * <BrowserRouter>
 *   <App />
 * </BrowserRouter>
 * ```
 */
const Router = () => {
  // Initialize Google Analytics page view tracking
  usePageViews();
  const location = useLocation();

  // Disclaimer state management - remember acceptance across refreshes.
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(() => {
    try {
      return window.localStorage.getItem(disclaimerConfig.storageKey) === 'true';
    } catch {
      return false;
    }
  });
  const isAiAssistantTab =
    isTdisAiEnabled() &&
    location.pathname === '/' &&
    new URLSearchParams(location.search).get('tab') === AI_ASSISTANT_TAB;

  /**
   * Handles disclaimer acceptance
   * Updates state to hide disclaimer for current session only
   * Disclaimer will show again on next page load
   *
   * @function
   * @returns {void}
   */
  const handleDisclaimerAccept = () => {
    try {
      window.localStorage.setItem(disclaimerConfig.storageKey, 'true');
    } catch {
      /* Storage may be unavailable in private or restricted browser contexts. */
    }
    setDisclaimerAccepted(true);
  };

  return (
    /**
     * Application root container
     * Wraps the entire application with global state provider
     * Implements flex column layout for proper structure
     *
     * @returns {JSX.Element} Application structure with routing
     */
    <SidebarProvider>
      <div className="flex flex-col min-h-screen w-full relative">
        {/* Application Routes */}
        <Routes>
          <Route path="/" element={<MainLayout />} />
          <Route path="/application-in-take" element={<AppDatasetIntakeDetails />} />
          <Route path="/request-access" element={<RequestAccessPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/signups" replace />} />
            <Route path="signups" element={<SignupRequestsPage />} />
            <Route path="organisations" element={<OrganisationsPage />} />
            <Route path="organisations/:id" element={<OrganisationDetailPage />} />
            <Route path="pricing" element={<PricingTiersPage />} />
          </Route>
          <Route path="/org" element={<OrgAdminLayout />}>
            <Route index element={<Navigate to="/org/members" replace />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="subscription" element={<SubscriptionPage />} />
            <Route path="billing" element={<BillingPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        {/* Footer */}
        <Footer />
        <ToastContainer />
      </div>

      {/* Disclaimer Overlay - Only shown if not accepted */}
      {!disclaimerAccepted && !isAiAssistantTab && <Disclaimer onAccept={handleDisclaimerAccept} />}
    </SidebarProvider>
  );
};

const App = () => (
  <Provider store={store}>
    <Router />
  </Provider>
);

export default App;
