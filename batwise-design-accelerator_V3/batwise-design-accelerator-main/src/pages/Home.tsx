import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Wrench, Briefcase, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import homeHeroImage from "@/assets/home-hero-battery.jpg";

const Home = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden mt-16">
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${homeHeroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/95" />
        </div>

        <div className="container relative z-10 px-4 py-20 mx-auto text-center animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
            Battery Design,<br />Simplified.
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
            From DIY enthusiasts to professional engineers — we have the tools and expertise to help you design better batteries.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg" asChild>
              <Link to="/diy">
                Try DIY Tool
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg" asChild>
              <Link to="/business">
                For Businesses
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="py-24 bg-background">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Choose Your Path
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Whether you're building a hobby project or developing a commercial product, we've got you covered
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* DIY Card */}
            <Card className="shadow-soft hover:shadow-medium transition-all duration-300 group cursor-pointer animate-slide-up">
              <CardHeader>
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Wrench className="w-7 h-7 text-accent" />
                </div>
                <CardTitle className="text-2xl">DIY Battery Builder</CardTitle>
                <CardDescription className="text-base">
                  Free tool for makers and hobbyists
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

            {/* Business Card */}
            <Card className="shadow-soft hover:shadow-medium transition-all duration-300 group cursor-pointer animate-slide-up" style={{ animationDelay: "100ms" }}>
              <CardHeader>
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Briefcase className="w-7 h-7 text-accent" />
                </div>
                <CardTitle className="text-2xl">Professional Solutions</CardTitle>
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
                <Button className="w-full" size="lg" variant="outline" asChild>
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
              Try Free Tool Now
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
