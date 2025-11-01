import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

const pricingTiers = [
  {
    name: "Free",
    price: "€0",
    period: "forever",
    description: "Perfect for hobbyists and basic projects",
    features: [
      "Battery design calculator",
      "Limited to 60 cells maximum",
      "Cell configuration suggestions",
      "Voltage and capacity calculations",
      "Full component recommendations (BMS, relays)",
      "Detailed cost estimations",
      "Access to validated cell database",
    ],
    cta: "Start Free",
    ctaLink: "/diy",
    variant: "outline" as const,
  },
  {
    name: "Pro / Enterprise",
    price: "Custom",
    period: "contact us",
    description: "Custom software and expert consulting",
    features: [
      "Everything in free",
      "Unlimited cell configurations",
      "Advanced battery simulations",
      "Custom software development",
      "Expert consulting services",
      "Real cell testing data integration",
      "ROI and business case analysis",
      "Degradation modeling",
      "Dedicated support team",
      "Custom integrations",
    ],
    cta: "Contact Us",
    ctaLink: "/contact",
    variant: "outline" as const,
  },
];

const Pricing = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-muted/30 to-background">
        <div className="container px-4 mx-auto max-w-6xl text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 animate-fade-in">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
            Choose the plan that fits your needs. Start free and upgrade as you grow.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 pb-24 bg-background">
        <div className="container px-4 mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <Card
                key={tier.name}
                className="relative shadow-soft hover:shadow-medium transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >

                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl mb-2">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">{tier.price}</span>
                    {tier.period && (
                      <span className="text-muted-foreground ml-2">/ {tier.period}</span>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    variant={tier.variant}
                    className="w-full"
                    size="lg"
                    asChild
                  >
                    <Link to={tier.ctaLink}>{tier.cta}</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Additional Info */}
          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground">
              Need a custom solution? <Link to="/contact" className="text-accent hover:underline">Contact our team</Link>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Pricing;
