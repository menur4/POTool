const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getEpics,
  getEpic,
  createEpic,
  updateEpic,
  deleteEpic,
  deleteEpics,
  previewImport,
  importEpics,
  assignToSprint,
  getStats,
  getEntityLabels
} = require('../controllers/epic.controller');
const { protect } = require('../middleware/auth.middleware');

// Configuration multer pour l'upload de fichiers Excel
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter les fichiers Excel
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
      'text/csv',
      'text/plain'
    ];
    const allowedExtensions = ['.xls', '.xlsx', '.csv'];

    const hasValidMime = allowedMimes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some(ext =>
      file.originalname.toLowerCase().endsWith(ext)
    );

    if (hasValidMime || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté. Utilisez .xls, .xlsx ou .csv'));
    }
  }
});

// Temporairement désactivé pour le développement
// router.use(protect);

// Routes statistiques
router.get('/stats', getStats);

// Route pour récupérer les labels d'entité uniques
router.get('/entity-labels', getEntityLabels);

// Routes d'import
router.post('/import/preview', upload.single('file'), previewImport);
router.post('/import', upload.single('file'), importEpics);

// Route de suppression en masse
router.delete('/bulk', deleteEpics);

// Routes CRUD standard
router.route('/')
  .get(getEpics)
  .post(createEpic);

router.route('/:id')
  .get(getEpic)
  .put(updateEpic)
  .delete(deleteEpic);

// Route d'assignation au sprint
router.put('/:id/assign-sprint', assignToSprint);

module.exports = router;
