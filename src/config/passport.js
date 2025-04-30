const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Configuration de la sérialisation/désérialisation des utilisateurs
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Configuration de la stratégie Google OAuth 2.0
// Vérifier si les identifiants Google sont disponibles
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3002/api/auth/google/callback",
    scope: ['profile', 'email']
  },
  (accessToken, refreshToken, profile, done) => {
    // Dans une application réelle, vous stockeriez l'utilisateur dans la base de données
    // Pour l'instant, nous utilisons un stockage en mémoire
    const user = {
      id: profile.id,
      displayName: profile.displayName,
      email: profile.emails && profile.emails[0] ? profile.emails[0].value : '',
      photo: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
      accessToken
    };
    
    return done(null, user);
  }
));
}

module.exports = passport;
