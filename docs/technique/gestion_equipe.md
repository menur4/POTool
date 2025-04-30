# Documentation Technique - Gestion d'Équipe

## Architecture de la Fonctionnalité

La gestion d'équipe dans POTool est implémentée selon une architecture MVC (Modèle-Vue-Contrôleur) avec une séparation claire entre le backend (API) et le frontend (interface utilisateur).

## Modèle de Données

### TeamMember

Le modèle `TeamMember` représente un membre de l'équipe de développement avec les champs suivants :

```javascript
const TeamMemberSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true,
    maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
  },
  lastName: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Veuillez fournir un email valide'
    ]
  },
  role: {
    type: String,
    enum: [
      'chef_de_projet',      // Chef de Projet
      'delivery_manager',    // Delivery Manager
      'tech_lead',           // Tech Lead
      'developpeur',         // Développeur
      'business_analyst',    // Business Analyst
      'qa_lead',             // QA Lead
      'qa',                  // QA
      'support',             // Support
      'support_lead',        // Support Lead
      'designer',            // Designer
      'other'                // Autre
    ],
    default: 'developpeur'
  },
  profile: {
    type: String,
    enum: ['watcher', 'power-user', 'admin'],
    default: 'watcher',
    required: [true, 'Le profil est requis']
  },
  dailyRate: {
    type: Number,
    required: [true, 'Le TJM est requis'],
    min: [0, 'Le TJM ne peut pas être négatif']
  },
  active: {
    type: Boolean,
    default: true
  },
  city: {
    type: String,
    trim: true,
    maxlength: [100, 'La ville ne peut pas dépasser 100 caractères']
  },
  country: {
    type: String,
    trim: true,
    maxlength: [100, 'Le pays ne peut pas dépasser 100 caractères']
  },
  photo: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});
```

## API Backend

### Routes

#### Routes des Membres d'Équipe

```javascript
// GET /api/team-members
// Récupérer tous les membres de l'équipe
exports.getTeamMembers = async (req, res) => { ... }

// GET /api/team-members/:id
// Récupérer un membre de l'équipe par son ID
exports.getTeamMember = async (req, res) => { ... }

// POST /api/team-members
// Créer un nouveau membre de l'équipe
exports.createTeamMember = async (req, res) => { ... }

// PUT /api/team-members/:id
// Mettre à jour un membre de l'équipe
exports.updateTeamMember = async (req, res) => { ... }

// DELETE /api/team-members/:id
// Supprimer un membre de l'équipe
exports.deleteTeamMember = async (req, res) => { ... }

// PATCH /api/team-members/:id/toggle-status
// Activer/désactiver un membre de l'équipe
exports.toggleTeamMemberStatus = async (req, res) => { ... }
```

#### Routes d'Upload de Photos

```javascript
// POST /api/upload/photo
// Uploader une photo pour un membre de l'équipe
router.post('/photo', protect, upload.single('photo'), (req, res) => { ... }

// DELETE /api/upload/photo/:filename
// Supprimer une photo
router.delete('/photo/:filename', protect, restrictTo('admin'), (req, res) => { ... }
```

### Middleware d'Upload

Le middleware d'upload utilise Multer pour gérer les fichiers uploadés :

```javascript
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    
    // Créer le répertoire s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Générer un nom de fichier unique avec timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'photo-' + uniqueSuffix + ext);
  }
});

// Filtrer les types de fichiers autorisés
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Seules les images (jpeg, jpg, png, gif, webp) sont autorisées'));
  }
};

// Configurer multer
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite à 5MB
  fileFilter: fileFilter
});

module.exports = upload;
```

## Frontend

### Composant TeamMembers

Le composant principal pour la gestion des membres d'équipe est `TeamMembers.js`. Il gère :

- L'affichage du tableau des membres
- Le formulaire d'ajout/modification
- L'upload de photos
- Le tri et le filtrage des données

### Services

Le service `teamMemberService.js` gère les appels API pour les opérations CRUD sur les membres d'équipe :

