import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const UsageOptionsSection = () => {
  const navigate = useNavigate();

  const handleSoftwareClick = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTeamClick = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="solutions" className="py-24 bg-muted">
      <div className="container px-4 mx-auto max-w-6xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-foreground">
          Optimize your battery solution
        </h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Software Card */}
          <Card 
            className="shadow-medium hover:shadow-large transition-all duration-300 border-2 cursor-pointer hover:scale-105"
            onClick={handleSoftwareClick}
          >
            <CardHeader>
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Cpu className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-2xl">Optimize your battery with our software</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Turn your requirements into reliable designs in minutes, no external help needed.
              </CardDescription>
            </CardContent>
          </Card>

          {/* Team Card */}
          <Card 
            className="shadow-medium hover:shadow-large transition-all duration-300 border-2 border-accent cursor-pointer hover:scale-105"
            onClick={handleTeamClick}
          >
            <CardHeader>
              <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-accent" />
              </div>
              <CardTitle className="text-2xl">Optimize your battery with our team</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                From concept to final design, our team ensures your battery system is safe, efficient, and fully optimized.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default UsageOptionsSection;
