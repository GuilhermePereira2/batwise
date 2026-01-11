// src/data/blogPosts.ts

export interface BlogPost {
    slug: string;
    title: string;
    excerpt: string;
    content: string; // O texto completo do artigo em HTML
    image: string;
    author: string;
    date: string;
    readTime: string;
}

export const blogPosts: BlogPost[] = [
    {
        slug: "venezuela-tensions-battery-impact",
        title: "How Venezuela’s Current Tensions Could Impact the Battery Industry",
        excerpt: "Driven by political decisions and instability, Venezuela's situation highlights broader concerns about critical mineral supply chain security and geopolitical risks.",
        content: `
      <p>Driven by political decisions and instability, Venezuela has been under high pressure and conflict escalation. Having one of the world’s largest oil and mineral resources, the impact that this kind of decisions could have on energy markets and the overall world security is really uncountable.</p>
      
      <p>Although Venezuela is not a key player in the global supply of battery materials, its situation highlights a broader and increasingly relevant issue. The global battery market depends on a limited number of countries for critical minerals such as lithium, nickel, graphite, and other strategic metals. Any sign of instability, even in countries that are not major suppliers, reinforces concerns about concentration risk and long term supply security. In this sense, Venezuela acts less as a direct disruptor and more as a warning signal within an already fragile system.</p>
      
      <h3>Untapped Potential and Barriers</h3>
      <p>The country holds significant untapped mineral resources, particularly in regions such as the Orinoco Mining Arc, where deposits of nickel, copper, and coltan are known to exist. These materials are relevant to advanced technologies and indirectly to battery production. Yet political uncertainty, weak infrastructure, regulatory instability, and limited access to international investment have prevented these resources from being developed in a consistent and reliable way. As a result, Venezuela remains largely disconnected from the global battery value chain despite its geological potential.</p>
      
      <p>The most tangible effects of the current tensions are therefore indirect. Increased geopolitical risk tends to raise insurance costs, complicate financing, and reduce investor appetite for projects in and around unstable regions. Even when supply volumes are unaffected, perception alone can influence long term decisions about where new mines, refineries, or processing facilities are built. In a highly competitive battery market, where margins are tight and delivery timelines are critical, these factors matter.</p>
      
      <h3>Market Volatility and Future Outlook</h3>
      <p>From a pricing perspective, it is unlikely that Venezuela’s situation alone will cause significant increases in battery material prices. Recent trends have shown that global prices, particularly for lithium, are driven more by worldwide production capacity, technological progress, and shifts in demand than by isolated geopolitical events. That said, moments of political tension do contribute to market volatility and uncertainty, especially when they occur alongside other global disruptions.</p>
      
      <p>Ultimately, the situation in Venezuela is better understood as a risk multiplier rather than a turning point for the battery industry. It does not threaten immediate supply, but it reinforces the strategic importance of diversification, supply chain resilience, and reduced dependence on politically unstable regions. It also strengthens the case for increased recycling, alternative battery chemistries, and regionalized supply networks. The future of batteries will not be shaped by technology alone. It will also be influenced by geopolitics, governance, and the ability of the industry to anticipate and adapt to instability before it turns into disruption.</p>
    `,
        // Imagem relacionada com mineração/indústria
        image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600&h=400&fit=crop",
        author: "Joaquim Monteiro",
        date: "January 8, 2026",
        readTime: "4 min read",
    },
    {
        slug: "what-cell-types-can-i-choose",
        title: "What cell types can I choose?",
        excerpt: "An in-depth comparison of different lithium battery cell types including 18650, 21700, LiFePO4, and LiPo. Learn which cell type is best suited for your specific application.",
        content: "<p>There are many form factors: 18650, 21700, Prismatic...</p>",
        image: "https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?w=600&h=400&fit=crop",
        author: "David Park",
        date: "February 28, 2025",
        readTime: "10 min read",
    },
    {
        slug: "understanding-battery-capacity",
        title: "Understanding battery capacity and range calculations",
        excerpt: "Master the fundamentals of battery capacity, energy density, and how to accurately calculate expected range for electric vehicles and energy storage systems.",
        content: "<p>Capacity is measured in Ampere-hours (Ah)...</p>",
        image: "https://images.unsplash.com/photo-1593642532400-2682810df593?w=600&h=400&fit=crop",
        author: "Lisa Anderson",
        date: "February 20, 2025",
        readTime: "7 min read",
    },
];