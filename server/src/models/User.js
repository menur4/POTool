const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Veuillez fournir un prénom'],
    trim: true,
    maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
  },
  lastName: {
    type: String,
    required: [true, 'Veuillez fournir un nom'],
    trim: true,
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },
  email: {
    type: String,
    required: [true, 'Veuillez fournir un email'],
    unique: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Veuillez fournir un email valide'
    ]
  },
  password: {
    type: String,
    required: [true, 'Veuillez fournir un mot de passe'],
    minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  language: {
    type: String,
    enum: ['french', 'english', 'arabic'],
    default: 'french'
  },
  google: {
    id: {
      type: String,
      sparse: true
    },
    email: String,
    name: String
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Crypter le mot de passe avant de sauvegarder
UserSchema.pre('save', async function(next) {
  // Ne pas hasher le mot de passe s'il n'a pas été modifié ou si l'utilisateur s'authentifie via Google
  if (!this.isModified('password') || this.google.id) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour vérifier si le mot de passe correspond
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Méthode pour générer un token JWT
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// Générer et hasher un token de réinitialisation de mot de passe
UserSchema.methods.getResetPasswordToken = function() {
  // Générer un token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hasher le token et le stocker dans resetPasswordToken
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Définir l'expiration (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model('User', UserSchema);