```javascript
// Obtenir tous les membres de l'équipe
export const getTeamMembers = async () => { ... }

// Obtenir un membre de l'équipe par son ID
export const getTeamMember = async (id) => { ... }

// Créer un nouveau membre de l'équipe
export const createTeamMember = async (teamMemberData) => { ... }

// Mettre à jour un membre de l'équipe
export const updateTeamMember = async (id, teamMemberData) => { ... }

// Supprimer un membre de l'équipe
export const deleteTeamMember = async (id) => { ... }

// Activer/désactiver un membre de l'équipe
export const toggleTeamMemberStatus = async (id) => { ... }

// Upload d'une photo pour un membre de l'équipe
export const uploadPhoto = async (file, onProgressUpdate) => { ... }
```

## Fonctionnalités Spécifiques

### Gestion des Profils Utilisateurs

Les profils utilisateurs (watcher, power-user, admin) sont gérés via le champ `profile` du modèle TeamMember. L'interface affiche ces profils avec des badges colorés correspondants.

### Conversion des Noms de Pays en Drapeaux

La fonction `getCountryFlag` utilise la bibliothèque `country-flag-emoji-json` pour convertir les noms de pays en drapeaux emoji :

```javascript
const getCountryFlag = (countryName) => {
  if (!countryName) return '';
  
  // Normaliser le nom du pays
  const normalizedCountryName = countryName.toLowerCase().trim();
  
  // Mappings spéciaux pour les noms en français
  const specialMappings = {
    'france': 'France',
    'allemagne': 'Germany',
    'royaume-uni': 'United Kingdom',
    'etats-unis': 'United States',
    'états-unis': 'United States',
    // ... autres mappings
  };
  
  // Rechercher dans les correspondances spéciales
  const englishCountryName = specialMappings[normalizedCountryName] || countryName;
  
  // Rechercher le pays dans la liste des pays
  const country = Object.values(countriesData).find(c => 
    c.name.toLowerCase() === englishCountryName.toLowerCase() ||
    c.code.toLowerCase() === englishCountryName.toLowerCase()
  );
  
  return country ? country.emoji : '';
};
```

### Upload de Photos avec Drag and Drop

L'upload de photos utilise une combinaison de React Hooks et d'événements DOM pour gérer le glisser-déposer :

```javascript
// Fonction pour gérer le drag and drop
const handleDrag = (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  if (e.type === 'dragenter' || e.type === 'dragover') {
    setDragActive(true);
  } else if (e.type === 'dragleave') {
    setDragActive(false);
  }
};

// Fonction pour gérer le drop
const handleDrop = (e) => {
  e.preventDefault();
  e.stopPropagation();
  setDragActive(false);
  
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFileUpload(e.dataTransfer.files[0]);
  }
};
```

## Sécurité

### Protection des Données Sensibles

Le TJM (Taux Journalier Moyen) est une donnée sensible qui n'est visible que par les utilisateurs ayant le rôle 'admin'. Cette restriction est implémentée à la fois côté frontend et backend.

### Authentification pour l'Upload de Photos

Les routes d'upload de photos sont protégées par le middleware d'authentification `protect` qui vérifie la validité du token JWT. La suppression de photos est restreinte aux utilisateurs ayant le profil 'admin'.

## Tests

Des tests unitaires et d'intégration ont été implémentés pour valider les fonctionnalités :

- Tests du modèle TeamMember
- Tests des contrôleurs et routes
- Tests du composant TeamMembers
- Tests des routes d'upload

## Configuration CORS pour les Images

Pour permettre l'affichage des images uploadées, des en-têtes CORS spécifiques ont été ajoutés :

```javascript
app.use('/uploads', (req, res, next) => {
  // Configurer les en-têtes CORS pour permettre l'accès aux images
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));
```

## Évolutions Futures

1. **Filtrage avancé** : Ajout de filtres par rôle, profil, localisation, etc.
2. **Exportation des données** : Export au format CSV/Excel
3. **Intégration avec d'autres modules** : Lier les membres aux sprints, user stories, etc.
4. **Statistiques d'équipe** : Visualisation des données d'équipe (composition, coûts, etc.)
5. **Historique des modifications** : Suivi des changements sur les membres d'équipe
