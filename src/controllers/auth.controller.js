const User = require('../models/user.model');
const jwt = require('jsonwebtoken');

/**
 * Génère un token JWT pour un utilisateur
 * @param {String} id - ID de l'utilisateur
 * @returns {String} Token JWT
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

/**
 * Inscription d'un nouvel utilisateur
 * @route POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    
    // Vérifier si les mots de passe correspondent
    if (password !== confirmPassword) {
      return res.status(400).json({
        error: req.t('auth.passwordMismatch') || 'Les mots de passe ne correspondent pas'
      });
    }
    
    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: req.t('auth.emailExists') || 'Cet email est déjà utilisé'
      });
    }
    
    // Créer le nouvel utilisateur
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'member', // Par défaut, les nouveaux utilisateurs sont des membres
      language: req.body.language || 'fr'
    });
    
    // Générer un token JWT
    const token = generateToken(user._id);
    
    // Retourner l'utilisateur et le token
    res.status(201).json({
      user,
      token
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};

/**
 * Connexion d'un utilisateur
 * @route POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Vérifier si l'email et le mot de passe sont fournis
    if (!email || !password) {
      return res.status(400).json({
        error: req.t('auth.provideCredentials') || 'Veuillez fournir un email et un mot de passe'
      });
    }
    
    // Trouver l'utilisateur par email et inclure le mot de passe pour la vérification
    const user = await User.findOne({ email }).select('+password');
    
    // Vérifier si l'utilisateur existe et si le mot de passe est correct
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        error: req.t('auth.invalidCredentials') || 'Email ou mot de passe incorrect'
      });
    }
    
    // Mettre à jour la date de dernière connexion
    await user.updateLastLogin();
    
    // Générer un token JWT
    const token = generateToken(user._id);
    
    // Retourner l'utilisateur et le token
    res.status(200).json({
      user,
      token
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

/**
 * Demande de réinitialisation de mot de passe
 * @route POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Trouver l'utilisateur par email
    const user = await User.findOne({ email });
    
    // Si l'utilisateur existe, générer un token de réinitialisation
    if (user) {
      user.generatePasswordReset();
      await user.save();
      
      // TODO: Envoyer un email avec le lien de réinitialisation
      // Pour l'instant, nous retournons simplement un message de succès
    }
    
    // Pour des raisons de sécurité, toujours retourner un message de succès
    // même si l'email n'existe pas dans la base de données
    res.status(200).json({
      message: req.t('auth.resetSent') || 'Un email de réinitialisation a été envoyé si cet email est associé à un compte'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

/**
 * Réinitialisation de mot de passe
 * @route POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    
    // Vérifier si les mots de passe correspondent
    if (password !== confirmPassword) {
      return res.status(400).json({
        error: req.t('auth.passwordMismatch') || 'Les mots de passe ne correspondent pas'
      });
    }
    
    // Trouver l'utilisateur par token de réinitialisation
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    // Si le token est invalide ou a expiré
    if (!user) {
      return res.status(400).json({
        error: req.t('auth.invalidResetToken') || 'Le token de réinitialisation est invalide ou a expiré'
      });
    }
    
    // Mettre à jour le mot de passe et supprimer le token de réinitialisation
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    // Générer un nouveau token JWT
    const jwtToken = generateToken(user._id);
    
    // Retourner un message de succès et le nouveau token
    res.status(200).json({
      message: req.t('auth.passwordReset') || 'Votre mot de passe a été réinitialisé avec succès',
      token: jwtToken
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

/**
 * Obtenir les informations de l'utilisateur connecté
 * @route GET /api/auth/me
 */
exports.getMe = async (req, res) => {
  try {
    // L'utilisateur est déjà disponible dans req.user grâce au middleware protect
    res.status(200).json(req.user);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

/**
 * Mettre à jour les informations de l'utilisateur connecté
 * @route PUT /api/auth/me
 */
exports.updateMe = async (req, res) => {
  try {
    const { firstName, lastName, language } = req.body;
    
    // Créer un objet avec les champs à mettre à jour
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (language) updateData.language = language;
    
    // Mettre à jour l'utilisateur
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};

/**
 * Changer le mot de passe de l'utilisateur connecté
 * @route PUT /api/auth/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    
    // Vérifier si les nouveaux mots de passe correspondent
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        error: req.t('auth.passwordMismatch') || 'Les nouveaux mots de passe ne correspondent pas'
      });
    }
    
    // Trouver l'utilisateur et inclure le mot de passe pour la vérification
    const user = await User.findById(req.user._id).select('+password');
    
    // Vérifier si le mot de passe actuel est correct
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({
        error: req.t('auth.incorrectPassword') || 'Le mot de passe actuel est incorrect'
      });
    }
    
    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();
    
    // Générer un nouveau token JWT
    const token = generateToken(user._id);
    
    // Retourner un message de succès et le nouveau token
    res.status(200).json({
      message: req.t('auth.passwordChanged') || 'Votre mot de passe a été changé avec succès',
      token
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};
