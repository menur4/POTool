const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Fonction pour obtenir l'URI MongoDB en fonction de l'environnement
const getMongoURI = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return process.env.MONGODB_URI_PROD;
    case 'preprod':
      return process.env.MONGODB_URI_PREPROD;
    case 'development':
    default:
      return process.env.MONGODB_URI;
  }
};

// Fonction pour se connecter à MongoDB
const connectDB = async () => {
  try {
    const mongoURI = getMongoURI();
    
    if (!mongoURI) {
      console.warn('Aucune URI MongoDB trouvée. Mode stockage en mémoire activé.');
      return false;
    }
    
    const conn = await mongoose.connect(mongoURI, {
      // Ces options sont les valeurs par défaut dans les versions récentes de Mongoose
    });
    
    console.log(`MongoDB connecté: ${conn.connection.host} (${process.env.NODE_ENV})`);
    return true;
  } catch (error) {
    console.error(`Erreur de connexion à MongoDB: ${error.message}`);
    return false;
  }
};

module.exports = {
  connectDB,
  getMongoURI
};
