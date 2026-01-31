import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogIn } from "lucide-react"; // Opcional: Importei o ícone LogIn

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { label: "Home", path: "/" },
    { label: "Cell Explorer", path: "/cell-explorer" },
    { label: "Battery Builder", path: "/diy" },
    { label: "Services", path: "/business" },
    { label: "Blog", path: "/blog" },
    { label: "Contact", path: "/contact" },
  ];

  const isActive = (path: string) => location.pathname === path;

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

          {/* Desktop Auth Buttons (ALTERADO AQUI) */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Botão de Login Secundário */}
            <Button variant="ghost" asChild>
              <Link to="/login">Log In</Link>
            </Button>

            {/* Botão Principal de Ação */}
            <Button asChild>
              <Link to="/diy">Try for Free</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 text-foreground"
            aria-label="Toggle menu"
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

              {/* Botões Mobile (ALTERADO AQUI) */}
              <div className="flex flex-col gap-3 pt-4 border-t border-border">
                <Button variant="ghost" asChild className="w-full justify-start">
                  <Link to="/login" onClick={() => setIsOpen(false)}>
                    <LogIn className="w-4 h-4 mr-2" /> Log In
                  </Link>
                </Button>
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