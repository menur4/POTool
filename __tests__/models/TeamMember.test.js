const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const TeamMember = require('../../server/src/models/TeamMember');

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
});

describe('TeamMember Model', () => {
  it('devrait créer et sauvegarder un membre de l\'équipe avec succès', async () => {
    const validTeamMember = {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      role: 'developer',
      profile: 'watcher',
      city: 'Paris',
      country: 'France',
      photo: 'http://example.com/photo.jpg',
      dailyRate: 500
    };

    const savedTeamMember = await TeamMember.create(validTeamMember);
    
    // Vérifier que l'ID est défini = sauvegarde réussie
    expect(savedTeamMember._id).toBeDefined();
    expect(savedTeamMember.firstName).toBe(validTeamMember.firstName);
    expect(savedTeamMember.lastName).toBe(validTeamMember.lastName);
    expect(savedTeamMember.email).toBe(validTeamMember.email);
    expect(savedTeamMember.role).toBe(validTeamMember.role);
    expect(savedTeamMember.profile).toBe(validTeamMember.profile);
    expect(savedTeamMember.city).toBe(validTeamMember.city);
    expect(savedTeamMember.country).toBe(validTeamMember.country);
    expect(savedTeamMember.photo).toBe(validTeamMember.photo);
    expect(savedTeamMember.dailyRate).toBe(validTeamMember.dailyRate);
    expect(savedTeamMember.active).toBe(true); // Valeur par défaut
    expect(savedTeamMember.createdAt).toBeDefined();
    expect(savedTeamMember.updatedAt).toBeDefined();
  });

  it('devrait définir le profil par défaut à "watcher" si non spécifié', async () => {
    const teamMemberWithoutProfile = {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      role: 'developer',
      dailyRate: 500
    };

    const savedTeamMember = await TeamMember.create(teamMemberWithoutProfile);
    
    expect(savedTeamMember.profile).toBe('watcher'); // Vérifier que le profil par défaut est 'watcher'
  });

  it('devrait accepter les différents types de profils valides', async () => {
    // Tester le profil 'power-user'
    const powerUserMember = {
      firstName: 'Marie',
      lastName: 'Martin',
      email: 'marie.martin@example.com',
      role: 'developer',
      profile: 'power-user',
      dailyRate: 500
    };
    const savedPowerUser = await TeamMember.create(powerUserMember);
    expect(savedPowerUser.profile).toBe('power-user');
    
    // Tester le profil 'admin'
    const adminMember = {
      firstName: 'Pierre',
      lastName: 'Dubois',
      email: 'pierre.dubois@example.com',
      role: 'developer',
      profile: 'admin',
      dailyRate: 500
    };
    const savedAdmin = await TeamMember.create(adminMember);
    expect(savedAdmin.profile).toBe('admin');
  });

  it('devrait échouer lors de la création d\'un membre sans prénom', async () => {
    const teamMemberWithoutFirstName = {
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      role: 'developer',
      dailyRate: 500
    };

    let error;
    try {
      await TeamMember.create(teamMemberWithoutFirstName);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.errors.firstName).toBeDefined();
  });

  it('devrait échouer lors de la création d\'un membre sans nom', async () => {
    const teamMemberWithoutLastName = {
      firstName: 'Jean',
      email: 'jean.dupont@example.com',
      role: 'developer',
      dailyRate: 500
    };

    let error;
    try {
      await TeamMember.create(teamMemberWithoutLastName);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.errors.lastName).toBeDefined();
  });

  it('devrait échouer lors de la création d\'un membre avec un email invalide', async () => {
    const teamMemberWithInvalidEmail = {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'invalid-email',
      role: 'developer',
      dailyRate: 500
    };

    let error;
    try {
      await TeamMember.create(teamMemberWithInvalidEmail);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.errors.email).toBeDefined();
  });

  it('devrait échouer lors de la création d\'un membre avec un rôle invalide', async () => {
    const teamMemberWithInvalidRole = {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      role: 'invalid_role',
      dailyRate: 500
    };

    let error;
    try {
      await TeamMember.create(teamMemberWithInvalidRole);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.errors.role).toBeDefined();
  });

  it('devrait échouer lors de la création d\'un membre avec un TJM négatif', async () => {
    const teamMemberWithNegativeDailyRate = {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      role: 'developer',
      dailyRate: -100
    };

    let error;
    try {
      await TeamMember.create(teamMemberWithNegativeDailyRate);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.errors.dailyRate).toBeDefined();
  });

  it('devrait mettre à jour la date de modification lors de la sauvegarde', async () => {
    // Créer un membre
    const teamMember = await TeamMember.create({
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      role: 'developer',
      dailyRate: 500
    });

    // Stocker la date de modification initiale
    const initialUpdatedAt = teamMember.updatedAt;

    // Attendre un peu pour s'assurer que la date sera différente
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mettre à jour le membre
    teamMember.firstName = 'Pierre';
    await teamMember.save();

    // Vérifier que la date de modification a été mise à jour
    expect(teamMember.updatedAt).not.toEqual(initialUpdatedAt);
  });

  it('devrait créer un membre avec un email unique', async () => {
    // Créer un premier membre
    await TeamMember.create({
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      role: 'developer',
      dailyRate: 500
    });

    // Tenter de créer un second membre avec le même email
    const duplicateTeamMember = {
      firstName: 'Pierre',
      lastName: 'Martin',
      email: 'jean.dupont@example.com', // Email déjà utilisé
      role: 'designer',
      dailyRate: 600
    };

    let error;
    try {
      await TeamMember.create(duplicateTeamMember);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.code).toBe(11000); // Code d'erreur MongoDB pour violation d'unicité
  });
});
