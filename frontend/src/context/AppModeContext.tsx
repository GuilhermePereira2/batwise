import React, { createContext, useContext, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

type AppMode = "client" | "admin";

interface AppModeContextType {
    mode: AppMode;
    isAdminMode: boolean;
    canUseAdminMode: boolean;
    clientPath: string;
    adminPath: string;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

const isAdminPathname = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

const stripAdminPrefix = (pathname: string) => {
    if (pathname === "/admin") return "/";
    if (pathname.startsWith("/admin/")) return pathname.slice("/admin".length) || "/";
    return pathname;
};

const addAdminPrefix = (pathname: string) => {
    if (isAdminPathname(pathname)) return pathname;
    if (pathname === "/") return "/admin";
    return `/admin${pathname}`;
};

export const AppModeProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const location = useLocation();
    const canUseAdminMode = Boolean(user?.admin);

    const value = useMemo(() => {
        const suffix = `${location.search}${location.hash}`;
        const isAdminRoute = isAdminPathname(location.pathname);
        const mode: AppMode = isAdminRoute && canUseAdminMode ? "admin" : "client";

        return {
            mode,
            isAdminMode: mode === "admin",
            canUseAdminMode,
            clientPath: `${stripAdminPrefix(location.pathname)}${suffix}`,
            adminPath: `${addAdminPrefix(location.pathname)}${suffix}`,
        };
    }, [location.hash, location.pathname, location.search, canUseAdminMode]);

    return (
        <AppModeContext.Provider value={value}>
            {children}
        </AppModeContext.Provider>
    );
};

export const useAppMode = () => {
    const context = useContext(AppModeContext);
    if (context === undefined) {
        throw new Error("useAppMode must be used within an AppModeProvider");
    }
    return context;
};
