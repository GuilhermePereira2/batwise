import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogIn, User, LogOut, Coins, UserCircle, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import logo from "@/assets/wattbuilder-logo-orange.svg";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const { t } = useTranslation();

  const menuItems = [
    { label: t("nav.home"), path: "/" },
    { label: t("nav.services"), path: "/business" },
    { label: t("nav.contact"), path: "/contact" },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    const protectedRoutes = ["/profile"];
    await logout();
    if (protectedRoutes.includes(location.pathname)) {
      navigate("/");
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="container px-4 mx-auto max-w-7xl">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="inline-flex items-center" aria-label="Watt Builder Home">
            <img src={logo} alt="Watt Builder" className="h-7 w-auto" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {/* Renderiza o Home primeiro */}
            <Link
              to={menuItems[0].path}
              className={`transition-colors ${isActive(menuItems[0].path)
                ? "text-accent font-medium"
                : "text-foreground hover:text-accent"
                }`}
            >
              {menuItems[0].label}
            </Link>

            {/* Dropdown Free Tools Desktop */}
            <div className="relative group">
              <button className="flex items-center gap-1 transition-colors text-foreground hover:text-accent py-2">
                {t("nav.freeTools")} <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
              </button>

              <div className="absolute top-[calc(100%-0.5rem)] left-0 mt-1 w-56 p-2 bg-background border border-border rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <Link to="/simulator" className="flex flex-col p-3 rounded-lg hover:bg-muted transition-colors">
                  <span className="font-medium text-foreground">{t("nav.smartHomeSizer")}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{t("nav.smartHomeSizerDesc")}</span>
                </Link>
                <div className="h-px bg-border/50 my-1 mx-2" />
                <Link to="/diy" className="flex flex-col p-3 rounded-lg hover:bg-muted transition-colors">
                  <span className="font-medium text-foreground">{t("nav.batteryBuilder")}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{t("nav.batteryBuilderDesc")}</span>
                </Link>
                <Link to="/cell-explorer" className="flex flex-col p-3 rounded-lg hover:bg-muted transition-colors">
                  <span className="font-medium text-foreground">{t("nav.cellExplorer")}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{t("nav.cellExplorerDesc")}</span>
                </Link>
              </div>
            </div>

            {/* Renderiza os restantes (Services, Blog, Contact) */}
            {menuItems.slice(1).map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`transition-colors ${isActive(item.path)
                  ? "text-accent font-medium"
                  : "text-foreground hover:text-accent"
                  }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Auth Area */}
          <div className="hidden lg:flex items-center gap-3">
            <LanguageSwitcher />
            <Button asChild>
              <Link to="/simulator">{t("nav.tryForFree")}</Link>
            </Button>

            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full ml-2">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src="" alt={user.name} />
                      <AvatarFallback className="bg-accent text-accent-foreground font-bold">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-default bg-muted/50">
                    <Coins className="mr-2 h-4 w-4 text-yellow-500" />
                    <span>{t("nav.credits")}: <strong>{user.credits}</strong></span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer flex items-center w-full">
                      <UserCircle className="mr-2 h-4 w-4" />
                      <span>{t("nav.profile")}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t("nav.logOut")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" asChild>
                <Link to="/login">{t("nav.logIn")}</Link>
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-foreground"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <nav className="lg:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-4">
              {/* Home Mobile */}
              <Link
                to={menuItems[0].path}
                onClick={() => setIsOpen(false)}
                className={`py-2 transition-colors ${isActive(menuItems[0].path)
                  ? "text-accent font-medium"
                  : "text-foreground hover:text-accent"
                  }`}
              >
                {menuItems[0].label}
              </Link>

              {/* Dropdown Free Tools Mobile */}
              <div className="flex flex-col">
                <button
                  onClick={() => setIsToolsOpen(!isToolsOpen)}
                  className="flex items-center justify-between w-full py-2 text-foreground hover:text-accent transition-colors"
                >
                  {t("nav.freeTools")} <ChevronDown className={`w-4 h-4 transition-transform ${isToolsOpen ? "rotate-180" : ""}`} />
                </button>
                {isToolsOpen && (
                  <div className="flex flex-col gap-2 pl-4 mt-1 border-l-2 border-border/50 ml-2">
                    <Link to="/simulator" onClick={() => setIsOpen(false)} className="py-2 text-[#FF6600] font-medium text-sm">
                      {t("nav.smartHomeSizer")}
                    </Link>
                    <Link to="/diy" onClick={() => setIsOpen(false)} className="py-2 text-muted-foreground hover:text-foreground text-sm">
                      {t("nav.batteryBuilder")}
                    </Link>
                    <Link to="/cell-explorer" onClick={() => setIsOpen(false)} className="py-2 text-muted-foreground hover:text-foreground text-sm">
                      {t("nav.cellExplorer")}
                    </Link>
                  </div>
                )}
              </div>

              {/* Restantes Itens Mobile */}
              {menuItems.slice(1).map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`py-2 transition-colors ${isActive(item.path)
                    ? "text-accent font-medium"
                    : "text-foreground hover:text-accent"
                    }`}
                >
                  {item.label}
                </Link>
              ))}

              <div className="flex flex-col gap-3 pt-4 border-t border-border">
                {isAuthenticated && user ? (
                  <>
                    <div className="flex items-center gap-3 px-2 py-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-accent text-accent-foreground font-bold">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Coins className="w-3 h-3 text-yellow-500" /> {user.credits} {t("nav.credits")}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" asChild className="justify-start">
                      <Link to="/profile" onClick={() => setIsOpen(false)}>
                        <UserCircle className="w-4 h-4 mr-2" /> {t("nav.profile")}
                      </Link>
                    </Button>
                    <Button variant="ghost" onClick={() => { handleLogout(); setIsOpen(false); }} className="justify-start text-red-600 hover:text-red-600">
                      <LogOut className="w-4 h-4 mr-2" /> {t("nav.logOut")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" asChild className="w-full justify-start">
                      <Link to="/login" onClick={() => setIsOpen(false)}>
                        <LogIn className="w-4 h-4 mr-2" /> {t("nav.logIn")}
                      </Link>
                    </Button>
                  </>
                )}
                <Button asChild className="w-full">
                  <Link to="/simulator" onClick={() => setIsOpen(false)}>
                    {t("nav.tryForFree")}
                  </Link>
                </Button>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Navigation;