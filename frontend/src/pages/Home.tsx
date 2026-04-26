import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Wrench, Briefcase, Zap, Search, Home as HomeIcon, TrendingUp, BatteryCharging } from "lucide-react";
import { Link } from "react-router-dom";
import homeHeroImage from "@/assets/home-hero-battery.jpg";
import huaweiLogo from "@/assets/huawei_log.svg";
import lgLogo from "@/assets/LG_logo.svg";
import bydLogo from "@/assets/byd_logo.svg";
import samsungLogo from "@/assets/samsung.svg";
import enphaseLogo from "@/assets/enphase-seeklogo.svg";
import solaredgeLogo from "@/assets/solaredge-logo.svg";
import sonnenLogo from "@/assets/sonnen-inc-logo-vector.svg";
import victronLogo from "@/assets/victron-energy-b-v-seeklogo.svg";
import teslaLogo from "@/assets/Tesla_Logo.svg";

// 1. Move isto para fora do componente (ou para um ficheiro config separado) para não ser recriado a cada render.
const topBrands = [
  { id: "tesla", src: teslaLogo, alt: "Tesla", className: "h-30 md:h-10 max-w-[220px]" },
  { id: "huawei", src: huaweiLogo, alt: "Huawei" },
  { id: "lg", src: lgLogo, alt: "LG Energy" },
  { id: "samsung", src: samsungLogo, alt: "Samsung SDI" },
  { id: "solaredge", src: solaredgeLogo, alt: "SolarEdge" },
  { id: "byd", src: bydLogo, alt: "BYD" },
  { id: "enphase", src: enphaseLogo, alt: "Enphase" },
  { id: "sonnen", src: sonnenLogo, alt: "Sonnen" },
  { id: "victron", src: victronLogo, alt: "Victron" },
];

