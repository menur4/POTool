const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
let mongoServer;

// Modèle à tester (nous le créerons après)
const Epic = require('../../../src/models/epic.model');

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

describe('Modèle Epic', () => {
  it('devrait créer et sauvegarder un epic avec succès', async () => {
    const epicData = {
      title: 'Fonctionnalité de gestion des sprints',
      description: 'Permettre la création et la gestion des sprints',
      storyPoints: 13,
      status: 'to-do',
      theme: 'Core',
      tags: ['sprint', 'planning'],
      externalId: 'JIRA-123',
      priority: 'high'
    };

    const epic = new Epic(epicData);
    const savedEpic = await epic.save();
    
    // Vérifier que l'epic a été sauvegardé avec un ID
    expect(savedEpic._id).toBeDefined();
    expect(savedEpic.title).toBe(epicData.title);
    expect(savedEpic.storyPoints).toBe(epicData.storyPoints);
    expect(savedEpic.tags).toEqual(expect.arrayContaining(['sprint', 'planning']));
  });

  it('devrait échouer lors de la création d\'un epic sans titre', async () => {
    const epicData = {
      description: 'Description sans titre',
      storyPoints: 8,
      status: 'to-do'
    };

    try {
      const epic = new Epic(epicData);
      await epic.save();
      // Si on arrive ici, le test échoue
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.errors.title).toBeDefined();
    }
  });

  it('devrait échouer si les story points ne sont pas un nombre positif', async () => {
    const epicData = {
      title: 'Epic avec story points négatifs',
      description: 'Test de validation',
      storyPoints: -5,
      status: 'to-do'
    };

    try {
      const epic = new Epic(epicData);
      await epic.save();
      // Si on arrive ici, le test échoue
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.errors.storyPoints).toBeDefined();
    }
  });

  it('devrait mettre à jour le statut d\'un epic', async () => {
    // Créer un epic
    const epicData = {
      title: 'Epic à mettre à jour',
      description: 'Test de mise à jour',
      storyPoints: 8,
      status: 'to-do'
    };

    const epic = new Epic(epicData);
    await epic.save();
    
    // Mettre à jour le statut
    epic.status = 'in-progress';
    await epic.save();
    
    // Récupérer l'epic mis à jour
    const updatedEpic = await Epic.findById(epic._id);
    expect(updatedEpic.status).toBe('in-progress');
  });

  it('devrait permettre d\'ajouter des tags à un epic existant', async () => {
    // Créer un epic
    const epicData = {
      title: 'Epic avec tags',
      description: 'Test d\'ajout de tags',
      storyPoints: 5,
      status: 'to-do',
      tags: ['initial']
    };

    const epic = new Epic(epicData);
    await epic.save();
    
    // Ajouter des tags
    epic.tags.push('nouveau');
    await epic.save();
    
    // Récupérer l'epic mis à jour
    const updatedEpic = await Epic.findById(epic._id);
    expect(updatedEpic.tags).toEqual(expect.arrayContaining(['initial', 'nouveau']));
    expect(updatedEpic.tags.length).toBe(2);
  });
});
