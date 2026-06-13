import { Helmet } from 'react-helmet-async';

interface SeoHeadProps {
    title: string;
    description: string;
    canonicalUrl?: string;
    type?: 'website' | 'article' | 'software';
    image?: string;
    keywords?: string;
    schema?: any; // Optional JSON-LD schema object
}

export const SeoHead = ({
    title,
    description,
    canonicalUrl = window.location.href,
    type = 'website',
    image = '/placeholder.svg',
    keywords = 'Watt Builder, simulador solar, baterias lítio, inversores solares, energia renovável, Portugal, Espanha',
    schema
}: SeoHeadProps) => {
    const siteName = "Watt Builder";
    const fullTitle = `${title} | ${siteName}`;

    // Default Organization Schema
    const defaultOrganizationSchema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": siteName,
        "url": "https://wattbuilder.com", // Adjust to actual production URL if known
        "logo": "https://wattbuilder.com/logo.svg",
        "description": "A plataforma líder para dimensionamento e simulação de sistemas de armazenamento de energia solar em Portugal e Espanha.",
        "address": {
            "@type": "PostalAddress",
            "addressCountry": "PT"
        }
    };

    // Default SoftwareApplication Schema
    const softwareSchema = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": siteName,
        "operatingSystem": "Web",
        "applicationCategory": "BusinessApplication",
        "description": description,
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "EUR"
        }
    };

    return (
        <Helmet>
            {/* Standard Meta Tags */}
            <title>{fullTitle}</title>
            <meta name='description' content={description} />
            <meta name='keywords' content={keywords} />
            <link rel="canonical" href={canonicalUrl} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type === 'software' ? 'website' : type} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:site_name" content={siteName} />
            <meta property="og:image" content={image} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />

            {/* Structured Data (JSON-LD) */}
            <script type="application/ld+json">
                {JSON.stringify(schema || (type === 'software' ? softwareSchema : defaultOrganizationSchema))}
            </script>
        </Helmet>
    );
};