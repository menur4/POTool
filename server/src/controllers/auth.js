const User = require('../models/User');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Base de données en mémoire pour les tests
const users = [];

// Fonction pour générer un token JWT
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || 'potool_secret_key',
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

// Fonction pour formater les données utilisateur pour la réponse
const formatUserResponse = (user) => {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    language: user.language,
    google: user.google ? {
      id: user.google.id,
      email: user.google.email
    } : null
  };
};

// @desc    Inscrire un utilisateur
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, language } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const userExists = users.find(user => user.email === email);

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Créer un nouvel utilisateur
    const userId = crypto.randomBytes(16).toString('hex');
    const user = {
      _id: userId,
      firstName,
      lastName,
      email,
      password, // Dans un cas réel, on hasherait le mot de passe
      role: 'user',
      language: language || 'french',
      createdAt: new Date()
    };

    users.push(user);

    // Générer un token
    const token = generateToken(userId, 'user');

    res.status(201).json({
      success: true,
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription'
    });
  }
};

// @desc    Connecter un utilisateur
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Valider l'email et le mot de passe
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un email et un mot de passe'
      });
    }

    // Vérifier si l'utilisateur existe
    const user = users.find(user => user.email === email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier si le mot de passe correspond
    // Dans un cas réel, on comparerait avec bcrypt
    const isMatch = user.password === password;

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Générer un token
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion'
    });
  }
};

// @desc    Obtenir l'utilisateur actuel
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = users.find(user => user._id === req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      user: formatUserResponse(user)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données utilisateur'
    });
  }
};

// @desc    Demande de réinitialisation de mot de passe
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const userIndex = users.findIndex(user => user.email === req.body.email);

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Aucun utilisateur trouvé avec cet email'
      });
    }

    // Générer un token de réinitialisation
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Mettre à jour l'utilisateur avec le token
    users[userIndex].resetPasswordToken = resetPasswordToken;
    users[userIndex].resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Dans un environnement réel, nous enverrions un email ici
    // Pour le test, nous retournons simplement le token
    
    res.status(200).json({
      success: true,
      message: 'Email de réinitialisation envoyé',
      resetToken // Normalement, on ne renverrait pas le token, mais pour les tests c'est utile
    });
  } catch (error) {
    console.error(error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de l\'email de réinitialisation'
    });
  }
};

// @desc    Réinitialiser le mot de passe
// @route   PUT /api/auth/reset-password/:resetToken
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    // Hasher le token de la requête
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resetToken)
      .digest('hex');

    // Trouver l'utilisateur avec le token
    const userIndex = users.findIndex(user => 
      user.resetPasswordToken === resetPasswordToken && 
      user.resetPasswordExpire > Date.now()
    );

    if (userIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }

    // Définir le nouveau mot de passe
    users[userIndex].password = req.body.password;
    users[userIndex].resetPasswordToken = undefined;
    users[userIndex].resetPasswordExpire = undefined;

    // Générer un nouveau token
    const token = generateToken(users[userIndex]._id, users[userIndex].role);

    res.status(200).json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation du mot de passe'
    });
  }
};

// @desc    Callback pour l'authentification Google
// @route   GET /api/auth/google/callback
// @access  Public
exports.googleCallback = (req, res) => {
  try {
    // L'utilisateur est déjà authentifié par Passport à ce stade
    const user = req.user;
    
    // Générer un token JWT
    const token = generateToken(user._id, user.role);
    
    // Rediriger vers une page spécifique du frontend avec le token en paramètre
    return res.redirect(`http://localhost:3001/login-success?token=${token}`);
  } catch (error) {
    console.error('Erreur lors du callback Google:', error);
    return res.redirect('http://localhost:3001/login?error=auth_failed');
  }
};
