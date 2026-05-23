import './i18n';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AppModeProvider } from "./context/AppModeContext";
import { useAuth } from "./context/AuthContext";
import Home from "./pages/Home";
import DIYTool from "./pages/DIYTool";
import Business from "./pages/Business";
import Pricing from "./pages/Pricing";
import Blog from "./pages/Blog";
import Contact from "./pages/Contact";
import BatteryForm from "./pages/BatteryForm";
import NotFound from "./pages/NotFound";
import CellExplorer from "@/pages/CellExplorer";
import BlogPost from "./pages/BlogPost";
import CellDetails from "./pages/CellDetails";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import Terms from "./pages/Terms";
import Simulator from "./pages/Simulator";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import CookieConsent from "./components/CookieConsent";


const queryClient = new QueryClient();

const routes = [
  { path: "/", element: <Home /> },
  { path: "/diy", element: <DIYTool /> },
  { path: "/business", element: <Business /> },
  { path: "/pricing", element: <Pricing /> },
  { path: "/blog", element: <Blog /> },
  { path: "/contact", element: <Contact /> },
  { path: "/battery-form", element: <BatteryForm /> },
  { path: "/auth", element: <BatteryForm /> },
  { path: "/cell-explorer", element: <CellExplorer /> },
  { path: "/blog/:slug", element: <BlogPost /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/cell/:slug", element: <CellDetails /> },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/verify-email", element: <VerifyEmail /> },
  { path: "/terms", element: <Terms /> },
  { path: "/privacy", element: <Privacy /> },
  { path: "/cookies", element: <Cookies /> },
  { path: "/simulator", element: <Simulator /> },
  { path: "/profile", element: <Profile /> },
  { path: "*", element: <NotFound /> },
];

const getRoutePath = (prefix: string, path: string) => {
  if (!prefix) return path;
  if (path === "*") return `${prefix}/*`;
  if (path === "/") return prefix;
  return `${prefix}${path}`;
};

const stripAdminPrefix = (pathname: string) => {
  if (pathname === "/admin") return "/";
  if (pathname.startsWith("/admin/")) return pathname.slice("/admin".length) || "/";
  return pathname;
};

const AdminRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user?.admin) {
    return <Navigate to={`${stripAdminPrefix(location.pathname)}${location.search}${location.hash}`} replace />;
  }

  return <>{children}</>;
};

const renderRoutes = (prefix = "") => routes.map((route) => (
  <Route
    key={`${prefix || "client"}-${route.path}`}
    path={getRoutePath(prefix, route.path)}
    element={prefix === "/admin" ? <AdminRouteGuard>{route.element}</AdminRouteGuard> : route.element}
  />
));

const LocationTracker = () => {
  const location = useLocation();
  useEffect(() => {
    const authPaths = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/auth"];
    if (!authPaths.some(path => location.pathname.startsWith(path))) {
      localStorage.setItem("last_visited_page", location.pathname + location.search);
    }
  }, [location]);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <CookieConsent />
      <BrowserRouter>
        <LocationTracker />
        <AppModeProvider>
          <Routes>
            {renderRoutes()}
            {renderRoutes("/admin")}
          </Routes>
        </AppModeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
