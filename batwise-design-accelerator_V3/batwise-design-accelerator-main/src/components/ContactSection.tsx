import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const ContactSection = () => {
  const navigate = useNavigate();

  return (
    <section id="contact" className="py-24 bg-muted">
      <div className="container px-4 mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Get in Touch
          </h2>
          <p className="text-xl text-muted-foreground">
            Let's power the future together.
          </p>
        </div>

        <Button 
          onClick={() => navigate('/contact')}
          size="lg"
          className="w-full max-w-md mx-auto"
        >
          Contact Us
        </Button>
      </div>
    </section>
  );
};

export default ContactSection;
