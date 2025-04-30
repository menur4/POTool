/**
 * Configuration du port pour le serveur
 * Ce fichier permet de changer facilement le port utilisé par l'application
 */

const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Définir le port par défaut
const PORT = process.env.PORT || 3001;

module.exports = PORT;
