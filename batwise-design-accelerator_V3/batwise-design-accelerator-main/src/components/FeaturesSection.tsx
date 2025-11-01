import { Activity, Target, DollarSign, Database, Settings, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Activity,
    title: "Realistic Simulation",
    description: "Simulates electric vehicles, residential/industrial energy systems, and others using real cell data and advanced degradation models.",
  },
  {
    icon: Target,
    title: "Design Optimization",
    description: "Transforms requirements into reliable, optimized battery packs considering performance, durability, and cost.",
  },
  {
    icon: DollarSign,
    title: "ROI & Cost Assessment",
    description: "Calculates return on investment based on the client's business model, supporting strategic decisions.",
  },
  {
    icon: Database,
    title: "Extensive Database",
    description: "Includes hundreds of commercial cells, enabling design comparisons and market alternatives.",
  },
  {
    icon: Settings,
    title: "User Flexibility",
    description: "Operate the software independently to reduce consulting costs.",
  },
  {
    icon: Zap,
    title: "Speed & Efficiency",
    description: "Converts requirements into final preliminary designs in minutes, accelerating product development.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 bg-background">
      <div className="container px-4 mx-auto max-w-7xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-foreground">
          Six Core Features That Drive Results
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="shadow-soft hover:shadow-medium transition-all duration-300 border animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
