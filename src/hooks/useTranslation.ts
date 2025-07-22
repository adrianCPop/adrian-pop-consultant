import { useState, useEffect, createContext, useContext } from 'react';

export type Language = 'EN' | 'RO';

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  EN: {
    // Header
    'header.title': 'Adrian Pop',
    
    // Hero Section
    'hero.title': 'Adrian Pop –',
    'hero.titleHighlight': 'Navigating Complexity with Clarity',
    'hero.subtitle': 'Technical consultant for eInvoicing, AI compliance, and scalable systems.',
    'hero.description': 'From reverse-engineering iOS to cracking the complexity of global eInvoicing standards — and navigating offshore with calm focus — I help teams simplify and scale their systems.',
    'hero.ctaPrimary': 'Let\'s Talk',
    'hero.ctaSecondary': 'See My Work',
    
    // Services Section
    'services.title': 'What I Do',
    'services.description': 'Comprehensive IT consulting services spanning architecture, compliance, AI integration, and team leadership.',
    'services.einvoicing.title': 'eInvoicing & AI Compliance',
    'services.einvoicing.description': 'Delivered compliant invoice flows in Mexico, the EU, and LATAM. Expert in CFDI, SAF-T, and Peppol BIS 3.0. Combined rule-based validation and AI-assisted automation to streamline complex eInvoicing pipelines.',
    'services.mobile.title': 'Mobile & Embedded Systems',
    'services.mobile.description': 'Reverse-engineered iOS SDK 4.0 and performed a hardware-level jailbreak on the first iPhone. Led and mentored iOS teams. Built firmware and protocols for embedded systems (CAN bus), and integrated smart home IoT automation.',
    'services.architecture.title': 'Architecture & Interim CEO',
    'services.architecture.description': '15+ years of experience designing scalable platforms and leading engineering teams. Served as Interim CEO during a successful acquisition, overseeing business strategy and team integration.',
    'services.process.title': 'Process Optimization & Delivery',
    'services.process.description': 'Specialized in workflow design, agile delivery, and distributed team operations. I actively experiment with AI tools to optimize business processes, leveraging extensive experience in sprint management, tooling alignment, and delivery flow improvements.',
    
    // Testimonials Section
    'testimonials.title': 'What People Say',
    'testimonials.description': 'Feedback from colleagues and clients who have worked with me directly.',
    'testimonials.quote': 'Adrian came on board to help us manage our development process in our distributed team working only remotely and geographically dispersed. Adrian has brought structure, method and overview to our backlog and his management of the team has been invaluable. Adrian is experienced, competent and pleasant and his calm and efficient management of the board, the team and the sprints has been impressive. If you get a chance to work with Adrian, you should grab it!',
    'testimonials.author': 'Lars Kjærsgaard',
    'testimonials.role': 'Chief Architect @ hopp tech ltd',
    'testimonials.date': '(Managed Adrian directly, August 2024)',
    
    // Invoice Law Section
    'invoice.title': 'Can You Beat Adrian\'s Logic?',
    'invoice.description': 'Test your understanding of invoice validation rules against our AI system. Build custom rules and see how they perform.',
    'invoice.builder.title': 'Rule Builder',
    'invoice.builder.addRule': 'Add Rule',
    'invoice.builder.testRules': 'Test Rules',
    'invoice.builder.testing': 'Testing Rules...',
    'invoice.builder.field': 'Field',
    'invoice.builder.operator': 'Operator',
    'invoice.builder.value': 'Value',
    'invoice.builder.selectField': 'Select field',
    'invoice.builder.selectOperator': 'Select operator',
    'invoice.builder.enterValue': 'Enter value',
    'invoice.builder.removeRule': 'Remove rule',
    'invoice.result.valid': 'Valid',
    'invoice.result.warnings': 'Warnings',
    'invoice.result.errors': 'Errors',
    'invoice.result.validationPassed': 'Validation passed successfully!',
    'invoice.result.validationWarnings': 'Validation passed with warnings:',
    'invoice.result.validationFailed': 'Validation failed with errors:',
    'invoice.result.debugInfo': 'Debug Information',
    'invoice.result.rulesPassed': 'Rules passed',
    'invoice.result.rulesFailed': 'Rules failed',
    'invoice.result.showDebug': 'Show Debug Info',
    'invoice.result.hideDebug': 'Hide Debug Info',
    
    // Publications Section
    'publications.title': 'Publications',
    'publications.description': 'Published articles',
    'publications.article.title': 'Strengths‑Based Development: A Long‑Term Strategy for Software Teams',
    'publications.article.date': 'Medium • March 2023',
    'publications.readArticle': 'Read Article',
    
    // Contact Section
    'contact.title': 'Let\'s Talk',
    'contact.description': 'Ready to discuss your project? Get in touch and let\'s explore how I can help.',
    'contact.getInTouch': 'Get in Touch',
    'contact.intro': 'I\'m always interested in discussing new opportunities and interesting projects. Feel free to reach out!',
    'contact.form.title': 'Send a Message',
    
    'contact.form.name': 'Name',
    'contact.form.email': 'Email',
    'contact.form.message': 'Message',
    'contact.form.send': 'Send Message',
    'contact.success.title': 'Message sent!',
    'contact.success.description': 'Thank you for your message. I\'ll get back to you soon.',
    'contact.error.title': 'Error sending message',
    'contact.error.description': 'Something went wrong. Please try again later.',
    
    // Reverse Engineering Section
    'reverseEngineering.title': 'iOS, Disassembly & Hardware Hacking',
    'reverseEngineering.description': 'With 9+ years of iOS experience, I\'ve reverse-engineered the iOS 4.0 SDK, jailbroken the original iPhone, and delivered 10+ App Store apps across industries. I led an iOS department from 0 to 8 developers, codified processes, and shipped crash-free releases that reached top ratings.',
    
    // Embedded Systems Section
    'embeddedSystems.title': 'From Microcontrollers to Protocol Layers',
    'embeddedSystems.description': 'In my early career, I wrote embedded firmware for agricultural machinery, implemented ISO 11783, and developed CAN bus protocol layers in C. I tested code directly on target hardware, working with ARM processors and debugging at register level.',
    
    // Leadership Section
    'leadership.title': 'Interim CEO, Real Results',
    'leadership.description': 'As interim CEO of CoreBuild, I led key negotiations with clients, managed company-wide hiring, and orchestrated the integration between CoreBuild and its acquiring partner. I unified sales, technical, and support teams during this transition and contributed directly to a 50% increase in revenue and customer base within the first year. I also defined strategic roadmaps and aligned hiring, delivery, and financial operations to support long-term goals.',
    
    // End-to-End Section
    'endToEnd.title': 'From code to boardroom',
    'endToEnd.journey.reverseEngineering.from': 'Reverse-engineered SDKs',
    'endToEnd.journey.reverseEngineering.to': 'delivered App Store apps',
    'endToEnd.journey.compliance.from': 'Designed compliance flows',
    'endToEnd.journey.compliance.to': 'integrated CFDI 4.0',
    'endToEnd.journey.leadership.from': 'Led sprints',
    'endToEnd.journey.leadership.to': 'chaired board meetings',
    'endToEnd.journey.technical.from': 'Built firmware',
    'endToEnd.journey.technical.to': 'scaled SaaS teams',
    
    // Footer
    'footer.copyright': 'Built with Codex + GPT-4 by Adrian Pop · © 2025',
    
    // Theme Selector
    'theme.title': 'Theme',
    'theme.colorThemes': 'Color Themes',
    'theme.customColors': 'Custom Colors',
    'theme.primary': 'Primary',
    'theme.background': 'Background',
    'theme.text': 'Text',
    'theme.accent': 'Accent',
    'theme.resetDefault': 'Reset to Default',
    'theme.default': 'Default',
    'theme.ocean': 'Ocean',
    'theme.forest': 'Forest',
    'theme.sunset': 'Sunset',
    'theme.purple': 'Purple',
    
    // Cookie Consent
    'cookie.title': 'Cookie Preferences',
    'cookie.description': 'We use cookies to enhance your experience, remember your theme preferences, and analyze site usage. Your data is processed in accordance with GDPR regulations.',
    'cookie.acceptAll': 'Accept All',
    'cookie.necessaryOnly': 'Necessary Only',
    'cookie.settings': 'Settings',
    'cookie.privacySettings': 'Privacy Settings',
    'cookie.privacyDescription': 'Manage your cookie preferences and data processing consent.',
    'cookie.necessary': 'Necessary',
    'cookie.necessaryDesc': 'Required for basic functionality',
    'cookie.preferences': 'Preferences',
    'cookie.preferencesDesc': 'Remember your theme and settings',
    'cookie.analytics': 'Analytics',
    'cookie.analyticsDesc': 'Help us improve the site',
    'cookie.marketing': 'Marketing',
    'cookie.marketingDesc': 'Personalized content',
    'cookie.disclaimer': 'Data is stored locally and processed according to GDPR guidelines. You can change these preferences anytime.',
    'cookie.savePreferences': 'Save Preferences',
    'cookie.cancel': 'Cancel',
  },
  RO: {
    // Header
    'header.title': 'Adrian Pop',
    
    // Hero Section
    'hero.title': 'Adrian Pop –',
    'hero.titleHighlight': 'Navighează prin Complexitate cu Claritate',
    'hero.subtitle': 'Consultant tehnic pentru eFacturare, conformitatea AI și sisteme scalabile.',
    'hero.description': 'De la ingineria inversă iOS până la descifrarea complexității standardelor globale de eFacturare — și navigarea pe mare cu concentrare calmă — ajut echipele să își simplifice și să își scaleze sistemele.',
    'hero.ctaPrimary': 'Să Vorbim',
    'hero.ctaSecondary': 'Vezi Munca Mea',
    
    // Services Section
    'services.title': 'Ce Fac',
    'services.description': 'Servicii complete de consultanță IT care acoperă arhitectura, conformitatea, integrarea AI și conducerea echipelor.',
    'services.einvoicing.title': 'eFacturare & Conformitatea AI',
    'services.einvoicing.description': 'Am livrat fluxuri conforme de facturi în Mexic, UE și LATAM. Expert în CFDI, SAF-T și Peppol BIS 3.0. Am combinat validarea bazată pe reguli și automatizarea asistată de AI pentru a eficientiza pipeline-urile complexe de eFacturare.',
    'services.mobile.title': 'Sisteme Mobile & Embedded',
    'services.mobile.description': 'Am practicat ingineria inversă pe iOS SDK 4.0 și am realizat un jailbreak la nivel hardware pe primul iPhone. Am condus și mentorat echipe iOS. Am construit firmware și protocoale pentru sisteme embedded (CAN bus) și am integrat automatizarea IoT pentru casa inteligentă.',
    'services.architecture.title': 'Arhitectură & CEO Interimar',
    'services.architecture.description': '15+ ani de experiență în proiectarea platformelor scalabile și conducerea echipelor de inginerie. Am servit ca CEO Interimar în timpul unei achiziții de succes, supraveghind strategia de afaceri și integrarea echipelor.',
    'services.process.title': 'Optimizarea Proceselor & Livrare',
    'services.process.description': 'Specializat în proiectarea workflow-urilor, livrarea agile și operațiunile echipelor distribuite. Experimentez activ cu instrumente AI pentru optimizarea proceselor de afaceri, valorificând experiența vastă în managementul sprint-urilor, alinierea instrumentelor și îmbunătățirile fluxului de livrare.',
    
    // Testimonials Section
    'testimonials.title': 'Ce Spun Oamenii',
    'testimonials.description': 'Feedback de la colegi și clienți care au lucrat direct cu mine.',
    'testimonials.quote': 'Adrian s-a alăturat pentru a ne ajuta să gestionăm procesul de dezvoltare în echipa noastră distribuită care lucrează doar la distanță și dispersată geografic. Adrian a adus structură, metodă și vedere de ansamblu asupra backlog-ului nostru și managementul său asupra echipei a fost inestimabil. Adrian este experimentat, competent și plăcut, iar managementul său calm și eficient asupra consiliului, echipei și sprint-urilor a fost impresionant. Dacă ai șansa să lucrezi cu Adrian, ar trebui să o prinzi!',
    'testimonials.author': 'Lars Kjærsgaard',
    'testimonials.role': 'Arhitect Șef @ hopp tech ltd',
    'testimonials.date': '(L-a managementul direct pe Adrian, August 2024)',
    
    // Invoice Law Section
    'invoice.title': 'Poți Învinge Logica lui Adrian?',
    'invoice.description': 'Testează-ți înțelegerea regulilor de validare a facturilor împotriva sistemului nostru AI. Construiește reguli personalizate și vezi cum performează.',
    'invoice.builder.title': 'Constructor de Reguli',
    'invoice.builder.addRule': 'Adaugă Regulă',
    'invoice.builder.testRules': 'Testează Regulile',
    'invoice.builder.testing': 'Testez Regulile...',
    'invoice.builder.field': 'Câmp',
    'invoice.builder.operator': 'Operator',
    'invoice.builder.value': 'Valoare',
    'invoice.builder.selectField': 'Selectează câmpul',
    'invoice.builder.selectOperator': 'Selectează operatorul',
    'invoice.builder.enterValue': 'Introdu valoarea',
    'invoice.builder.removeRule': 'Elimină regula',
    'invoice.result.valid': 'Valid',
    'invoice.result.warnings': 'Avertismente',
    'invoice.result.errors': 'Erori',
    'invoice.result.validationPassed': 'Validarea a trecut cu succes!',
    'invoice.result.validationWarnings': 'Validarea a trecut cu avertismente:',
    'invoice.result.validationFailed': 'Validarea a eșuat cu erori:',
    'invoice.result.debugInfo': 'Informații de Debug',
    'invoice.result.rulesPassed': 'Reguli trecute',
    'invoice.result.rulesFailed': 'Reguli eșuate',
    'invoice.result.showDebug': 'Arată Info Debug',
    'invoice.result.hideDebug': 'Ascunde Info Debug',
    
    // Publications Section
    'publications.title': 'Publicații',
    'publications.description': 'Articole publicate',
    'publications.article.title': 'Dezvoltarea Bazată pe Puncte Forte: O Strategie pe Termen Lung pentru Echipele Software',
    'publications.article.date': 'Medium • Martie 2023',
    'publications.readArticle': 'Citește Articolul',
    
    // Contact Section
    'contact.title': 'Să Vorbim',
    'contact.description': 'Gata să discuți proiectul tău? Să luăm legătura și să explorăm cum te pot ajuta.',
    'contact.getInTouch': 'Să Luăm Legătura',
    'contact.intro': 'Sunt întotdeauna interesat să discut oportunități noi și proiecte interesante. Simte-te liber să mă contactezi!',
    
    'contact.form.title': 'Trimite un Mesaj',
    'contact.form.name': 'Nume',
    'contact.form.email': 'Email',
    'contact.form.message': 'Mesaj',
    'contact.form.send': 'Trimite Mesaj',
    'contact.success.title': 'Mesaj trimis!',
    'contact.success.description': 'Mulțumesc pentru mesajul tău. Îți voi răspunde în curând.',
    'contact.error.title': 'Eroare la trimiterea mesajului',
    'contact.error.description': 'Ceva nu a mers bine. Te rog încearcă din nou mai târziu.',
    
    // Reverse Engineering Section
    'reverseEngineering.title': 'iOS, Disassembly & Hardware Hacking',
    'reverseEngineering.description': 'Cu 9+ ani de experiență iOS, am practicat ingineria inversă pe iOS 4.0 SDK, am făcut jailbreak pe primul iPhone, și am livrat 10+ aplicații App Store în diverse industrii. Am condus un departament iOS de la 0 la 8 dezvoltatori, am codificat procese, și am livrat release-uri fără crash-uri care au atins rating-uri de top.',
    
    // Embedded Systems Section
    'embeddedSystems.title': 'De la Microcontrolere la Straturi de Protocol',
    'embeddedSystems.description': 'În primii ani ai carierei mele, am scris firmware embedded pentru utilaje agricole, am implementat ISO 11783, și am dezvoltat straturi de protocol CAN bus în C. Am testat codul direct pe hardware-ul țintă, lucrând cu procesoare ARM și debugging la nivel de registru.',
    
    // Leadership Section
    'leadership.title': 'CEO Interimar, Rezultate Reale',
    'leadership.description': 'Ca CEO interimar al CoreBuild, am condus negocieri cheie cu clienții, am gestionat angajările la nivel de companie, și am orchestrat integrarea între CoreBuild și partenerul său de achiziție. Am unificat echipele de vânzări, tehnice și de suport în timpul acestei tranziții și am contribuit direct la o creștere de 50% a veniturilor și bazei de clienți în primul an. Am definit, de asemenea, foile de parcurs strategice și am aliniat operațiunile de angajare, livrare și financiare pentru a susține obiectivele pe termen lung.',
    
    // End-to-End Section
    'endToEnd.title': 'De la cod la sala de consiliu',
    'endToEnd.journey.reverseEngineering.from': 'Inginerie inversă SDK-uri',
    'endToEnd.journey.reverseEngineering.to': 'aplicații App Store livrate',
    'endToEnd.journey.compliance.from': 'Fluxuri de conformitate proiectate',
    'endToEnd.journey.compliance.to': 'CFDI 4.0 integrat',
    'endToEnd.journey.leadership.from': 'Sprint-uri conduse',
    'endToEnd.journey.leadership.to': 'ședințe de consiliu prezidiate',
    'endToEnd.journey.technical.from': 'Firmware construit',
    'endToEnd.journey.technical.to': 'echipe SaaS scalate',
    
    // Footer
    'footer.copyright': 'Creat cu Codex + GPT-4 de Adrian Pop · © 2025',
    
    // Theme Selector
    'theme.title': 'Temă',
    'theme.colorThemes': 'Teme de Culori',
    'theme.customColors': 'Culori Personalizate',
    'theme.primary': 'Principal',
    'theme.background': 'Fundal',
    'theme.text': 'Text',
    'theme.accent': 'Accent',
    'theme.resetDefault': 'Resetează la Implicit',
    'theme.default': 'Implicit',
    'theme.ocean': 'Ocean',
    'theme.forest': 'Pădure',
    'theme.sunset': 'Apus',
    'theme.purple': 'Violet',
    
    // Cookie Consent
    'cookie.title': 'Preferințe Cookie-uri',
    'cookie.description': 'Folosim cookie-uri pentru a îmbunătăți experiența dvs., pentru a vă aminti preferințele de temă și pentru a analiza utilizarea site-ului. Datele dvs. sunt procesate în conformitate cu reglementările GDPR.',
    'cookie.acceptAll': 'Accept Toate',
    'cookie.necessaryOnly': 'Doar Necesare',
    'cookie.settings': 'Setări',
    'cookie.privacySettings': 'Setări de Confidențialitate',
    'cookie.privacyDescription': 'Gestionați preferințele dvs. pentru cookie-uri și consimțământul pentru procesarea datelor.',
    'cookie.necessary': 'Necesare',
    'cookie.necessaryDesc': 'Necesare pentru funcționalitatea de bază',
    'cookie.preferences': 'Preferințe',
    'cookie.preferencesDesc': 'Reține tema și setările dvs.',
    'cookie.analytics': 'Analize',
    'cookie.analyticsDesc': 'Ne ajută să îmbunătățim site-ul',
    'cookie.marketing': 'Marketing',
    'cookie.marketingDesc': 'Conținut personalizat',
    'cookie.disclaimer': 'Datele sunt stocate local și procesate conform ghidurilor GDPR. Puteți schimba aceste preferințe oricând.',
    'cookie.savePreferences': 'Salvează Preferințele',
    'cookie.cancel': 'Anulează',
  }
};

export const TranslationContext = createContext<TranslationContextType | null>(null);

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

export const useTranslationState = () => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'EN';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return {
    language,
    setLanguage,
    t,
  };
};