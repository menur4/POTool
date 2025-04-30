const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Fonction pour générer un token JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '1d' }
  );
};

// Callback après authentification Google réussie
exports.googleCallback = (req, res) => {
  try {
    // L'utilisateur est disponible dans req.user grâce à Passport
    const user = req.user;
    
    if (!user) {
      return res.redirect('http://localhost:3000/login?error=authentication_failed');
    }
    
    // Générer un token JWT
    const token = generateToken(user);
    
    // Définir le token comme cookie sécurisé
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 1 jour
    });
    
    // Rediriger vers le frontend avec le token
    res.redirect(`http://localhost:3000/auth/success?token=${token}`);
  } catch (error) {
    console.error('Erreur lors du callback Google:', error);
    res.redirect('http://localhost:3000/login?error=server_error');
  }
};

// Route pour vérifier l'état de l'authentification
exports.checkAuth = (req, res) => {
  if (req.user) {
    res.status(200).json({
      success: true,
      message: "Utilisateur authentifié",
      user: req.user
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Utilisateur non authentifié"
    });
  }
};

// Déconnexion
exports.logout = (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
};
