const app = require('./app');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');

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
