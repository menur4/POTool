const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
let mongoServer;

// Modèle à tester (nous le créerons après)
const Sprint = require('../../../src/models/sprint.model');

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

describe('Modèle Sprint', () => {
  it('devrait créer et sauvegarder un sprint avec succès', async () => {
    const sprintData = {
      name: 'Sprint 1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-14'),
      team: {
        developers: 5,
        daysOff: 2,
        meetingsPercentage: 10,
        bugsPercentage: 15
      },
      plannedCapacity: 40, // jours/homme
      actualCapacity: null, // sera rempli à la fin du sprint
      epics: [], // sera rempli lors de la planification
      velocity: null, // sera calculé à la fin du sprint
      status: 'planned' // planned, active, completed
    };

    const sprint = new Sprint(sprintData);
    const savedSprint = await sprint.save();
    
    // Vérifier que le sprint a été sauvegardé avec un ID
    expect(savedSprint._id).toBeDefined();
    expect(savedSprint.name).toBe(sprintData.name);
    expect(savedSprint.team.developers).toBe(sprintData.team.developers);
    expect(savedSprint.status).toBe('planned');
  });

  it('devrait échouer lors de la création d\'un sprint sans nom', async () => {
    const sprintData = {
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-14'),
      team: {
        developers: 5,
        daysOff: 2,
        meetingsPercentage: 10,
        bugsPercentage: 15
      }
    };

    try {
      const sprint = new Sprint(sprintData);
      await sprint.save();
      // Si on arrive ici, le test échoue
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
    }
  });

  it('devrait calculer automatiquement la capacité planifiée', async () => {
    const sprintData = {
      name: 'Sprint 2',
      startDate: new Date('2025-02-01'),
      endDate: new Date('2025-02-14'),
      team: {
        developers: 4,
        daysOff: 1,
        meetingsPercentage: 10,
        bugsPercentage: 15
      }
    };

    const sprint = new Sprint(sprintData);
    await sprint.save();
    
    // La capacité devrait être calculée automatiquement
    // (14 jours - weekend) * 4 devs - 1 jour off = environ 40 jours/homme
    // Moins les pourcentages de réunions et bugs
    expect(sprint.plannedCapacity).toBeGreaterThan(0);
  });

  it('devrait calculer la vélocité à la clôture du sprint', async () => {
    const sprintData = {
      name: 'Sprint 3',
      startDate: new Date('2025-03-01'),
      endDate: new Date('2025-03-14'),
      team: {
        developers: 5,
        daysOff: 2,
        meetingsPercentage: 10,
        bugsPercentage: 15
      },
      epics: [
        { epicId: new mongoose.Types.ObjectId(), storyPoints: 8, completed: true },
        { epicId: new mongoose.Types.ObjectId(), storyPoints: 5, completed: true },
        { epicId: new mongoose.Types.ObjectId(), storyPoints: 3, completed: false }
      ],
      actualCapacity: 38 // jours/homme réels
    };

    const sprint = new Sprint(sprintData);
    sprint.status = 'completed';
    await sprint.save();
    
    // La vélocité devrait être calculée : somme des story points complétés / capacité réelle
    expect(sprint.velocity).toBeGreaterThan(0);
  });
});
