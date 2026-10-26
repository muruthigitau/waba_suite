/**
 * Application entry point for the WhatsApp chat frontend.
 *
 * Sets up React routing and the Frappe provider. Data is always fetched from
 * the server; no offline cache or service worker is registered.
 */

import { FrappeProvider } from "frappe-react-sdk";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./AppRouter";
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
        enableSocket={true}
      >
        <AppRouter />
      </FrappeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);