const Header = () => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="container px-4 mx-auto max-w-6xl">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-2xl font-bold text-foreground">
            BatteryBuilder
          </button>
          
          <nav className="flex items-center gap-6">
            <button onClick={() => scrollToSection('product')} className="text-foreground hover:text-accent transition-colors">
              Product
            </button>
            <button onClick={() => scrollToSection('solutions')} className="text-foreground hover:text-accent transition-colors">
              Solutions
            </button>
            <button onClick={() => scrollToSection('features')} className="text-foreground hover:text-accent transition-colors">
              Features
            </button>
            <button onClick={() => scrollToSection('contact')} className="text-foreground hover:text-accent transition-colors">
              Contact
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
