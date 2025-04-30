const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Pour les tests, on peut fonctionner sans MongoDB
    if (!process.env.MONGODB_URI) {
      console.log('Mode test: Fonctionnement sans base de données MongoDB');
      return;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB connecté: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Erreur de connexion à MongoDB: ${error.message}`);
    console.log('Fonctionnement en mode mémoire (sans persistance)');
  }
};

module.exports = connectDB;
