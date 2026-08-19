import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/design-tokens.css";
import { StartupFailure } from "./components/runtime/StartupFailure";
import { registerPwaBackgroundCapabilities, registerPwaLaunchHandlers } from "./lib/pwa-integrations";

const firebaseWorkerConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const serviceWorkerUrl = () =>
  `/firebase-messaging-sw.js?${new URLSearchParams(
    Object.entries(firebaseWorkerConfig).map(([key, value]) => [key, value || ""]),
  )}`;

const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return;

  const { protocol, hostname } = window.location;
  const isSecureOrigin = protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1";

  if (!import.meta.env.PROD || !isSecureOrigin) return;

  try {
    const registration = await navigator.serviceWorker.register(serviceWorkerUrl(), {
      scope: "/",
      updateViaCache: "none",
    });

    void registration.update();
  } catch (error) {
    console.error("[NeuroNex PWA] Falha ao registrar o service worker.", error);
  }
};

window.addEventListener("load", () => {
  void registerServiceWorker();
  registerPwaBackgroundCapabilities();
});

registerPwaLaunchHandlers();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("NeuroNex root element was not found.");
}

const root = createRoot(rootElement);

async function bootstrap() {
  try {
    if (window.location.pathname === "/confirmar-alteracao-agenda") {
      const { default: AgendaChangeResponse } = await import("./pages/public/AgendaChangeResponse.tsx");
      root.render(<AgendaChangeResponse />);
      return;
    }

    const { default: App } = await import("./App.tsx");
    root.render(<App />);
  } catch (error) {
    console.error("[NeuroNex] Falha durante a inicialização do aplicativo.", error);
    root.render(<StartupFailure error={error} />);
  }
}

void bootstrap();