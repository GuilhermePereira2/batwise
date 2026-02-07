import React, { createContext, useContext, useState, useEffect } from "react";
import { getApiUrl } from "@/lib/config";


// 1. Atualizamos a interface para incluir os campos do Trial e outros úteis
interface User {
    id?: string;
    email: string;
    name: string;
    credits: number;
    company?: string;
    created_at?: string;
    trial_started_at?: string | null; // <--- FUNDAMENTAL para a lógica do trial
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, userData: User) => void;
    logout: () => void;
    updateCredits: (newCredits: number) => void;
    updateUser: (userData: Partial<User>) => void; // <--- NOVA FUNÇÃO GENÉRICA
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);

    // Ao iniciar a App, verifica se já existe login guardado
    useEffect(() => {
        const storedToken = localStorage.getItem("token");
        const storedUser = localStorage.getItem("user");

        if (storedToken && storedUser) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse stored user", e);
                localStorage.removeItem("user");
                localStorage.removeItem("token");
            }
        }
    }, []);

    useEffect(() => {
        if (!token) return;

        const refreshUser = async () => {
            try {
                const res = await fetch(getApiUrl("auth/me"), {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!res.ok) throw new Error("Failed to fetch user");

                const freshData = await res.json();

                const mappedUser: User = {
                    ...user,
                    ...freshData,
                    name: freshData.full_name || freshData.name || user?.name || "User",
                    email: freshData.email || user?.email
                };

                setUser(mappedUser);
                localStorage.setItem("user", JSON.stringify(mappedUser));
            } catch (err) {
                console.error("Failed to refresh user from backend", err);
            }
        };

        refreshUser();
    }, [token]);


    const login = (newToken: string, userData: User) => {
        setToken(newToken);
        const safeUser = {
            ...userData,
            name: userData.name || (userData as any).full_name || (userData as any).user_name
        };

        setUser(safeUser);
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(safeUser));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        // Opcional: Redirecionar para home ou login
        window.location.href = "/login";
    };

    // Atualiza apenas créditos (mantido para compatibilidade)
    const updateCredits = (newCredits: number) => {
        if (user) {
            const updatedUser = { ...user, credits: newCredits };
            setUser(updatedUser);
            localStorage.setItem("user", JSON.stringify(updatedUser));
        }
    };

    // 2. Implementação da função que atualiza qualquer campo (usada no Profile.tsx)
    const updateUser = (newUserData: Partial<User>) => {
        if (user) {
            // Mescla os dados atuais com os novos (ex: adiciona trial_started_at)
            const updatedUser = { ...user, ...newUserData };

            setUser(updatedUser);
            localStorage.setItem("user", JSON.stringify(updatedUser));
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            updateCredits,
            updateUser, // Exportar a nova função
            isAuthenticated: !!user
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};