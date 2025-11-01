import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import ProductSection from "@/components/ProductSection";
import UsageOptionsSection from "@/components/UsageOptionsSection";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Business = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="mt-16">
        <HeroSection />
        <ProductSection />
        <UsageOptionsSection />
        <FeaturesSection />
        <section id="contact" className="relative py-24 overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-background to-primary/5">
            <div className="absolute top-20 right-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          </div>

          <div className="container px-4 mx-auto max-w-4xl relative z-10 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 animate-fade-in">
              Get in Touch
            </h2>
            <p className="text-xl text-muted-foreground mb-8 animate-fade-in">
              Let's power the future together.
            </p>
            <Button 
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90 animate-scale-in"
              onClick={() => navigate('/contact')}
            >
              Contact Us
            </Button>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default Business;
