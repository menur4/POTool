const request = require('supertest');
const app = require('../../src/app');

describe('Application Express', () => {
  describe('GET /api/health', () => {
    it('devrait retourner un statut 200 et un message de santé', async () => {
      const response = await request(app).get('/api/health');
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('message');
    });
  });

  // Tests pour les futures fonctionnalités
  describe('Internationalisation', () => {
    it('devrait retourner des messages en français par défaut', async () => {
      const response = await request(app).get('/api/health');
      expect(response.body.message).toBe('Le service fonctionne correctement');
    });

    it('devrait retourner des messages en anglais si l\'en-tête Accept-Language est défini', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Accept-Language', 'en');
      expect(response.body.message).toBe('Service is running correctly');
    });
  });
});