const Home = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      {/* B2C Hero Section - Focused on Conversion and ROI */}
      {/* B2C Hero Section - Focused on Conversion and ROI */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden mt-16">

        {/* Fundo ultra simples e limpo */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-50 to-background dark:from-slate-950 dark:to-background" />

        <div className="container relative z-10 px-4 py-12 mx-auto text-center animate-fade-in flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-accent/10 text-accent text-sm font-medium">
            <Zap className="w-4 h-4" />
            <span>Smart Energy Optimization</span>
          </div>

          {/* Título a preto (mantém-se branco no dark mode para não quebrar a UI) */}
          <h1 className="text-5xl md:text-7xl font-bold text-black dark:text-white mb-6 leading-tight max-w-4xl">
            The Perfect Battery for Your Home
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
            Simulate your consumption profile, compare the best batteries on the market, and discover your return on investment in seconds.
          </p>

          {/* Main CTA - Botão Laranja */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 w-full max-w-md mx-auto">
            <Button size="lg" className="text-xl px-8 py-6 w-full shadow-lg transition-all bg-[#FF6600] hover:bg-[#FF6600]/90 text-white" asChild>
              <Link to="/simulator">
                Simulate My Home
                <ArrowRight className="ml-2 h-6 w-6" />
              </Link>
            </Button>
          </div>

          {/* Key Features / Trust Markers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left w-full border-t border-border/50 pt-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <HomeIcon className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Personalized Profile</h3>
                <p className="text-sm text-muted-foreground mt-1">Calculations based on your home, household size, and current energy bill.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <BatteryCharging className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Top 20 on the Market</h3>
                <p className="text-sm text-muted-foreground mt-1">Database featuring the best available inverters and batteries.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">ROI Calculation</h3>
                <p className="text-sm text-muted-foreground mt-1">Optimization algorithm that shows exactly when your system pays for itself.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top Battery Brands Section */}
      <section className="py-12 border-y border-border/50 bg-muted/10 overflow-hidden">
        <div className="container px-4 mx-auto max-w-7xl text-center">
          <p className="text-sm font-semibold text-muted-foreground mb-8 uppercase tracking-widest">
            Comparing the market leaders
          </p>

          {/* Marquee Wrapper com Máscara de Gradiente nas bordas */}
          <div className="w-full inline-flex flex-nowrap overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]">

            {/* Primeira lista (Animação) */}
            <ul className="flex items-center justify-center md:justify-start [&_li]:mx-8 [&_img]:max-w-none animate-infinite-scroll">
              {topBrands.map((brand) => (
                <li key={brand.id}>
                  <img
                    src={brand.src}
                    alt={brand.alt}
                    className={`object-contain opacity-60 grayscale transition-all duration-300 hover:grayscale-0 hover:opacity-100 ${brand.className || "h-8 md:h-10 max-w-[120px]"}`}
                  />
                </li>
              ))}
            </ul>

            {/* Segunda lista clonada (Garante o loop infinito sem quebras visuais) */}
            <ul className="flex items-center justify-center md:justify-start [&_li]:mx-8 [&_img]:max-w-none animate-infinite-scroll" aria-hidden="true">
              {topBrands.map((brand) => (
                <li key={`${brand.id}-clone`}>
                  <img
                    src={brand.src}
                    alt={brand.alt}
                    className="h-8 md:h-10 max-w-[120px] object-contain opacity-60 grayscale transition-all duration-300 hover:grayscale-0 hover:opacity-100"
                  />
                </li>
              ))}
            </ul>

          </div>
        </div>
      </section>

      {/* Legacy/Professional Solutions Section */}
      <section className="py-24 bg-background">
        <div className="container px-4 mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Tools for Professionals
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Are you an engineer, maker, or integrator? Continue using our advanced tools for battery design and cell exploration.
            </p>
          </div>

          {/* Alterado para grid-cols-3 para acomodar o novo cartão */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* NOVO CARTÃO: Cell Explorer (No meio) */}
            <Card className="shadow-soft hover:shadow-medium transition-all duration-300 group cursor-pointer animate-slide-up" style={{ animationDelay: "100ms" }}>
              <CardHeader>
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {/* Importar 'Search' ou 'Microscope' do lucide-react */}
                  <Search className="w-7 h-7 text-accent" />
                </div>
                <CardTitle className="text-2xl">Cell Explorer</CardTitle>
                <CardDescription className="text-base">
                  Database & professional testing services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Extensive cell database</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Independent performance data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Custom cell testing requests</span>
                  </li>
                </ul>
                <Button className="w-full" size="lg" asChild>
                  <Link to="/cell-explorer">
                    Explore Cells
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* DIY Card */}
            <Card className="shadow-soft hover:shadow-medium transition-all duration-300 group cursor-pointer animate-slide-up">
              <CardHeader>
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Wrench className="w-7 h-7 text-accent" />
                </div>
                <CardTitle className="text-2xl">Battery Builder</CardTitle>
                <CardDescription className="text-base">
                  Free tool to design custom battery packs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Easy-to-use calculator</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Instant configuration suggestions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Component recommendations</span>
                  </li>
                </ul>
                <Button className="w-full" size="lg" asChild>
                  <Link to="/diy">
                    Start Designing
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Business Card (Ajustado delay da animação) */}
            <Card className="shadow-soft hover:shadow-medium transition-all duration-300 group cursor-pointer animate-slide-up" style={{ animationDelay: "200ms" }}>
              <CardHeader>
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Briefcase className="w-7 h-7 text-accent" />
                </div>
                <CardTitle className="text-2xl">Our Services</CardTitle>
                <CardDescription className="text-base">
                  Advanced software and consulting services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Advanced simulations & modeling</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Expert consulting services</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Production-ready designs</span>
                  </li>
                </ul>
                <Button className="w-full" size="lg" asChild>
                  <Link to="/business">
                    Learn More
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-muted/30">
        <div className="container px-4 mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Ready to get started?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of makers and engineers designing better batteries
          </p>
          <Button size="lg" asChild>
            <Link to="/diy">
              Try Battery Builder Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
