import { Mail } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground py-12">
      <div className="container px-4 mx-auto max-w-7xl">
        <div className="flex flex-col gap-8">
          {/* Top Section */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold mb-2">BatteryBuilder</h3>
              <p className="text-primary-foreground/80">
                © 2025 BatteryBuilder. All rights reserved.
              </p>
            </div>

            <div className="flex gap-6">
              <Link
                to="/contact"
                className="w-10 h-10 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full flex items-center justify-center transition-colors"
                aria-label="Email"
              >
                <Mail className="w-5 h-5" />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
