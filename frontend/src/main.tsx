import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import './i18n';
import "./index.css";
// 1. Importa o AuthProvider que criámos
import { AuthProvider } from "./context/AuthContext";

createRoot(document.getElementById("root")!).render(
    // 2. Envolve a aplicação com o Provider
    <AuthProvider>
        <App />
    </AuthProvider>
);