const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../../src/app');

// Modèles et contrôleurs à tester (nous les créerons après)
const Sprint = require('../../../src/models/sprint.model');
const Epic = require('../../../src/models/epic.model');

let mongoServer;

beforeAll(async () => {
  // Configurer MongoDB en mémoire pour les tests
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Nettoyer la base de données avant chaque test
  await Sprint.deleteMany({});
  await Epic.deleteMany({});
});

describe('Contrôleur Sprint', () => {
  describe('POST /api/sprints', () => {
    it('devrait créer un nouveau sprint', async () => {
      const sprintData = {
        name: 'Sprint Test',
        startDate: '2025-04-01',
        endDate: '2025-04-14',
        team: {
          developers: 5,
          daysOff: 2,
          meetingsPercentage: 10,
          bugsPercentage: 15
        }
      };

      const response = await request(app)
        .post('/api/sprints')
        .send(sprintData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toBe(sprintData.name);
      expect(response.body.plannedCapacity).toBeGreaterThan(0);
    });

    it('devrait retourner une erreur 400 si les données sont invalides', async () => {
      const invalidData = {
        // Manque le nom du sprint
        startDate: '2025-04-01',
        endDate: '2025-04-14'
      };

      const response = await request(app)
        .post('/api/sprints')
        .send(invalidData);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/sprints', () => {
    it('devrait retourner tous les sprints', async () => {
      // Créer quelques sprints de test
      await Sprint.create([
        {
          name: 'Sprint 1',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-14'),
          team: {
            developers: 5,
            daysOff: 2,
            meetingsPercentage: 10,
            bugsPercentage: 15
          },
          status: 'completed'
        },
        {
          name: 'Sprint 2',
          startDate: new Date('2025-01-15'),
          endDate: new Date('2025-01-28'),
          team: {
            developers: 5,
            daysOff: 0,
            meetingsPercentage: 10,
            bugsPercentage: 15
          },
          status: 'active'
        }
      ]);

      const response = await request(app).get('/api/sprints');

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(2);
    });

    it('devrait filtrer les sprints par statut', async () => {
      // Créer quelques sprints de test
      await Sprint.create([
        {
          name: 'Sprint 1',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-14'),
          team: {
            developers: 5,
            daysOff: 2,
            meetingsPercentage: 10,
            bugsPercentage: 15
          },
          status: 'completed'
        },
        {
          name: 'Sprint 2',
          startDate: new Date('2025-01-15'),
          endDate: new Date('2025-01-28'),
          team: {
            developers: 5,
            daysOff: 0,
            meetingsPercentage: 10,
            bugsPercentage: 15
          },
          status: 'active'
        }
      ]);

      const response = await request(app).get('/api/sprints?status=active');

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('Sprint 2');
    });
  });

  describe('GET /api/sprints/:id', () => {
    it('devrait retourner un sprint par son ID', async () => {
      // Créer un sprint de test
      const sprint = await Sprint.create({
        name: 'Sprint Test',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-14'),
        team: {
          developers: 5,
          daysOff: 2,
          meetingsPercentage: 10,
          bugsPercentage: 15
        }
      });

      const response = await request(app).get(`/api/sprints/${sprint._id}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('_id', sprint._id.toString());
      expect(response.body.name).toBe('Sprint Test');
    });

    it('devrait retourner une erreur 404 si le sprint n\'existe pas', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app).get(`/api/sprints/${fakeId}`);

      expect(response.statusCode).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/sprints/:id', () => {
    it('devrait mettre à jour un sprint existant', async () => {
      // Créer un sprint de test
      const sprint = await Sprint.create({
        name: 'Sprint Original',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-14'),
        team: {
          developers: 5,
          daysOff: 2,
          meetingsPercentage: 10,
          bugsPercentage: 15
        }
      });

      const updateData = {
        name: 'Sprint Mis à Jour',
        team: {
          developers: 6,
          daysOff: 3,
          meetingsPercentage: 10,
          bugsPercentage: 15
        }
      };

      const response = await request(app)
        .put(`/api/sprints/${sprint._id}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body.name).toBe('Sprint Mis à Jour');
      expect(response.body.team.developers).toBe(6);
      expect(response.body.team.daysOff).toBe(3);
    });
  });

  describe('DELETE /api/sprints/:id', () => {
    it('devrait supprimer un sprint existant', async () => {
      // Créer un sprint de test
      const sprint = await Sprint.create({
        name: 'Sprint à Supprimer',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-14'),
        team: {
          developers: 5,
          daysOff: 2,
          meetingsPercentage: 10,
          bugsPercentage: 15
        }
      });

      const response = await request(app).delete(`/api/sprints/${sprint._id}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Vérifier que le sprint a été supprimé
      const findSprint = await Sprint.findById(sprint._id);
      expect(findSprint).toBeNull();
    });
  });

  describe('POST /api/sprints/:id/close', () => {
    it('devrait clôturer un sprint et calculer la vélocité', async () => {
      // Créer des epics
      const epics = await Epic.create([
        {
          title: 'Epic 1',
          description: 'Description 1',
          storyPoints: 8,
          status: 'done'
        },
        {
          title: 'Epic 2',
          description: 'Description 2',
          storyPoints: 5,
          status: 'done'
        },
        {
          title: 'Epic 3',
          description: 'Description 3',
          storyPoints: 3,
          status: 'in-progress'
        }
      ]);

      // Créer un sprint avec ces epics
      const sprint = await Sprint.create({
        name: 'Sprint à Clôturer',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-14'),
        team: {
          developers: 5,
          daysOff: 2,
          meetingsPercentage: 10,
          bugsPercentage: 15
        },
        status: 'active',
        epics: [
          { epicId: epics[0]._id, storyPoints: 8, completed: true },
          { epicId: epics[1]._id, storyPoints: 5, completed: true },
          { epicId: epics[2]._id, storyPoints: 3, completed: false }
        ]
      });

      const closeData = {
        actualCapacity: 38, // jours/homme réels
        actualMeetingsPercentage: 12,
        actualBugsPercentage: 18
      };

      const response = await request(app)
        .post(`/api/sprints/${sprint._id}/close`)
        .send(closeData);

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe('completed');
      expect(response.body.velocity).toBeGreaterThan(0);
      expect(response.body.actualCapacity).toBe(38);
    });
  });
});
