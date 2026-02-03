import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogIn, User, LogOut, Coins, UserCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
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
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();

  const menuItems = [
    { label: "Home", path: "/" },
    { label: "Cell Explorer", path: "/cell-explorer" },
    { label: "Battery Builder", path: "/diy" },
    { label: "Services", path: "/business" },
    { label: "Blog", path: "/blog" },
    { label: "Contact", path: "/contact" },
  ];

  const isActive = (path: string) => location.pathname === path;

  // --- ALTERAÇÃO 1: Lógica de iniciais (Primeiro + Último nome) ---
  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");

    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }

    // Pega a primeira letra do primeiro nome e a primeira do último
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="container px-4 mx-auto max-w-7xl">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-2xl font-bold text-foreground">
            Watt Builder
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {menuItems.map((item) => (
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

            {/* --- ALTERAÇÃO 2: Botão Try for Free sempre visível --- */}
            <Button asChild>
              <Link to="/diy">Try for Free</Link>
            </Button>

            {isAuthenticated && user ? (
              // --- USER LOGGED IN (DROPDOWN) ---
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
                    <span>Credits: <strong>{user.credits}</strong></span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />

                  {/* --- ALTERAÇÃO 3: Opção Profile --- */}
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer flex items-center w-full">
                      <UserCircle className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              // --- NOT LOGGED IN ---
              <Button variant="ghost" asChild>
                <Link to="/login">Log In</Link>
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 text-foreground"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <nav className="lg:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-4">
              {menuItems.map((item) => (
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
                          <Coins className="w-3 h-3 text-yellow-500" /> {user.credits} Credits
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" asChild className="justify-start">
                      <Link to="/profile" onClick={() => setIsOpen(false)}>
                        <UserCircle className="w-4 h-4 mr-2" /> Profile
                      </Link>
                    </Button>
                    <Button variant="ghost" onClick={() => { logout(); setIsOpen(false); }} className="justify-start text-red-600 hover:text-red-600">
                      <LogOut className="w-4 h-4 mr-2" /> Log Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" asChild className="w-full justify-start">
                      <Link to="/login" onClick={() => setIsOpen(false)}>
                        <LogIn className="w-4 h-4 mr-2" /> Log In
                      </Link>
                    </Button>
                  </>
                )}
                {/* Botão Try Free sempre no fundo do mobile menu */}
                <Button asChild className="w-full">
                  <Link to="/diy" onClick={() => setIsOpen(false)}>
                    Try for Free
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