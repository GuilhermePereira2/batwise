import { Activity, Target, DollarSign, Database, Settings, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

const featuresData = [
  { id: "simulation", icon: Activity },
  { id: "optimization", icon: Target },
  { id: "roi", icon: DollarSign },
  { id: "database", icon: Database },
  { id: "flexibility", icon: Settings },
  { id: "speed", icon: Zap },
];

const FeaturesSection = () => {
  const { t } = useTranslation();

  return (
    <section id="features" className="py-24 bg-background">
      <div className="container px-4 mx-auto max-w-7xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-foreground">
          {t('featuresSection.title')}
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuresData.map((feature, index) => (
            <Card
              key={index}
              className="shadow-soft hover:shadow-medium transition-all duration-300 border animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-xl">
                  {t(`featuresSection.items.${feature.id}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t(`featuresSection.items.${feature.id}.desc`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;