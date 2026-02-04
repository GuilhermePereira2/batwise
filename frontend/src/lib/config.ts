// src/lib/config.ts

// Esta lógica corre uma vez e serve para toda a app
export const getApiUrl = (endpoint: string) => {
    // 1. Tenta ler a variável do Vercel
    let base = import.meta.env.VITE_API_URL;

    // 2. Se não existir (estás no teu PC), usa localhost
    if (!base) {
        base = "http://127.0.0.1:8000";
    }

    // 3. Remove a barra final se existir (para evitar erros de //)
    base = base.replace(/\/$/, "");

    // 4. Remove a barra inicial do endpoint se existir
    const path = endpoint.replace(/^\//, "");

    return `${base}/${path}`;
};