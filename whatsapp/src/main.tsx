/**
 * Application entry point for the WhatsApp chat frontend.
 *
 * Sets up React with routing, Frappe provider, cache context, and the
 * service worker for PWA/offline support.
 *
 * Key dependencies:
 *   - frappe-react-sdk: Frappe backend integration
 *   - react-router-dom: Client-side routing
 *   - CacheContext: Offline data caching
 */

import { FrappeProvider } from "frappe-react-sdk";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./AppRouter";
import { CacheProvider } from "./contexts/CacheContext";
import "./index.css";

declare global {
  interface Window {
    frappe?: {
      boot?: {
        versions?: {
          frappe?: string;
        };
        sitename?: string;
      };
    };
  }
}

const getSiteName = (): string => {
  if (window.frappe?.boot?.versions?.frappe?.startsWith("14")) {
    return import.meta.env.VITE_SITE_NAME as string;
  }
  return (window.frappe?.boot?.sitename ||
    import.meta.env.VITE_SITE_NAME) as string;
};

const getFrappeUrl = (): string => {
  return (import.meta.env.VITE_FRAPPE_PATH || window.location.origin) as string;
};

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Failed to find the root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter basename="/whatsapp">
      <FrappeProvider
        url={getFrappeUrl()}
        siteName={getSiteName()}
        enableSocket={false}
      >
        <CacheProvider>
          <AppRouter />
        </CacheProvider>
      </FrappeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);