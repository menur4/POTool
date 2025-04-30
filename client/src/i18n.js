import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Importation des fichiers de traduction
import translationFR from './locales/fr.json';
import translationEN from './locales/en.json';
import translationAR from './locales/ar.json';

// Les ressources de traduction
const resources = {
  fr: {
    translation: translationFR
  },
  en: {
    translation: translationEN
  },
  ar: {
    translation: translationAR
  }
};

i18n
  .use(initReactI18next) // passe i18n à react-i18next
  .init({
    resources,
    lng: localStorage.getItem('language') || 'fr', // langue par défaut
    fallbackLng: 'fr', // langue de secours
    
    interpolation: {
      escapeValue: false // non nécessaire pour React
    },
    
    // Options communes
    debug: process.env.NODE_ENV === 'development',
    keySeparator: '.', // permet d'utiliser des clés en 'objet.propriété'
    
    // Détection de la langue
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
