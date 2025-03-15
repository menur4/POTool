const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const jwt = require('jsonwebtoken');

let mongoServer;

beforeAll(async () => {
  // Configurer MongoDB en mémoire pour les tests
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  
  // S'assurer que le secret JWT est défini pour les tests
  process.env.JWT_SECRET = 'test_jwt_secret_key';
  process.env.JWT_EXPIRES_IN = '1h';
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Nettoyer la base de données avant chaque test
  await User.deleteMany({});
});

describe('Contrôleur d\'authentification', () => {
  describe('POST /api/auth/register', () => {
    it('devrait créer un nouvel utilisateur', async () => {
      const userData = {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        password: 'MotDePasse123!',
        confirmPassword: 'MotDePasse123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('_id');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body).toHaveProperty('token');
    });

    it('devrait retourner une erreur 400 si les mots de passe ne correspondent pas', async () => {
      const userData = {
        firstName: 'Pierre',
        lastName: 'Martin',
        email: 'pierre.martin@example.com',
        password: 'MotDePasse123!',
        confirmPassword: 'MotDePasseDifferent!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('mot de passe');
    });

    it('devrait retourner une erreur 400 si l\'email est déjà utilisé', async () => {
      // Créer un utilisateur
      await User.create({
        firstName: 'Existant',
        lastName: 'Utilisateur',
        email: 'utilisateur.existant@example.com',
        password: 'MotDePasse123!',
        role: 'member'
      });

      // Tenter de créer un utilisateur avec le même email
      const userData = {
        firstName: 'Nouveau',
        lastName: 'Utilisateur',
        email: 'utilisateur.existant@example.com',
        password: 'MotDePasse123!',
        confirmPassword: 'MotDePasse123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });
  });

  describe('POST /api/auth/login', () => {
    it('devrait connecter un utilisateur avec des identifiants valides', async () => {
      // Créer un utilisateur
      const user = await User.create({
        firstName: 'Sophie',
        lastName: 'Dubois',
        email: 'sophie.dubois@example.com',
        password: 'MotDePasse123!',
        role: 'member'
      });

      const loginData = {
        email: 'sophie.dubois@example.com',
        password: 'MotDePasse123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user._id).toBe(user._id.toString());
      expect(response.body).toHaveProperty('token');
      
      // Vérifier que le token est valide
      const decodedToken = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decodedToken).toHaveProperty('id', user._id.toString());
    });

    it('devrait retourner une erreur 401 avec un email invalide', async () => {
      const loginData = {
        email: 'email.inexistant@example.com',
        password: 'MotDePasse123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('devrait retourner une erreur 401 avec un mot de passe invalide', async () => {
      // Créer un utilisateur
      await User.create({
        firstName: 'Marie',
        lastName: 'Leroy',
        email: 'marie.leroy@example.com',
        password: 'MotDePasse123!',
        role: 'member'
      });

      const loginData = {
        email: 'marie.leroy@example.com',
        password: 'MauvaisMotDePasse!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('devrait générer un token de réinitialisation pour un email valide', async () => {
      // Créer un utilisateur
      await User.create({
        firstName: 'Paul',
        lastName: 'Bernard',
        email: 'paul.bernard@example.com',
        password: 'MotDePasse123!',
        role: 'member'
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'paul.bernard@example.com' });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message');
      
      // Vérifier que le token a été généré dans la base de données
      const user = await User.findOne({ email: 'paul.bernard@example.com' });
      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpires).toBeDefined();
    });

    it('devrait retourner un message de succès même si l\'email n\'existe pas (sécurité)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'email.inexistant@example.com' });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('devrait réinitialiser le mot de passe avec un token valide', async () => {
      // Créer un utilisateur avec un token de réinitialisation
      const user = new User({
        firstName: 'Thomas',
        lastName: 'Petit',
        email: 'thomas.petit@example.com',
        password: 'MotDePasse123!',
        role: 'member'
      });
      
      // Générer un token de réinitialisation
      user.generatePasswordReset();
      await user.save();
      
      const resetData = {
        token: user.resetPasswordToken,
        password: 'NouveauMotDePasse123!',
        confirmPassword: 'NouveauMotDePasse123!'
      };

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message');
      
      // Vérifier que le mot de passe a été mis à jour
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.resetPasswordToken).toBeUndefined();
      expect(updatedUser.resetPasswordExpires).toBeUndefined();
      
      // Vérifier que le nouveau mot de passe fonctionne
      const isPasswordValid = await updatedUser.comparePassword('NouveauMotDePasse123!');
      expect(isPasswordValid).toBe(true);
    });

    it('devrait retourner une erreur 400 si le token est invalide', async () => {
      const resetData = {
        token: 'token_invalide',
        password: 'NouveauMotDePasse123!',
        confirmPassword: 'NouveauMotDePasse123!'
      };

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('devrait retourner une erreur 400 si le token a expiré', async () => {
      // Créer un utilisateur avec un token de réinitialisation expiré
      const user = new User({
        firstName: 'Lucie',
        lastName: 'Moreau',
        email: 'lucie.moreau@example.com',
        password: 'MotDePasse123!',
        role: 'member'
      });
      
      // Générer un token de réinitialisation expiré
      user.resetPasswordToken = 'token_valide_mais_expire';
      user.resetPasswordExpires = new Date(Date.now() - 3600000); // Expiré il y a 1 heure
      await user.save();
      
      const resetData = {
        token: user.resetPasswordToken,
        password: 'NouveauMotDePasse123!',
        confirmPassword: 'NouveauMotDePasse123!'
      };

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    it('devrait retourner les informations de l\'utilisateur connecté', async () => {
      // Créer un utilisateur
      const user = await User.create({
        firstName: 'Emma',
        lastName: 'Roux',
        email: 'emma.roux@example.com',
        password: 'MotDePasse123!',
        role: 'member'
      });
      
      // Générer un token JWT
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('_id', user._id.toString());
      expect(response.body).toHaveProperty('email', user.email);
      expect(response.body).not.toHaveProperty('password');
    });

    it('devrait retourner une erreur 401 sans token d\'authentification', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('devrait retourner une erreur 401 avec un token invalide', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token_invalide');

      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});
