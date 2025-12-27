import { Helmet } from 'react-helmet-async';

interface SeoHeadProps {
    title: string;
    description: string;
    canonicalUrl?: string;
    type?: 'website' | 'article';
}

export const SeoHead = ({
    title,
    description,
    canonicalUrl = window.location.href,
    type = 'website'
}: SeoHeadProps) => {
    const siteName = "BatWise Design Accelerator";
    const fullTitle = `${title} | ${siteName}`;

    return (
        <Helmet>
            {/* Tags Padrão */}
            <title>{fullTitle}</title>
            <meta name='description' content={description} />
            <link rel="canonical" href={canonicalUrl} />

            {/* Open Graph / Facebook / LinkedIn */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:site_name" content={siteName} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
        </Helmet>
    );
};