import { useTranslation } from "react-i18next";

const ProductSection = () => {
  const { t } = useTranslation();

  return (
    <section id="product" className="py-24 bg-background">
      <div className="container px-4 mx-auto max-w-5xl">
        <div className="animate-slide-up">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-foreground">
            {t('businessProduct.title')}
          </h2>
          <div className="prose prose-lg max-w-none text-muted-foreground text-center leading-relaxed">
            <p className="text-lg">
              {t('businessProduct.paragraph1')}
            </p>
            <p className="text-lg mt-6">
              {t('businessProduct.paragraph2')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductSection;