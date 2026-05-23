import React from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useTranslation } from "react-i18next";
import { Cookie, ShieldCheck, BarChart3, Settings, Target, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const CookiesPage = () => {
  const { t } = useTranslation();

  const handleOpenSettings = () => {
    if ((window as any).openCookieSettings) {
      (window as any).openCookieSettings();
    }
  };

  const cookieTypes = [
    {
      title: t('cookies.types.necessary.title'),
      icon: <ShieldCheck className="w-5 h-5 text-orange-600" />,
      desc: t('cookies.types.necessary.content')
    },
    {
      title: t('cookies.types.performance.title'),
      icon: <BarChart3 className="w-5 h-5 text-orange-600" />,
      desc: t('cookies.types.performance.content')
    },
    {
      title: t('cookies.types.functional.title'),
      icon: <Settings className="w-5 h-5 text-orange-600" />,
      desc: t('cookies.types.functional.content')
    },
    {
      title: t('cookies.types.marketing.title'),
      icon: <Target className="w-5 h-5 text-orange-600" />,
      desc: t('cookies.types.marketing.content')
    }
  ];

  const browsers = [
    { name: "Google Chrome", url: "https://support.google.com/chrome/answer/95647" },
    { name: "Mozilla Firefox", url: "https://support.mozilla.org/pt-PT/kb/cookies-informacao-que-os-websites-guardam-no-seu-computador" },
    { name: "Apple Safari", url: "https://support.apple.com/pt-pt/guide/safari/sfri11471/mac" },
    { name: "Microsoft Edge", url: "https://support.microsoft.com/pt-pt/microsoft-edge/eliminar-e-gerir-cookies-16d1ad62-67b9-1d07-c3db-9572fc731490" }
  ];

  return (
    <div className="min-h-screen bg-white text-black">
      <Navigation />
      <main className="max-w-4xl mx-auto px-6 py-24 md:py-32">
        <div className="space-y-12 animate-in fade-in duration-700">
          {/* Header */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">{t('cookies.title')}</h1>
            <p className="text-gray-500 font-medium italic">{t('cookies.lastUpdated')}</p>
          </div>

          <p className="text-lg text-gray-700 leading-relaxed">
            {t('cookies.intro')} (<a href="https://www.watt-builder.com" className="text-orange-600 font-semibold hover:underline">www.watt-builder.com</a>).
          </p>

          {/* Section 1 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Cookie className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold">{t('cookies.whatAreCookies.title')}</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              {t('cookies.whatAreCookies.content')}
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">{t('cookies.types.title')}</h2>
            <div className="grid gap-4">
              {cookieTypes.map((type, idx) => (
                <div key={idx} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-2">
                  <div className="flex items-center gap-3 mb-2">
                    {type.icon}
                    <h3 className="font-bold text-gray-900">{type.title}</h3>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{type.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold">{t('cookies.duration.title')}</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border border-gray-100 p-4 rounded-xl">
                <h3 className="font-bold mb-1">{t('cookies.duration.session.title')}</h3>
                <p className="text-sm text-gray-600">{t('cookies.duration.session.content')}</p>
              </div>
              <div className="border border-gray-100 p-4 rounded-xl">
                <h3 className="font-bold mb-1">{t('cookies.duration.persistent.title')}</h3>
                <p className="text-sm text-gray-600">{t('cookies.duration.persistent.content')}</p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">{t('cookies.manage.title')}</h2>
            <p className="text-gray-600">{t('cookies.manage.content')}</p>

            <Button
              onClick={handleOpenSettings}
              className="bg-black text-white hover:bg-gray-800 h-12 px-8 rounded-xl"
            >
              {t('cookies.manage.button')}
            </Button>

            <div className="pt-4 space-y-4">
              <p className="text-sm text-gray-500">{t('cookies.manage.browserNav')}</p>
            </div>

            <p className="text-xs text-red-500 font-medium">
              {t('cookies.manage.note')}
            </p>
          </section>

          {/* Section 5 */}
          <section className="bg-gray-50 text-gray-900 rounded-3xl p-8 md:p-12 border border-gray-200">
            <h2 className="text-2xl font-bold mb-4">{t('cookies.contact.title')}</h2>
            <p className="mb-6 text-gray-600 leading-relaxed">
              {t('cookies.contact.content')}
            </p>
            <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="font-bold text-gray-700">{t('cookies.contact.email')}</span>
              <a href="mailto:general@watt-builder.com" className="font-semibold text-orange-600 hover:underline">general@watt-builder.com</a>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CookiesPage;
