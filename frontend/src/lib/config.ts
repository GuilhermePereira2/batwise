// src/lib/config.ts

// Esta lógica corre uma vez e serve para toda a app
export const getApiUrl = (endpoint: string) => {
    // Garante que o endpoint começa com /
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    // Em desenvolvimento, usa o proxy do Vite (vite.config.ts)
    // Em produção, usa VITE_API_URL do .env
    if (import.meta.env.DEV) {
        // Proxy do Vite handle automaticamente /auth, /api, /calculate
        return path;
    }

    // Em produção: usa a URL completa do backend
    const base = import.meta.env.VITE_API_URL || "";
    return `${base.replace(/\/$/, "")}${path}`;
};