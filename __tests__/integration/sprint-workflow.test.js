const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const Sprint = require('../../src/models/sprint.model');
const Epic = require('../../src/models/epic.model');

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

describe('Workflow complet de gestion des sprints', () => {
  it('devrait permettre de créer, planifier, suivre et clôturer un sprint', async () => {
    // 1. Créer des epics
    const epicResponse = await request(app)
      .post('/api/epics')
      .send([
        {
          title: 'Authentification',
          description: 'Système d\'authentification',
          storyPoints: 8,
          status: 'to-do',
          theme: 'Sécurité',
          tags: ['auth', 'user'],
          priority: 'high'
        },
        {
          title: 'Gestion des sprints',
          description: 'Interface de gestion des sprints',
          storyPoints: 13,
          status: 'to-do',
          theme: 'Core',
          tags: ['sprint', 'planning'],
          priority: 'high'
        },
        {
          title: 'Import Excel',
          description: 'Importation depuis Excel',
          storyPoints: 5,
          status: 'to-do',
          theme: 'Import/Export',
          tags: ['import', 'excel'],
          priority: 'medium'
        }
      ]);

    expect(epicResponse.statusCode).toBe(201);
    expect(epicResponse.body).toBeInstanceOf(Array);
    expect(epicResponse.body.length).toBe(3);
    
    const epics = epicResponse.body;

    // 2. Créer un sprint
    const sprintData = {
      name: 'Sprint 1',
      startDate: '2025-04-01',
      endDate: '2025-04-14',
      team: {
        developers: 5,
        daysOff: 2,
        meetingsPercentage: 10,
        bugsPercentage: 15
      }
    };

    const createSprintResponse = await request(app)
      .post('/api/sprints')
      .send(sprintData);

    expect(createSprintResponse.statusCode).toBe(201);
    const sprint = createSprintResponse.body;

    // 3. Planifier le sprint (ajouter des epics)
    const planData = {
      epics: [
        { epicId: epics[0]._id, storyPoints: 8 },
        { epicId: epics[1]._id, storyPoints: 13 }
      ]
    };

    const planResponse = await request(app)
      .post(`/api/sprints/${sprint._id}/plan`)
      .send(planData);

    expect(planResponse.statusCode).toBe(200);
    expect(planResponse.body.epics).toHaveLength(2);
    expect(planResponse.body.status).toBe('planned');

    // 4. Démarrer le sprint
    const startResponse = await request(app)
      .post(`/api/sprints/${sprint._id}/start`);

    expect(startResponse.statusCode).toBe(200);
    expect(startResponse.body.status).toBe('active');

    // 5. Mettre à jour le suivi du sprint
    const updateData = {
      team: {
        developers: 5,
        daysOff: 3, // Un jour de congé supplémentaire
        meetingsPercentage: 12, // Plus de réunions que prévu
        bugsPercentage: 18 // Plus de bugs que prévu
      }
    };

    const updateResponse = await request(app)
      .put(`/api/sprints/${sprint._id}`)
      .send(updateData);

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.team.daysOff).toBe(3);
    expect(updateResponse.body.team.meetingsPercentage).toBe(12);

    // 6. Clôturer le sprint
    const closeData = {
      actualCapacity: 36, // jours/homme réels
      epics: [
        { epicId: epics[0]._id, completed: true },
        { epicId: epics[1]._id, completed: false } // Epic non terminé
      ]
    };

    const closeResponse = await request(app)
      .post(`/api/sprints/${sprint._id}/close`)
      .send(closeData);

    expect(closeResponse.statusCode).toBe(200);
    expect(closeResponse.body.status).toBe('completed');
    expect(closeResponse.body.velocity).toBeGreaterThan(0);
    
    // Vérifier que l'epic terminé a été mis à jour
    const epic1Response = await request(app).get(`/api/epics/${epics[0]._id}`);
    expect(epic1Response.body.status).toBe('done');
    
    // Vérifier que l'epic non terminé est toujours en cours
    const epic2Response = await request(app).get(`/api/epics/${epics[1]._id}`);
    expect(epic2Response.body.status).toBe('to-do');

    // 7. Obtenir les statistiques de vélocité
    const statsResponse = await request(app).get('/api/stats/velocity');
    
    expect(statsResponse.statusCode).toBe(200);
    expect(statsResponse.body).toBeInstanceOf(Array);
    expect(statsResponse.body.length).toBe(1); // Un seul sprint terminé
    expect(statsResponse.body[0]).toHaveProperty('sprintName', 'Sprint 1');
    expect(statsResponse.body[0]).toHaveProperty('velocity');
  });
});
