// Configuration globale pour Jest
jest.setTimeout(30000); // Timeout de 30 secondes pour les tests

// Fonction utilitaire pour nettoyer les bases de données de test
global.clearDatabase = async () => {
  if (process.env.NODE_ENV === 'test') {
    // Code pour nettoyer la base de données de test
  }
};

// Suppression des logs pendant les tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  // Garder les erreurs et avertissements visibles
  warn: console.warn,
  error: console.error,
};
