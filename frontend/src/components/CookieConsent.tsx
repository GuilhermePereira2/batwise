import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { X, Cookie } from 'lucide-react';

const CookieConsent = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Expose a global function to re-open the settings
    (window as any).openCookieSettings = () => setIsVisible(true);
    
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 animate-in slide-in-from-bottom duration-500">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white border border-gray-200 shadow-2xl rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1 flex gap-4">
            <div className="bg-orange-100 p-3 rounded-full hidden sm:block">
              <Cookie className="w-6 h-6 text-orange-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900">{t('cookies.title')}</h3>
              <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
                {t('cookies.message')}
              </p>
              <div className="flex gap-4">
                <a href="/cookies" className="text-xs font-medium text-orange-600 hover:underline">
                  {t('cookies.policy')}
                </a>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0 w-full md:w-auto">
            <Button
              variant="outline"
              onClick={handleDecline}
              className="flex-grow md:flex-initial h-11 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {t('cookies.decline')}
            </Button>
            <Button
              onClick={handleAccept}
              className="flex-grow md:flex-initial h-11 bg-orange-600 text-white hover:bg-orange-700 shadow-md"
            >
              {t('cookies.accept')}
            </Button>
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
