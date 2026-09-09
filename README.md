# POTool - Application de Suivi de Sprints

Une application web permettant le suivi des sprints de développement, la gestion de la vélocité de l'équipe, et la visualisation de statistiques et d'une roadmap basée sur les données des sprints.

## Prérequis

- **Node.js** v18+ (recommandé v22)
- **MongoDB** v7.0+
- **npm** v9+

## Installation Rapide

### 1. Cloner le projet

```bash
git clone <repository-url>
cd POTool
```

### 2. Installer MongoDB (macOS)

```bash
# Ajouter le tap MongoDB
brew tap mongodb/brew

# Installer MongoDB Community Edition
brew install mongodb-community@7.0

# Démarrer le service MongoDB
brew services start mongodb/brew/mongodb-community@7.0

# Vérifier que MongoDB fonctionne
mongosh --eval "db.runCommand({ ping: 1 })"
```

### 3. Configurer les variables d'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env
```

Modifier `.env` selon vos besoins. Configuration minimale :

```env
NODE_ENV=development
PORT=3002
MONGODB_URI=mongodb://localhost:27017/potool
JWT_SECRET=votre_cle_secrete_jwt
JWT_EXPIRES_IN=1d
DEFAULT_LANGUAGE=fr
CLIENT_URL=http://localhost:3001
```

### 4. Installer les dépendances

```bash
# Backend
npm install

# Frontend
cd client
npm install
cd ..
```

### 5. Intégration du Design System (optionnel)

Si vous utilisez le design system local `@frhamon/design-system` :

```bash
cd client
npm install /chemin/vers/design-system
cd ..
```

Le design system est configuré via CRACO pour éviter les conflits de versions React.

### 6. Démarrer l'application

```bash
# Terminal 1 - Backend (port 3002)
npm run dev

# Terminal 2 - Frontend (port 3001)
cd client
npm start
```

L'application sera accessible sur **http://localhost:3001**

## Structure du Projet

```
POTool/
├── src/                    # Backend Node.js/Express
│   ├── controllers/        # Contrôleurs API
│   ├── models/             # Modèles Mongoose
│   ├── routes/             # Routes API
│   ├── services/           # Services métier
│   ├── middleware/         # Middleware Express (auth, validation)
│   ├── utils/              # Utilitaires
│   ├── locales/            # Fichiers i18n (fr, en, ar)
│   ├── app.js              # Configuration Express
│   └── server.js           # Point d'entrée serveur
│
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Composants réutilisables
│   │   ├── pages/          # Pages de l'application
│   │   ├── context/        # Contexts React (Auth)
│   │   ├── services/       # Services API
│   │   ├── styles/         # Fichiers CSS
│   │   └── i18n.js         # Configuration i18next
│   ├── craco.config.js     # Configuration webpack (CRACO)
│   └── package.json
│
├── __tests__/              # Tests Jest
│   ├── unit/               # Tests unitaires
│   ├── integration/        # Tests d'intégration
│   └── e2e/                # Tests end-to-end
│
├── docs/                   # Documentation fonctionnelle
├── .env.example            # Template variables d'environnement
└── package.json
```

## Scripts Disponibles

### Backend

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarre le serveur avec nodemon (hot reload) |
| `npm start` | Démarre le serveur en production |
| `npm test` | Exécute les tests |
| `npm run test:watch` | Tests en mode watch |
| `npm run test:coverage` | Rapport de couverture |

### Frontend

| Commande | Description |
|----------|-------------|
| `npm start` | Démarre le serveur de développement (port 3001) |
| `npm run build` | Build de production |
| `npm test` | Exécute les tests React |

## Configuration Technique

### Ports

| Service | Port |
|---------|------|
| Frontend React | 3001 |
| Backend Express | 3002 |
| MongoDB | 27017 |

### Design System

Le projet utilise `@frhamon/design-system` pour les composants UI. La configuration CRACO (`client/craco.config.js`) résout les conflits de versions React :

```javascript
// Alias pour utiliser une seule instance de React
webpackConfig.resolve.alias = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
};
```

### Internationalisation

L'application supporte 3 langues :
- Français (fr) - par défaut
- Anglais (en)
- Arabe (ar) - avec support RTL

## Fonctionnalités

### Implémentées

- **Authentification** : JWT avec refresh token
- **Gestion des utilisateurs** : Inscription, connexion, profil
- **Gestion des membres d'équipe** : CRUD complet avec TJM
- **Internationalisation** : FR/EN/AR
- **Sécurité** : Helmet, XSS protection, rate limiting, CORS

### À venir (Roadmap)

- Gestion des sprints et calcul de capacité
- Import d'epics depuis Jira/Excel
- Suivi de vélocité et statistiques
- Calendrier et jours fériés

## API RESTful

### Authentification

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| GET | `/api/auth/me` | Utilisateur courant |
| PUT | `/api/auth/profile` | Mise à jour profil |

### Membres d'équipe

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/team-members` | Liste des membres |
| POST | `/api/team-members` | Créer un membre |
| PUT | `/api/team-members/:id` | Modifier un membre |
| DELETE | `/api/team-members/:id` | Supprimer un membre |

### Health Check

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/health` | État du service |

## Approche TDD

Ce projet suit une approche de développement piloté par les tests (TDD) :

1. **Écrire d'abord les tests** : Nous définissons le comportement attendu avant d'implémenter les fonctionnalités
2. **Voir les tests échouer** : Nous vérifions que les tests échouent correctement
3. **Implémenter le code** : Nous développons le code minimal pour faire passer les tests
4. **Refactoriser** : Nous améliorons le code tout en maintenant les tests au vert

## Dépannage

### MongoDB ne démarre pas

```bash
# Vérifier le statut
brew services list

# Redémarrer le service
brew services restart mongodb/brew/mongodb-community@7.0

# Vérifier les logs (macOS)
tail -f /opt/homebrew/var/log/mongodb/mongo.log
```

### Erreur "Invalid hook call" (React)

Cette erreur survient quand plusieurs instances de React coexistent. Vérifier que CRACO est bien configuré :

```bash
cd client
npm install @craco/craco --save-dev
```

Et que les scripts dans `package.json` utilisent `craco` au lieu de `react-scripts`.

### Port déjà utilisé

```bash
# Trouver et terminer le processus sur le port 3002
lsof -ti:3002 | xargs kill -9

# Idem pour le port 3001
lsof -ti:3001 | xargs kill -9
```

### Erreur "buffering timed out" MongoDB

Vérifiez que MongoDB est bien démarré :

```bash
brew services start mongodb/brew/mongodb-community@7.0
mongosh --eval "db.runCommand({ ping: 1 })"
```

## Contribution

1. Créer une branche feature : `git checkout -b feature/ma-fonctionnalite`
2. Commiter les changements : `git commit -m "feat: description"`
3. Pousser la branche : `git push origin feature/ma-fonctionnalite`
4. Ouvrir une Pull Request

### Conventions de commit

- `feat:` Nouvelle fonctionnalité
- `fix:` Correction de bug
- `docs:` Documentation
- `refactor:` Refactoring
- `test:` Ajout/modification de tests

## Licence

Projet privé - Tous droits réservés
