const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload.middleware');
const path = require('path');
const fs = require('fs');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// Route pour uploader une image
router.post('/photo', protect, upload.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier n\'a été uploadé' });
    }
    
    // Construire l'URL relative du fichier
    const fileUrl = `/uploads/${req.file.filename}`;
    
    // Retourner l'URL du fichier avec l'URL complète
    const protocol = req.protocol;
    const host = req.get('host');
    const fullUrl = `${protocol}://${host}${fileUrl}`;
    
    res.status(200).json({
      success: true,
      fileUrl: fullUrl, // URL complète
      relativeUrl: fileUrl, // URL relative pour référence
      fileName: req.file.filename,
      message: 'Image uploadée avec succès'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Une erreur est survenue lors de l\'upload de l\'image'
    });
  }
});

// Route pour supprimer une image
router.delete('/photo/:filename', protect, restrictTo('admin'), (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads', filename);
    
    // Vérifier si le fichier existe
    if (fs.existsSync(filePath)) {
      // Supprimer le fichier
      fs.unlinkSync(filePath);
      res.status(200).json({
        success: true,
        message: 'Image supprimée avec succès'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Image non trouvée'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Une erreur est survenue lors de la suppression de l\'image'
    });
  }
});

module.exports = router;
