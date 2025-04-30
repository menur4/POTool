const express = require('express');
const cors = require('cors');
const i18next = require('i18next');
const i18nextMiddleware = require('i18next-http-middleware');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const session = require('express-session');
const passport = require('./config/passport');
const { connectDB } = require('./config/database');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const teamMembersRoutes = require('./routes/teamMembers.routes');
const uploadRoutes = require('./routes/upload.routes');
const devRoutes = require('./routes/dev.routes'); // Routes pour le développement

// Charger les variables d'environnement
dotenv.config();

// Afficher l'environnement actuel
console.log(`Environnement: ${process.env.NODE_ENV || 'development'}`);

// Initialiser l'application Express
const app = express();

// Middleware de sécurité
app.use(helmet()); // Sécuriser les en-têtes HTTP
app.use(xss()); // Prévenir les attaques XSS
app.use(mongoSanitize()); // Prévenir les injections NoSQL

// Limiter les requêtes pour prévenir les attaques par force brute
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer après 15 minutes'
});
app.use('/api/auth', limiter);

// Middleware de base
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10kb' })); // Limiter la taille des requêtes JSON
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Configuration de la session
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Initialisation de Passport
app.use(passport.initialize());
app.use(passport.session());

// Configuration i18next
i18next.init({
  lng: process.env.DEFAULT_LANGUAGE || 'fr',
  fallbackLng: 'fr',
  resources: {
    fr: {
      translation: require('./locales/fr.json')
    },
    en: {
      translation: require('./locales/en.json')
    },
    ar: {
      translation: require('./locales/ar.json')
    }
  }
});

app.use(i18nextMiddleware.handle(i18next));

// Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: req.t('health.ok') });
});

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Routes des membres d'équipe
app.use('/api/team-members', teamMembersRoutes);

// Routes d'upload de fichiers
app.use('/api/upload', uploadRoutes);

// Servir les fichiers statiques du dossier uploads avec les en-têtes CORS appropriés
app.use('/uploads', (req, res, next) => {
  // Configurer les en-têtes CORS pour permettre l'accès aux images
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Routes de développement (uniquement en environnement de développement)
if (process.env.NODE_ENV === 'development') {
  app.use('/api/dev', devRoutes);
}

// Gestionnaire pour les routes non trouvées
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: req.t('errors.notFound') || `Route ${req.originalUrl} non trouvée`
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Gérer les erreurs de validation Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(el => el.message);
    return res.status(400).json({
      status: 'error',
      message: req.t('errors.validation') || 'Erreur de validation',
      errors
    });
  }
  
  // Gérer les erreurs de duplication MongoDB
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      status: 'error',
      message: req.t('errors.duplicate', { field }) || `${field} existe déjà`
    });
  }
  
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || req.t('errors.server') || 'Une erreur est survenue'
  });
});

module.exports = app;
