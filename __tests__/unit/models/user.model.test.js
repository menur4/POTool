const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');
let mongoServer;

// Modèle à tester (nous le créerons après)
const User = require('../../../src/models/user.model');

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

describe('Modèle User', () => {
  it('devrait créer et sauvegarder un utilisateur avec succès', async () => {
    const userData = {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      password: 'MotDePasse123!',
      role: 'member',
      language: 'fr'
    };

    const user = new User(userData);
    const savedUser = await user.save();
    
    // Vérifier que l'utilisateur a été sauvegardé avec un ID
    expect(savedUser._id).toBeDefined();
    expect(savedUser.firstName).toBe(userData.firstName);
    expect(savedUser.lastName).toBe(userData.lastName);
    expect(savedUser.email).toBe(userData.email);
    expect(savedUser.role).toBe('member');
    expect(savedUser.language).toBe('fr');
    
    // Vérifier que le mot de passe a été hashé
    expect(savedUser.password).not.toBe(userData.password);
    const isPasswordValid = await bcrypt.compare(userData.password, savedUser.password);
    expect(isPasswordValid).toBe(true);
  });

  it('devrait échouer lors de la création d\'un utilisateur sans email', async () => {
    const userData = {
      firstName: 'Pierre',
      lastName: 'Martin',
      password: 'MotDePasse123!',
      role: 'member'
    };

    try {
      const user = new User(userData);
      await user.save();
      // Si on arrive ici, le test échoue
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
    }
  });

  it('devrait échouer lors de la création d\'un utilisateur avec un email invalide', async () => {
    const userData = {
      firstName: 'Sophie',
      lastName: 'Dubois',
      email: 'email-invalide',
      password: 'MotDePasse123!',
      role: 'member'
    };

    try {
      const user = new User(userData);
      await user.save();
      // Si on arrive ici, le test échoue
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
    }
  });

  it('devrait échouer lors de la création d\'un utilisateur avec un mot de passe trop court', async () => {
    const userData = {
      firstName: 'Marie',
      lastName: 'Leroy',
      email: 'marie.leroy@example.com',
      password: 'Court1!',  // Moins de 8 caractères
      role: 'member'
    };

    try {
      const user = new User(userData);
      await user.save();
      // Si on arrive ici, le test échoue
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.errors.password).toBeDefined();
    }
  });

  it('devrait échouer lors de la création d\'un utilisateur avec un rôle invalide', async () => {
    const userData = {
      firstName: 'Paul',
      lastName: 'Bernard',
      email: 'paul.bernard@example.com',
      password: 'MotDePasse123!',
      role: 'role_invalide'  // Rôle non autorisé
    };

    try {
      const user = new User(userData);
      await user.save();
      // Si on arrive ici, le test échoue
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.errors.role).toBeDefined();
    }
  });

  it('devrait mettre à jour les informations d\'un utilisateur', async () => {
    // Créer un utilisateur
    const userData = {
      firstName: 'Thomas',
      lastName: 'Petit',
      email: 'thomas.petit@example.com',
      password: 'MotDePasse123!',
      role: 'member',
      language: 'fr'
    };

    const user = new User(userData);
    await user.save();
    
    // Mettre à jour les informations
    user.firstName = 'Tom';
    user.language = 'en';
    await user.save();
    
    // Récupérer l'utilisateur mis à jour
    const updatedUser = await User.findById(user._id);
    expect(updatedUser.firstName).toBe('Tom');
    expect(updatedUser.language).toBe('en');
  });

  it('devrait vérifier correctement le mot de passe', async () => {
    // Créer un utilisateur
    const userData = {
      firstName: 'Lucie',
      lastName: 'Moreau',
      email: 'lucie.moreau@example.com',
      password: 'MotDePasse123!',
      role: 'member'
    };

    const user = new User(userData);
    await user.save();
    
    // Vérifier le mot de passe avec la méthode du modèle
    const isPasswordValid = await user.comparePassword('MotDePasse123!');
    expect(isPasswordValid).toBe(true);
    
    // Vérifier avec un mauvais mot de passe
    const isInvalidPasswordValid = await user.comparePassword('MauvaisMotDePasse');
    expect(isInvalidPasswordValid).toBe(false);
  });

  it('devrait générer un token de réinitialisation de mot de passe', async () => {
    // Créer un utilisateur
    const userData = {
      firstName: 'Emma',
      lastName: 'Roux',
      email: 'emma.roux@example.com',
      password: 'MotDePasse123!',
      role: 'member'
    };

    const user = new User(userData);
    await user.save();
    
    // Générer un token de réinitialisation
    user.generatePasswordReset();
    await user.save();
    
    // Vérifier que le token a été généré
    expect(user.resetPasswordToken).toBeDefined();
    expect(user.resetPasswordExpires).toBeDefined();
    expect(user.resetPasswordExpires).toBeInstanceOf(Date);
    
    // Vérifier que la date d'expiration est dans le futur
    const now = new Date();
    expect(user.resetPasswordExpires > now).toBe(true);
  });
});
