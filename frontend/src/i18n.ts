import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ptTranslation from './locales/pt/translation.json';
import enTranslation from './locales/en/translation.json';

i18n
    // Deteta a língua do browser (opcional, mas recomendado)
    .use(LanguageDetector)
    // Passa a instância do i18n para o react-i18next
    .use(initReactI18next)
    .init({
        resources: {
            pt: { translation: ptTranslation },
            en: { translation: enTranslation }
        },
        fallbackLng: 'en', // EN como default
        debug: false, // Muda para true se precisares de ver logs no development
        interpolation: {
            escapeValue: false, // React já protege contra XSS
        }
    });

export default i18n;