const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const configPassport = require('./config/passport');

// Charger les variables d'environnement
dotenv.config();

// Connexion à la base de données
connectDB();

// Initialiser l'application Express
const app = express();

// Middleware pour parser le JSON
app.use(express.json());

// Middleware pour parser les cookies
app.use(cookieParser());

// Configuration de la session pour Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret_de_session_potool',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Initialiser Passport
app.use(passport.initialize());
app.use(passport.session());

// Configurer les stratégies Passport
configPassport();

// Activer CORS avec des options spécifiques
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/team-members', require('./routes/teamMembers'));

// Route de base
app.get('/', (req, res) => {
  res.json({ message: 'Bienvenue sur l\'API POTool' });
});

// Gérer les routes non trouvées
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Gérer les erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur' });
});

// Définir le port
const PORT = process.env.PORT || 3000;

// Démarrer le serveur
const server = app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

// Gérer les arrêts non gérés
process.on('unhandledRejection', (err, promise) => {
  console.log(`Erreur: ${err.message}`);
  // Fermer le serveur et quitter le processus
  server.close(() => process.exit(1));
});

module.exports = server;
