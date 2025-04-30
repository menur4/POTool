const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Route temporaire pour générer un token avec rôle admin (UNIQUEMENT POUR LE DÉVELOPPEMENT)
router.get('/generate-admin-token', (req, res) => {
  // Vérifier que l'environnement est bien en développement
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      message: 'Cette route n\'est disponible qu\'en environnement de développement'
    });
  }

  try {
    // Créer un utilisateur temporaire avec rôle admin
    const user = {
      id: 'temp-admin-user',
      firstName: 'Admin',
      lastName: 'Temporaire',
      email: 'admin@example.com',
      role: 'admin'
    };

    // Générer un token JWT valide pour 24 heures
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Stocker le token dans un fichier pour un accès facile
    const fs = require('fs');
    fs.writeFileSync('.token', token);

    res.status(200).json({
      success: true,
      message: 'Token admin généré avec succès (valide pour 24h)',
      token,
      user
    });
  } catch (error) {
    console.error('Erreur lors de la génération du token:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du token'
    });
  }
});

module.exports = router;
