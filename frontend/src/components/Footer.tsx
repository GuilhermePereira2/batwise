import { Mail } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground py-12">
      <div className="container px-4 mx-auto max-w-7xl">
        {/* Layout principal */}
        <div className="flex flex-col md:flex-row justify-between gap-10">

          {/* ESQUERDA: Marca e Copyright */}
          <div className="text-center md:text-left shrink-0">
            <h3 className="text-2xl font-bold mb-2">Watt Builder</h3>
            <p className="text-primary-foreground/80 text-sm">
              © 2026 Watt Builder.<br />All rights reserved.
            </p>
          </div>

          {/* MEIO/DIREITA: Links de Navegação */}
          {/* Alterações aqui: md:ml-auto empurra para a direita, removido flex-grow */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm md:ml-auto justify-items-center md:justify-items-start">

            {/* Coluna 1: Ferramentas */}
            <div className="flex flex-col gap-2 text-center md:text-left">
              <h4 className="font-bold mb-1 text-white">Features</h4>
              <Link to="/cell-explorer" className="text-primary-foreground/70 hover:text-white transition-colors">Cell Explorer</Link>
              <Link to="/diy" className="text-primary-foreground/70 hover:text-white transition-colors">Battery Builder</Link>
              <Link to="/business" className="text-primary-foreground/70 hover:text-white transition-colors">Services</Link>
            </div>

            {/* Coluna 2: Empresa */}
            <div className="flex flex-col gap-2 text-center md:text-left">
              <h4 className="font-bold mb-1 text-white">Company</h4>
              <Link to="/" className="text-primary-foreground/70 hover:text-white transition-colors">Home</Link>
              <Link to="/blog" className="text-primary-foreground/70 hover:text-white transition-colors">Blog</Link>
              <Link to="/contact" className="text-primary-foreground/70 hover:text-white transition-colors">Contact</Link>
            </div>

            {/* Coluna 3: Conta & Legal */}
            <div className="flex flex-col gap-2 text-center md:text-left">
              <h4 className="font-bold mb-1 text-white">Account</h4>
              <Link to="/login" className="text-primary-foreground/70 hover:text-white transition-colors">Login</Link>
              <Link to="/signup" className="text-primary-foreground/70 hover:text-white transition-colors">Sign Up</Link>
              <Link to="/terms" className="text-primary-foreground/70 hover:text-white transition-colors">Terms and Conditions</Link>
            </div>
          </div>

          {/* DIREITA: Ícone Social */}
          <div className="flex justify-center md:justify-start shrink-0">
            <Link
              to="/contact"
              className="w-10 h-10 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full flex items-center justify-center transition-colors"
              aria-label="Email"
            >
              <Mail className="w-5 h-5" />
            </Link>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;