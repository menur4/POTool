const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Service à tester (nous le créerons après)
const ExcelImportService = require('../../../src/services/excelImport.service');
const Epic = require('../../../src/models/epic.model');

let mongoServer;

beforeAll(async () => {
  // Configurer MongoDB en mémoire pour les tests
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  
  // Créer un fichier Excel de test
  createTestExcelFile();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  
  // Supprimer le fichier Excel de test
  const testFilePath = path.join(__dirname, 'test-data', 'epics.xlsx');
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }
});

// Fonction pour créer un fichier Excel de test
function createTestExcelFile() {
  const testDir = path.join(__dirname, 'test-data');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const testData = [
    {
      'ID': 'JIRA-001',
      'Titre': 'Authentification des utilisateurs',
      'Description': 'Implémenter le système d\'authentification',
      'Story Points': 8,
      'Statut': 'To Do',
      'Thème': 'Sécurité',
      'Étiquettes': 'auth,user',
      'Priorité': 'High'
    },
    {
      'ID': 'JIRA-002',
      'Titre': 'Gestion des sprints',
      'Description': 'Permettre la création et la gestion des sprints',
      'Story Points': 13,
      'Statut': 'To Do',
      'Thème': 'Core',
      'Étiquettes': 'sprint,planning',
      'Priorité': 'High'
    },
    {
      'ID': 'JIRA-003',
      'Titre': 'Importation des epics depuis Excel',
      'Description': 'Permettre l\'import des epics depuis un fichier Excel',
      'Story Points': 5,
      'Statut': 'To Do',
      'Thème': 'Import/Export',
      'Étiquettes': 'import,excel',
      'Priorité': 'Medium'
    }
  ];
  
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(testData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Epics');
  
  const testFilePath = path.join(testDir, 'epics.xlsx');
  XLSX.writeFile(workbook, testFilePath);
}

describe('Service d\'importation Excel', () => {
  it('devrait importer des epics depuis un fichier Excel', async () => {
    const testFilePath = path.join(__dirname, 'test-data', 'epics.xlsx');
    
    // Vérifier qu'il n'y a pas d'epics dans la base de données
    const initialCount = await Epic.countDocuments();
    expect(initialCount).toBe(0);
    
    // Importer les epics
    const importResult = await ExcelImportService.importEpicsFromExcel(testFilePath);
    
    // Vérifier que les epics ont été importés
    expect(importResult.success).toBe(true);
    expect(importResult.imported).toBe(3);
    
    // Vérifier que les epics sont dans la base de données
    const epics = await Epic.find();
    expect(epics.length).toBe(3);
    
    // Vérifier les données d'un epic
    const epic = epics.find(e => e.externalId === 'JIRA-001');
    expect(epic).toBeDefined();
    expect(epic.title).toBe('Authentification des utilisateurs');
    expect(epic.storyPoints).toBe(8);
    expect(epic.theme).toBe('Sécurité');
    expect(epic.tags).toEqual(expect.arrayContaining(['auth', 'user']));
  });

  it('devrait gérer les erreurs de format de fichier', async () => {
    // Créer un fichier texte au lieu d'un Excel
    const testDir = path.join(__dirname, 'test-data');
    const invalidFilePath = path.join(testDir, 'invalid.txt');
    fs.writeFileSync(invalidFilePath, 'Ceci n\'est pas un fichier Excel');
    
    try {
      await ExcelImportService.importEpicsFromExcel(invalidFilePath);
      // Si on arrive ici, le test échoue
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.message).toContain('format');
    } finally {
      // Nettoyer
      if (fs.existsSync(invalidFilePath)) {
        fs.unlinkSync(invalidFilePath);
      }
    }
  });

  it('devrait gérer les erreurs de validation des données', async () => {
    const testDir = path.join(__dirname, 'test-data');
    const invalidDataFilePath = path.join(testDir, 'invalid-data.xlsx');
    
    // Créer un fichier Excel avec des données invalides
    const invalidData = [
      {
        'ID': 'JIRA-004',
        'Titre': '', // Titre vide, devrait échouer
        'Description': 'Description sans titre',
        'Story Points': -5, // Story points négatifs, devrait échouer
        'Statut': 'To Do',
        'Thème': 'Test',
        'Étiquettes': 'test',
        'Priorité': 'Low'
      }
    ];
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(invalidData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Epics');
    XLSX.writeFile(workbook, invalidDataFilePath);
    
    try {
      const importResult = await ExcelImportService.importEpicsFromExcel(invalidDataFilePath);
      expect(importResult.success).toBe(false);
      expect(importResult.errors).toBeDefined();
      expect(importResult.errors.length).toBeGreaterThan(0);
    } finally {
      // Nettoyer
      if (fs.existsSync(invalidDataFilePath)) {
        fs.unlinkSync(invalidDataFilePath);
      }
    }
  });
});
