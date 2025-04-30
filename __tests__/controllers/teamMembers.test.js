const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const TeamMember = require('../../server/src/models/TeamMember');
const User = require('../../server/src/models/User');
const teamMembersController = require('../../server/src/controllers/teamMembers');
const { protect, authorize } = require('../../server/src/middleware/auth');

// Créer une application Express pour les tests
const app = express();
app.use(express.json());

// Simuler le middleware d'authentification pour les tests
jest.mock('../../server/src/middleware/auth', () => ({
  protect: jest.fn((req, res, next) => {
    req.user = {
      _id: 'user123',
      role: 'admin'
    };
    next();
  }),
  authorize: jest.fn(() => (req, res, next) => next())
}));

// Configurer les routes pour les tests
app.get('/api/team-members', protect, teamMembersController.getTeamMembers);
app.get('/api/team-members/:id', protect, teamMembersController.getTeamMember);
app.post('/api/team-members', protect, authorize('admin'), teamMembersController.createTeamMember);
app.put('/api/team-members/:id', protect, authorize('admin'), teamMembersController.updateTeamMember);
app.delete('/api/team-members/:id', protect, authorize('admin'), teamMembersController.deleteTeamMember);
app.put('/api/team-members/:id/toggle-status', protect, authorize('admin'), teamMembersController.toggleTeamMemberStatus);

let mongoServer;

// Configuration de la base de données en mémoire pour les tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

// Nettoyage après tous les tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Nettoyage après chaque test
afterEach(async () => {
  await TeamMember.deleteMany({});
  jest.clearAllMocks();
});

describe('Team Members Controller', () => {
  describe('GET /api/team-members', () => {
    it('devrait récupérer tous les membres de l\'équipe', async () => {
      // Créer quelques membres pour le test
      await TeamMember.create([
        {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
          role: 'developer',
          dailyRate: 500
        },
        {
          firstName: 'Marie',
          lastName: 'Martin',
          email: 'marie.martin@example.com',
          role: 'designer',
          dailyRate: 600
        }
      ]);

      const res = await request(app).get('/api/team-members');
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('firstName');
      expect(res.body.data[0]).toHaveProperty('lastName');
      expect(res.body.data[0]).toHaveProperty('email');
      expect(res.body.data[0]).toHaveProperty('role');
      expect(res.body.data[0]).toHaveProperty('dailyRate');
    });

    it('devrait gérer les erreurs lors de la récupération des membres', async () => {
      // Simuler une erreur de base de données
      jest.spyOn(TeamMember, 'find').mockImplementationOnce(() => {
        throw new Error('Erreur de base de données');
      });

      const res = await request(app).get('/api/team-members');
      
      expect(res.statusCode).toEqual(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });
  });

  describe('GET /api/team-members/:id', () => {
    it('devrait récupérer un membre spécifique par ID', async () => {
      // Créer un membre pour le test
      const teamMember = await TeamMember.create({
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        role: 'developer',
        dailyRate: 500
      });

      const res = await request(app).get(`/api/team-members/${teamMember._id}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id', teamMember._id.toString());
      expect(res.body.data).toHaveProperty('firstName', 'Jean');
      expect(res.body.data).toHaveProperty('lastName', 'Dupont');
      expect(res.body.data).toHaveProperty('email', 'jean.dupont@example.com');
    });

    it('devrait retourner une erreur 404 pour un ID inexistant', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/team-members/${nonExistentId}`);
      
      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });
  });

  describe('POST /api/team-members', () => {
    it('devrait créer un nouveau membre', async () => {
      const newTeamMember = {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        role: 'developer',
        dailyRate: 500
      };

      const res = await request(app)
        .post('/api/team-members')
        .send(newTeamMember);
      
      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data).toHaveProperty('firstName', 'Jean');
      expect(res.body.data).toHaveProperty('lastName', 'Dupont');
      expect(res.body.data).toHaveProperty('email', 'jean.dupont@example.com');
      expect(res.body.data).toHaveProperty('role', 'developer');
      expect(res.body.data).toHaveProperty('dailyRate', 500);
      expect(res.body.data).toHaveProperty('active', true);
    });

    it('devrait retourner une erreur 400 pour des données invalides', async () => {
      const invalidTeamMember = {
        // Manque firstName et lastName
        email: 'jean.dupont@example.com',
        role: 'developer',
        dailyRate: 500
      };

      const res = await request(app)
        .post('/api/team-members')
        .send(invalidTeamMember);
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });
  });

  describe('PUT /api/team-members/:id', () => {
    it('devrait mettre à jour un membre existant', async () => {
      // Créer un membre pour le test
      const teamMember = await TeamMember.create({
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        role: 'developer',
        dailyRate: 500
      });

      const updatedData = {
        firstName: 'Jean-Pierre',
        dailyRate: 550
      };

      const res = await request(app)
        .put(`/api/team-members/${teamMember._id}`)
        .send(updatedData);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('firstName', 'Jean-Pierre');
      expect(res.body.data).toHaveProperty('lastName', 'Dupont'); // Inchangé
      expect(res.body.data).toHaveProperty('dailyRate', 550);
    });

    it('devrait retourner une erreur 404 pour un ID inexistant', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updatedData = {
        firstName: 'Jean-Pierre',
        dailyRate: 550
      };

      const res = await request(app)
        .put(`/api/team-members/${nonExistentId}`)
        .send(updatedData);
      
      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });
  });

  describe('DELETE /api/team-members/:id', () => {
    it('devrait supprimer un membre existant', async () => {
      // Créer un membre pour le test
      const teamMember = await TeamMember.create({
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        role: 'developer',
        dailyRate: 500
      });

      const res = await request(app).delete(`/api/team-members/${teamMember._id}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      
      // Vérifier que le membre a bien été supprimé
      const deletedMember = await TeamMember.findById(teamMember._id);
      expect(deletedMember).toBeNull();
    });

    it('devrait retourner une erreur 404 pour un ID inexistant', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app).delete(`/api/team-members/${nonExistentId}`);
      
      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });
  });

  describe('PUT /api/team-members/:id/toggle-status', () => {
    it('devrait basculer le statut d\'un membre de actif à inactif', async () => {
      // Créer un membre actif pour le test
      const teamMember = await TeamMember.create({
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        role: 'developer',
        dailyRate: 500,
        active: true
      });

      const res = await request(app).put(`/api/team-members/${teamMember._id}/toggle-status`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('active', false);
    });

    it('devrait basculer le statut d\'un membre de inactif à actif', async () => {
      // Créer un membre inactif pour le test
      const teamMember = await TeamMember.create({
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        role: 'developer',
        dailyRate: 500,
        active: false
      });

      const res = await request(app).put(`/api/team-members/${teamMember._id}/toggle-status`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('active', true);
    });

    it('devrait retourner une erreur 404 pour un ID inexistant', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app).put(`/api/team-members/${nonExistentId}/toggle-status`);
      
      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });
  });
});
