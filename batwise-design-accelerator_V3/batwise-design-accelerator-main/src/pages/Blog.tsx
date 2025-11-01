import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, User } from "lucide-react";

const blogPosts = [
  {
    title: "How to choose the right BMS for your battery",
    excerpt: "Understanding Battery Management Systems (BMS) is crucial for safe and efficient battery operation. Learn the key factors to consider when selecting a BMS for your project.",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop",
    author: "Sarah Chen",
    date: "March 15, 2025",
    readTime: "8 min read",
  },
  {
    title: "DIY vs Professional battery design",
    excerpt: "Explore the trade-offs between building your own battery pack and working with professional design services. We break down costs, safety considerations, and performance expectations.",
    image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&h=400&fit=crop",
    author: "Michael Rodriguez",
    date: "March 10, 2025",
    readTime: "6 min read",
  },
  {
    title: "How to build a battery at home",
    excerpt: "A comprehensive step-by-step guide to safely building your first battery pack. From selecting cells to assembling your pack, we cover all the essentials for DIY battery builders.",
    image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600&h=400&fit=crop",
    author: "Emma Johnson",
    date: "March 5, 2025",
    readTime: "12 min read",
  },
  {
    title: "What cell types can I choose?",
    excerpt: "An in-depth comparison of different lithium battery cell types including 18650, 21700, LiFePO4, and LiPo. Learn which cell type is best suited for your specific application.",
    image: "https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?w=600&h=400&fit=crop",
    author: "David Park",
    date: "February 28, 2025",
    readTime: "10 min read",
  },
  {
    title: "Understanding battery capacity and range calculations",
    excerpt: "Master the fundamentals of battery capacity, energy density, and how to accurately calculate expected range for electric vehicles and energy storage systems.",
    image: "https://images.unsplash.com/photo-1593642532400-2682810df593?w=600&h=400&fit=crop",
    author: "Lisa Anderson",
    date: "February 20, 2025",
    readTime: "7 min read",
  },
  {
    title: "Safety first: Essential precautions for battery building",
    excerpt: "Battery building requires careful attention to safety. Learn about the critical safety measures, protective equipment, and best practices every battery builder should follow.",
    image: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=600&h=400&fit=crop",
    author: "James Wilson",
    date: "February 15, 2025",
    readTime: "9 min read",
  },
];

const Blog = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-muted/30 to-background">
        <div className="container px-4 mx-auto max-w-6xl text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 animate-fade-in">
            Learn & Build
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
            Expert guides, tutorials, and insights to help you master battery design
          </p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-16 pb-24 bg-background">
        <div className="container px-4 mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post, index) => (
              <Card
                key={post.title}
                className="shadow-soft hover:shadow-medium transition-all duration-300 cursor-pointer group overflow-hidden animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                <CardHeader>
                  <CardTitle className="text-xl group-hover:text-accent transition-colors line-clamp-2">
                    {post.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-3 mt-2">
                    {post.excerpt}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <User size={14} />
                      <span>{post.author}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      <span>{post.date}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{post.readTime}</span>
                    <Button variant="ghost" size="sm" className="group-hover:text-accent">
                      Read more
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More */}
          <div className="text-center mt-12">
            <Button variant="outline" size="lg">
              Load More Articles
            </Button>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 bg-muted/30">
        <div className="container px-4 mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Stay Updated
          </h2>
          <p className="text-muted-foreground mb-6">
            Get the latest battery design tips, tutorials, and industry insights delivered to your inbox
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-2 rounded-lg border border-input bg-background"
            />
            <Button>Subscribe</Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Blog;
