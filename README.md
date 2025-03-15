# POTool - Application de Suivi de Sprints

Une application web permettant le suivi des sprints de développement, la gestion de la vélocité de l'équipe, et la visualisation de statistiques et d'une roadmap basée sur les données des sprints.

## Structure du Projet

```
├── src/
│   ├── controllers/    # Contrôleurs pour les routes API
│   ├── models/         # Modèles de données Mongoose
│   ├── routes/         # Définitions des routes API
│   ├── services/       # Services métier
│   ├── middleware/     # Middleware Express
│   ├── utils/          # Utilitaires
│   ├── locales/        # Fichiers de traduction
│   ├── app.js          # Configuration Express
│   └── server.js       # Point d'entrée de l'application
│
├── __tests__/
│   ├── unit/           # Tests unitaires
│   ├── integration/    # Tests d'intégration
│   └── e2e/            # Tests end-to-end
│
├── .env                # Variables d'environnement
├── .env.test           # Variables d'environnement pour les tests
├── package.json        # Dépendances et scripts
└── jest.config.js      # Configuration Jest
```

## Approche TDD

Ce projet suit une approche de développement piloté par les tests (TDD) :

1. **Écrire d'abord les tests** : Nous définissons le comportement attendu avant d'implémenter les fonctionnalités
2. **Voir les tests échouer** : Nous vérifions que les tests échouent correctement
3. **Implémenter le code** : Nous développons le code minimal pour faire passer les tests
4. **Refactoriser** : Nous améliorons le code tout en maintenant les tests au vert

## Installation

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
```

## Exécution des Tests

```bash
# Exécuter tous les tests
npm test

# Exécuter les tests en mode watch
npm run test:watch

# Générer un rapport de couverture
npm run test:coverage
```

## Développement

```bash
# Démarrer le serveur en mode développement
npm run dev

# Démarrer le serveur en mode production
npm start
```

## Fonctionnalités Principales

- Authentification et gestion des utilisateurs
- Internationalisation (français, anglais, arabe)
- Gestion des sprints et des epics
- Importation de données depuis Excel
- Statistiques de vélocité et roadmap
- Gestion du calendrier et des jours fériés

## Modèles de Données

### Sprint
- Nom, dates de début/fin
- Configuration de l'équipe
- Capacité planifiée et réelle
- Epics associés
- Vélocité calculée

### Epic
- Titre, description
- Story points
- Statut, thème, tags
- Priorité

## API RESTful

L'application expose une API RESTful complète pour toutes les fonctionnalités.

## Contribution

1. Assurez-vous que tous les tests passent avant de soumettre une pull request
2. Ajoutez des tests pour toute nouvelle fonctionnalité
3. Respectez les conventions de code établies
