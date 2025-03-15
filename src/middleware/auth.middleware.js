const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

/**
 * Middleware pour protéger les routes nécessitant une authentification
 * Vérifie la présence et la validité du token JWT
 */
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Vérifier si le token est présent dans les headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Si pas de token, retourner une erreur
    if (!token) {
      return res.status(401).json({
        error: req.t('auth.noToken') || 'Veuillez vous connecter pour accéder à cette ressource'
      });
    }
    
    try {
      // Vérifier le token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Trouver l'utilisateur correspondant
      const user = await User.findById(decoded.id);
      
      // Si l'utilisateur n'existe pas ou n'est pas actif
      if (!user || !user.active) {
        return res.status(401).json({
          error: req.t('auth.invalidUser') || 'Cet utilisateur n\'existe plus ou a été désactivé'
        });
      }
      
      // Ajouter l'utilisateur à la requête
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        error: req.t('auth.invalidToken') || 'Token invalide ou expiré'
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: req.t('errors.server') || 'Erreur serveur'
    });
  }
};

/**
 * Middleware pour restreindre l'accès aux rôles spécifiés
 * @param {...String} roles - Les rôles autorisés
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Vérifier si le rôle de l'utilisateur est dans la liste des rôles autorisés
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: req.t('auth.unauthorized') || 'Vous n\'êtes pas autorisé à effectuer cette action'
      });
    }
    
    next();
  };
};
