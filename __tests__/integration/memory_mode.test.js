const request = require('supertest');
const app = require('../../server/src/app');

// Sauvegarde de la variable d'environnement originale
const originalMongoDBURI = process.env.MONGODB_URI;

describe('Mode mémoire', () => {
  beforeAll(() => {
    // Forcer le mode mémoire en supprimant la variable d'environnement MONGODB_URI
    delete process.env.MONGODB_URI;
  });

  afterAll(() => {
    // Restaurer la variable d'environnement originale
    process.env.MONGODB_URI = originalMongoDBURI;
  });

  describe('Authentification en mode mémoire', () => {
    it('devrait permettre l\'inscription d\'un utilisateur', async () => {
      const userData = {
        firstName: 'Test',
        lastName: 'Utilisateur',
        email: 'test.memory@example.com',
        password: 'MotDePasse123!',
        confirmPassword: 'MotDePasse123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body).toHaveProperty('token');
    });

    it('devrait permettre la connexion d\'un utilisateur enregistré', async () => {
      // Créer d'abord un utilisateur
      const userData = {
        firstName: 'Connexion',
        lastName: 'Test',
        email: 'connexion.memory@example.com',
        password: 'MotDePasse123!',
        confirmPassword: 'MotDePasse123!'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Tenter de se connecter
      const loginData = {
        email: 'connexion.memory@example.com',
        password: 'MotDePasse123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body).toHaveProperty('token');
    });

    it('devrait empêcher l\'inscription avec un email déjà utilisé', async () => {
      // Créer d'abord un utilisateur
      const userData = {
        firstName: 'Duplicate',
        lastName: 'Email',
        email: 'duplicate.memory@example.com',
        password: 'MotDePasse123!',
        confirmPassword: 'MotDePasse123!'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Tenter de créer un autre utilisateur avec le même email
      const duplicateData = {
        firstName: 'Another',
        lastName: 'User',
        email: 'duplicate.memory@example.com',
        password: 'AutreMotDePasse123!',
        confirmPassword: 'AutreMotDePasse123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateData);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });

    it('devrait réinitialiser les données en mémoire lors du redémarrage', async () => {
      // Note: Ce test est plus conceptuel car nous ne pouvons pas réellement redémarrer 
      // le serveur dans un test automatisé. Dans un environnement réel, les données 
      // seraient perdues lors du redémarrage du serveur.
      
      // Ce test documente simplement le comportement attendu
      console.log('Note: En mode mémoire, toutes les données sont perdues lors du redémarrage du serveur.');
    });
  });
});
