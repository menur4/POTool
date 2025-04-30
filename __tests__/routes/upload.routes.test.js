const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../../src/app');
const { generateToken } = require('../../src/utils/tokenUtils');
const User = require('../../src/models/User');

// Mock pour le middleware d'authentification
jest.mock('../../src/middleware/auth.middleware', () => ({
  protect: (req, res, next) => {
    req.user = { id: 'mockUserId', role: 'admin' };
    next();
  },
  restrictTo: (...roles) => (req, res, next) => {
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Non autorisé' });
    }
  }
}));

// Mock pour multer
jest.mock('multer', () => {
  const multer = () => ({
    single: () => (req, res, next) => {
      req.file = {
        filename: 'test-photo-123456789.jpg',
        path: '/path/to/uploads/test-photo-123456789.jpg',
        mimetype: 'image/jpeg',
        size: 12345
      };
      next();
    }
  });
  multer.diskStorage = () => ({});
  return multer;
});

describe('Upload Routes', () => {
  let token;

  beforeAll(() => {
    // Créer un token pour les tests
    token = generateToken({ id: 'mockUserId', role: 'admin' });
  });

  describe('POST /api/upload/photo', () => {
    it('devrait uploader une photo avec succès', async () => {
      const response = await request(app)
        .post('/api/upload/photo')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', Buffer.from('mock image data'), 'test.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.fileUrl).toBeDefined();
      expect(response.body.fileName).toBeDefined();
      expect(response.body.message).toBe('Image uploadée avec succès');
    });

    it('devrait retourner une erreur si aucun fichier n\'est fourni', async () => {
      // Simuler une requête sans fichier
      jest.mock('multer', () => {
        const multer = () => ({
          single: () => (req, res, next) => {
            req.file = null;
            next();
          }
        });
        multer.diskStorage = () => ({});
        return multer;
      });

      const response = await request(app)
        .post('/api/upload/photo')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Aucun fichier n\'a été uploadé');
    });
  });

  describe('DELETE /api/upload/photo/:filename', () => {
    it('devrait supprimer une photo avec succès', async () => {
      // Mock pour fs.existsSync et fs.unlinkSync
      const originalExistsSync = fs.existsSync;
      const originalUnlinkSync = fs.unlinkSync;
      
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.unlinkSync = jest.fn();

      const response = await request(app)
        .delete('/api/upload/photo/test-photo-123456789.jpg')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Image supprimée avec succès');
      
      // Restaurer les fonctions originales
      fs.existsSync = originalExistsSync;
      fs.unlinkSync = originalUnlinkSync;
    });

    it('devrait retourner une erreur si le fichier n\'existe pas', async () => {
      // Mock pour fs.existsSync
      const originalExistsSync = fs.existsSync;
      fs.existsSync = jest.fn().mockReturnValue(false);

      const response = await request(app)
        .delete('/api/upload/photo/nonexistent.jpg')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Image non trouvée');
      
      // Restaurer la fonction originale
      fs.existsSync = originalExistsSync;
    });
  });
});
