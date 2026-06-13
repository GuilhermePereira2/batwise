import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import './i18n';
import "./index.css";
// 1. Importa o AuthProvider que criámos
import { AuthProvider } from "./context/AuthContext";

createRoot(document.getElementById("root")!).render(
    // 2. Envolve a aplicação com o Provider
    <HelmetProvider>
        <AuthProvider>
            <App />
        </AuthProvider>
    </HelmetProvider>
);