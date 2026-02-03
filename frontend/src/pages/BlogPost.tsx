// src/pages/BlogPost.tsx
import { useParams, Link } from 'react-router-dom';
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User, Clock } from "lucide-react";
import { blogPosts } from "@/data/blogPosts";
import { useEffect } from 'react';

const BlogPost = () => {
    const { slug } = useParams(); // Pega o slug do URL
    const post = blogPosts.find((p) => p.slug === slug);

    // Rola para o topo ao abrir a página
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    if (!post) {
        return (
            <div className="min-h-screen flex items-center justify-center flex-col gap-4">
                <h1 className="text-2xl font-bold">Article not found</h1>
                <Link to="/blog">
                    <Button>Back to Blog</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navigation />

            <main className="flex-grow pt-32 pb-16">
                <article className="container px-4 mx-auto max-w-3xl">
                    {/* Botão Voltar */}
                    <Link to="/blog">
                        <Button variant="ghost" className="mb-8 hover:-translate-x-1 transition-transform">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Blog
                        </Button>
                    </Link>

                    {/* Cabeçalho */}
                    <div className="mb-8">
                        <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
                            {post.title}
                        </h1>

                        <div className="flex flex-wrap items-center gap-6 text-muted-foreground text-sm border-b pb-8">
                            <div className="flex items-center gap-2">
                                <User size={16} />
                                <span>{post.author}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar size={16} />
                                <span>{post.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={16} />
                                <span>{post.readTime}</span>
                            </div>
                        </div>
                    </div>

                    {/* Imagem */}
                    <div className="rounded-xl overflow-hidden mb-10 shadow-lg">
                        <img
                            src={post.image}
                            alt={post.title}
                            className="w-full h-auto object-cover max-h-[500px]"
                        />
                    </div>

                    {/* Conteúdo HTML do artigo */}
                    <div
                        className="prose prose-lg dark:prose-invert max-w-none text-foreground"
                        dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                </article>
            </main>

            <Footer />
        </div>
    );
};

export default BlogPost;