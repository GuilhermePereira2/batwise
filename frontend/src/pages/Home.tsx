import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Wrench, Briefcase, Zap, Search, Home as HomeIcon, TrendingUp, BatteryCharging } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Imports de imagens mantidos iguais
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
  const { t } = useTranslation();
  const catchPhrase = t("home.features.catch_phrase");

  const formatNumbers = (text: string) => {
    const parts = text.split(/(\d+)/g);
    return parts.map((part, i) =>
      /\d+/.test(part) ?
        <span key={i} className="text-black font-extrabold">{part}</span> :
        part
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      {/* B2C Hero Section - Focused on Conversion and ROI */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden mt-16">
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-50 to-background dark:from-slate-950 dark:to-background" />

        <div className="container relative z-10 px-4 py-12 mx-auto text-center animate-fade-in flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-accent/10 text-accent text-sm font-medium">
            <Zap className="w-4 h-4" />
            <span>{t("home.hero.badge")}</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-black dark:text-white mb-6 leading-tight max-w-4xl">
            {t("home.hero.title_prefix")}      <span className="text-[#FF6600]">{t("home.hero.title_highlight")}</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
            {t("home.hero.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 w-full max-w-md mx-auto">
            <Button size="lg" className="text-xl px-8 py-6 w-full shadow-lg transition-all bg-[#FF6600] hover:bg-[#FF6600]/90 text-white" asChild>
              <Link to="/simulator">
                {t("home.hero.cta")}
                <ArrowRight className="ml-2 h-6 w-6" />
              </Link>
            </Button>
          </div>

          {/* Key Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left w-full border-t border-border/50 pt-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <HomeIcon className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t("home.features.profile_title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t("home.features.profile_desc")}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <BatteryCharging className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t("home.features.market_title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t("home.features.market_desc")}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t("home.features.roi_title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t("home.features.roi_desc")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Savings Section */}
      <section className="py-8 bg-white border-y border-gray-100">
        <div className="container px-4 mx-auto max-w-7xl text-center">
          <p className="text-2xl md:text-2xl font-bold tracking-tight text-gray-500 leading-relaxed">
            {t("home.features.catch_phrase")}
          </p>
        </div>
      </section>

      {/* Top Battery Brands Section */}
      <section className="py-12 border-y border-border/50 bg-muted/10 overflow-hidden">
        <div className="container px-4 mx-auto max-w-7xl text-center">
          <p className="text-sm font-semibold text-muted-foreground mb-8 uppercase tracking-widest">
            {t("home.brands.title")}
          </p>

          <div className="w-full inline-flex flex-nowrap overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]">
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

            <ul className="flex items-center justify-center md:justify-start [&_li]:mx-8 [&_img]:max-w-none animate-infinite-scroll" aria-hidden="true">
              {topBrands.map((brand) => (
                <li key={`${brand.id}-clone`}>
                  <img
                    src={brand.src}
                    alt={brand.alt}
                    className={`object-contain opacity-60 grayscale transition-all duration-300 hover:grayscale-0 hover:opacity-100 ${brand.className || "h-8 md:h-10 max-w-[120px]"}`}
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
              {t("home.pro_tools.title")}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("home.pro_tools.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="shadow-soft hover:shadow-medium transition-all duration-300 group cursor-pointer animate-slide-up" style={{ animationDelay: "100ms" }}>
              <CardHeader>
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Search className="w-7 h-7 text-accent" />
                </div>
                <CardTitle className="text-2xl">{t("home.pro_tools.cell_title")}</CardTitle>
                <CardDescription className="text-base">
                  {t("home.pro_tools.cell_desc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("home.pro_tools.cell_li1")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("home.pro_tools.cell_li2")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("home.pro_tools.cell_li3")}</span>
                  </li>
                </ul>
                <Button className="w-full" size="lg" asChild>
                  <Link to="/cell-explorer">
                    {t("home.pro_tools.cell_btn")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-medium transition-all duration-300 group cursor-pointer animate-slide-up">
              <CardHeader>
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Wrench className="w-7 h-7 text-accent" />
                </div>
                <CardTitle className="text-2xl">{t("home.pro_tools.builder_title")}</CardTitle>
                <CardDescription className="text-base">
                  {t("home.pro_tools.builder_desc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("home.pro_tools.builder_li1")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("home.pro_tools.builder_li2")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("home.pro_tools.builder_li3")}</span>
                  </li>
                </ul>
                <Button className="w-full" size="lg" asChild>
                  <Link to="/diy">
                    {t("home.pro_tools.builder_btn")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-medium transition-all duration-300 group cursor-pointer animate-slide-up" style={{ animationDelay: "200ms" }}>
              <CardHeader>
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Briefcase className="w-7 h-7 text-accent" />
                </div>
                <CardTitle className="text-2xl">{t("home.pro_tools.services_title")}</CardTitle>
                <CardDescription className="text-base">
                  {t("home.pro_tools.services_desc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("home.pro_tools.services_li1")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("home.pro_tools.services_li2")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("home.pro_tools.services_li3")}</span>
                  </li>
                </ul>
                <Button className="w-full" size="lg" asChild>
                  <Link to="/business">
                    {t("home.pro_tools.services_btn")}
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
            {t("home.cta_section.title")}
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            {t("home.cta_section.subtitle")}
          </p>
          <Button size="lg" asChild>
            <Link to="/diy">
              {t("home.cta_section.btn")}
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
