// src/lib/config.ts

// Esta lógica corre uma vez e serve para toda a app
export const getApiUrl = (endpoint: string) => {
    // 1. Tenta ler a variável do Vercel
    let base = import.meta.env.VITE_API_URL;

    // 2. Se não existir (estás no teu PC), usa URL relativa
    // O proxy do Vite vai capturar /auth, /api, /calculate e redirecionar para 8001
    if (!base) {
        base = "";
    }

    // 3. Remove a barra final se existir (para evitar erros de //)
    base = base.replace(/\/$/, "");

    // 4. Garante que o endpoint começa com /
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    return `${base}${path}`;
};