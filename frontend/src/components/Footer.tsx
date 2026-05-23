import { Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import wattBuilderLogo from "../assets/wattbuilder-only-logo-white.svg";

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="bg-primary text-primary-foreground py-12">
      <div className="container px-4 mx-auto max-w-7xl">
        {/* Layout principal */}
        <div className="flex flex-col md:flex-row justify-between gap-10">

          {/* ESQUERDA: Marca e Copyright */}
          <div className="text-center md:text-left shrink-0">
            <img src={wattBuilderLogo} alt="Watt Builder" className="h-10 mb-2 mx-auto md:mx-0" />
            <p className="text-primary-foreground/80 text-sm">
              © 2026 Watt Builder.<br />{t('footer.rights')}
            </p>
          </div>

          {/* MEIO/DIREITA: Links de Navegação */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm md:ml-auto justify-items-center md:justify-items-start">

            {/* Coluna 1: Ferramentas */}
            <div className="flex flex-col gap-2 text-center md:text-left">
              <h4 className="font-bold mb-1 text-white">{t('footer.features.title')}</h4>
              <Link to="/simulator" className="text-primary-foreground/70 hover:text-white transition-colors">{t('footer.features.smartHomeSizer')}</Link>
              <Link to="/cell-explorer" className="text-primary-foreground/70 hover:text-white transition-colors">{t('footer.features.cellExplorer')}</Link>
              <Link to="/diy" className="text-primary-foreground/70 hover:text-white transition-colors">{t('footer.features.batteryBuilder')}</Link>
              <Link to="/business" className="text-primary-foreground/70 hover:text-white transition-colors">{t('footer.features.services')}</Link>
            </div>

            {/* Coluna 2: Empresa */}
            <div className="flex flex-col gap-2 text-center md:text-left">
              <h4 className="font-bold mb-1 text-white">{t('footer.company.title')}</h4>
              <Link to="/" className="text-primary-foreground/70 hover:text-white transition-colors">{t('footer.company.home')}</Link>
              <Link to="/contact" className="text-primary-foreground/70 hover:text-white transition-colors">{t('footer.company.contact')}</Link>
            </div>

            {/* Coluna 3: Conta & Legal */}
            <div className="flex flex-col gap-2 text-center md:text-left col-span-2 md:col-span-1">
              <h4 className="font-bold mb-1 text-white">{t('footer.account.title')}</h4>
              <Link to="/login" className="text-primary-foreground/70 hover:text-white transition-colors">{t('footer.account.login')}</Link>
              <Link to="/signup" className="text-primary-foreground/70 hover:text-white transition-colors">{t('footer.account.signUp')}</Link>
              <Link to="/terms" className="text-primary-foreground/70 hover:text-white transition-colors">{t('footer.account.terms')}</Link>
              <Link to="/privacy" className="text-primary-foreground/70 hover:text-white transition-colors">{t('footer.account.privacy')}</Link>
              <Link to="/cookies" className="text-primary-foreground/70 hover:text-white transition-colors">Política de Cookies</Link>
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