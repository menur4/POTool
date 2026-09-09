const app = require('./app');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');
const { seedHolidays } = require('./services/holiday.service');

// Charger les variables d'environnement
dotenv.config();

// Définir le port (modifié pour éviter les conflits)
const PORT = 3002;

// Fonction pour démarrer le serveur
const startServer = async () => {
  try {
    // Connecter à MongoDB
    const isConnected = await connectDB();
    
    if (!isConnected) {
      console.warn('Mode stockage en mémoire activé - pas de connexion à MongoDB');
    }

    // Auto-seed des jours fériés (FR + MA) pour l'année en cours et l'année suivante
    if (isConnected) {
      const currentYear = new Date().getFullYear();
      const countries = ['FR', 'MA'];
      for (const year of [currentYear, currentYear + 1]) {
        try {
          const result = await seedHolidays(year, countries);
          if (result.created > 0) {
            console.log(`Jours fériés ${year} : ${result.created} créés/mis à jour (${countries.join(', ')})`);
          }
        } catch (error) {
          console.warn(`Impossible de pré-remplir les jours fériés ${year} :`, error.message);
        }
      }
    }

    // Démarrer le serveur Express
    const server = app.listen(PORT, () => {
      console.log(`Serveur démarré sur le port ${PORT} en mode ${process.env.NODE_ENV || 'development'}`);
    });
    
    // Gestion de l'arrêt propre du serveur
    process.on('SIGTERM', () => {
      console.log('SIGTERM reçu. Arrêt du serveur...');
      server.close(() => {
        console.log('Serveur arrêté');
        process.exit(0);
      });
    });
    
    return server;
  } catch (error) {
    console.error(`Erreur lors du démarrage du serveur: ${error.message}`);
    process.exit(1);
  }
};

// Démarrer le serveur
const server = startServer();

module.exports = server;
