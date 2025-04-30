const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const mongoose = require('mongoose');

// Base de données en mémoire pour les tests
let users = [];

// Fonction pour trouver un utilisateur par son ID Google
const findUserByGoogleId = async (googleId) => {
  if (mongoose.connection.readyState === 1) {
    // Si MongoDB est connecté, utiliser MongoDB
    return await User.findOne({ 'google.id': googleId });
  } else {
    // Sinon, utiliser la base de données en mémoire
    return users.find(user => user.google && user.google.id === googleId);
  }
};

// Fonction pour trouver un utilisateur par son email
const findUserByEmail = async (email) => {
  if (mongoose.connection.readyState === 1) {
    // Si MongoDB est connecté, utiliser MongoDB
    return await User.findOne({ email });
  } else {
    // Sinon, utiliser la base de données en mémoire
    return users.find(user => user.email === email);
  }
};

// Fonction pour créer un nouvel utilisateur
const createUser = async (userData) => {
  if (mongoose.connection.readyState === 1) {
    // Si MongoDB est connecté, utiliser MongoDB
    return await User.create(userData);
  } else {
    // Sinon, utiliser la base de données en mémoire
    const newUser = {
      _id: Math.random().toString(36).substring(2, 15),
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    users.push(newUser);
    return newUser;
  }
};

// Configuration de Passport
module.exports = () => {
  // Sérialisation de l'utilisateur pour la session
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  // Désérialisation de l'utilisateur à partir de la session
  passport.deserializeUser(async (id, done) => {
    try {
      let user;
      if (mongoose.connection.readyState === 1) {
        // Si MongoDB est connecté, utiliser MongoDB
        user = await User.findById(id);
      } else {
        // Sinon, utiliser la base de données en mémoire
        user = users.find(u => u._id === id);
      }
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Configuration de la stratégie Google OAuth
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
        proxy: true
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Vérifier si l'utilisateur existe déjà
          let user = await findUserByGoogleId(profile.id);

          // Si l'utilisateur n'existe pas, vérifier s'il existe avec cet email
          if (!user) {
            const email = profile.emails[0].value;
            user = await findUserByEmail(email);

            if (user) {
              // Si l'utilisateur existe avec cet email, mettre à jour ses informations Google
              if (mongoose.connection.readyState === 1) {
                // Si MongoDB est connecté, utiliser MongoDB
                user.google = {
                  id: profile.id,
                  email: profile.emails[0].value,
                  name: profile.displayName
                };
                await user.save();
              } else {
                // Sinon, mettre à jour dans la base de données en mémoire
                const index = users.findIndex(u => u.email === email);
                if (index !== -1) {
                  users[index].google = {
                    id: profile.id,
                    email: profile.emails[0].value,
                    name: profile.displayName
                  };
                  users[index].updatedAt = new Date();
                }
              }
            } else {
              // Si l'utilisateur n'existe pas du tout, créer un nouvel utilisateur
              const newUser = {
                firstName: profile.name.givenName || profile.displayName.split(' ')[0],
                lastName: profile.name.familyName || profile.displayName.split(' ').slice(1).join(' '),
                email: profile.emails[0].value,
                role: 'member',
                active: true,
                google: {
                  id: profile.id,
                  email: profile.emails[0].value,
                  name: profile.displayName
                },
                password: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
              };
              
              user = await createUser(newUser);
            }
          }

          // Retourner l'utilisateur
          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
};

// Exporter la liste des utilisateurs en mémoire pour les tests
module.exports.users = users;
