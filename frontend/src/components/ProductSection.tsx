const ProductSection = () => {
  return (
    <section id="product" className="py-24 bg-background">
      <div className="container px-4 mx-auto max-w-5xl">
        <div className="animate-slide-up">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-foreground">
            Smarter Battery Design, Lower Development Costs
          </h2>
          <div className="prose prose-lg max-w-none text-muted-foreground text-center leading-relaxed">
            <p className="text-lg">
              Our company combines advanced software and expert consulting to deliver optimized 
              battery design solutions. Leveraging real cell testing data and state-of-the-art 
              degradation models, our platform simulates electric vehicles and energy systems while 
              calculating ROI based on each client's business case.
            </p>
            <p className="text-lg mt-6">
              It transforms requirements into production-ready designs, in minutes, by generating 
              and comparing all possible configurations from our extensive cell database against 
              market alternatives. Through our consulting services, we provide tailored guidance at 
              every stage of development, while clients who wish to reduce costs can also operate 
              the software independently and access our validated database or integrate their own.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductSection;
