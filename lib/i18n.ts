import { defineI18nUI } from 'fumadocs-ui/i18n';

export const i18n = defineI18nUI(
  {
    defaultLanguage: 'en',
    languages: ['en', 'ru'],
    hideLocale: 'default-locale',
  },
  {
    en: { displayName: 'English' },
    ru: { displayName: 'Русский' },
  },
);
