# Documentation Technique - Backend d'Authentification

## Vue d'ensemble

Le backend d'authentification de POTool est construit avec Node.js et Express. Il fournit une API RESTful pour gérer l'authentification des utilisateurs, y compris l'inscription, la connexion, la récupération et la réinitialisation des mots de passe.

## Architecture

Le backend d'authentification est organisé selon une architecture MVC (Modèle-Vue-Contrôleur) :

1. **Modèles** : Définition du schéma utilisateur avec Mongoose
2. **Contrôleurs** : Logique métier pour les opérations d'authentification
3. **Routes** : Points d'entrée API pour les requêtes HTTP
4. **Middleware** : Fonctions intermédiaires pour la protection des routes et la validation

## Composants principaux

### Modèle Utilisateur (User.js)

Le modèle utilisateur définit la structure des données utilisateur dans la base de données MongoDB :

```javascript
const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Veuillez fournir un prénom'],
    trim: true,
    maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
  },
  lastName: {
    type: String,
    required: [true, 'Veuillez fournir un nom'],
    trim: true,
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },
  email: {
    type: String,
    required: [true, 'Veuillez fournir un email'],
    unique: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Veuillez fournir un email valide'
    ]
  },
  password: {
    type: String,
    required: [true, 'Veuillez fournir un mot de passe'],
    minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  language: {
    type: String,
    enum: ['french', 'english', 'arabic'],
    default: 'french'
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});
```

Le modèle inclut également des méthodes pour :
- Hacher les mots de passe avant l'enregistrement
- Vérifier les mots de passe
- Générer des tokens JWT
- Créer des tokens de réinitialisation de mot de passe

### Contrôleur d'Authentification (auth.js)

Le contrôleur d'authentification contient la logique métier pour les opérations d'authentification :

#### Inscription (register)
- Valide les données d'entrée
- Vérifie si l'utilisateur existe déjà
- Crée un nouvel utilisateur
- Génère un token JWT
- Renvoie le token et les informations utilisateur

#### Connexion (login)
- Valide les données d'entrée
- Vérifie si l'utilisateur existe
- Vérifie si le mot de passe correspond
- Génère un token JWT
- Renvoie le token et les informations utilisateur

#### Récupération de mot de passe (forgotPassword)
- Recherche l'utilisateur par email
- Génère un token de réinitialisation
- Enregistre le token dans la base de données
- Envoie un email avec le lien de réinitialisation (simulé pour les tests)

#### Réinitialisation de mot de passe (resetPassword)
- Vérifie la validité du token
- Met à jour le mot de passe de l'utilisateur
- Génère un nouveau token JWT
- Renvoie le token

### Routes d'Authentification (auth.js)

Les routes définissent les points d'entrée API pour les opérations d'authentification :

```javascript
// Routes publiques
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resetToken', resetPassword);

// Routes protégées
router.get('/me', protect, getMe);
```

### Middleware d'Authentification (auth.js)

Le middleware `protect` est utilisé pour sécuriser les routes qui nécessitent une authentification :

```javascript
exports.protect = async (req, res, next) => {
  let token;

  // Vérifier si le token est présent dans les headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Extraire le token du header
    token = req.headers.authorization.split(' ')[1];
  }

  // Vérifier si le token existe
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Non autorisé à accéder à cette route'
    });
  }

  try {
    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ajouter l'utilisateur à la requête
    req.user = {
      id: decoded.id,
      role: decoded.role
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Non autorisé à accéder à cette route'
    });
  }
};
```

## Flux d'authentification

### Inscription

1. Le client envoie une requête POST à `/api/auth/register` avec les données utilisateur
2. Le serveur valide les données et vérifie si l'email existe déjà
3. Si l'email est unique, un nouvel utilisateur est créé
4. Un token JWT est généré et renvoyé au client avec les informations utilisateur

### Connexion

1. Le client envoie une requête POST à `/api/auth/login` avec l'email et le mot de passe
2. Le serveur vérifie si l'utilisateur existe et si le mot de passe correspond
3. Si les informations sont correctes, un token JWT est généré et renvoyé au client

### Récupération de mot de passe

1. Le client envoie une requête POST à `/api/auth/forgot-password` avec l'email
2. Le serveur vérifie si l'utilisateur existe
3. Si l'utilisateur existe, un token de réinitialisation est généré
4. Dans un environnement de production, un email serait envoyé à l'utilisateur
5. Pour les tests, le token est renvoyé directement dans la réponse

### Réinitialisation de mot de passe

1. Le client envoie une requête PUT à `/api/auth/reset-password/:resetToken` avec le nouveau mot de passe
2. Le serveur vérifie la validité du token
3. Si le token est valide, le mot de passe est mis à jour
4. Un nouveau token JWT est généré et renvoyé au client

## Sécurité

Le backend implémente plusieurs mesures de sécurité :

- **Hachage des mots de passe** : Les mots de passe sont hachés avec bcrypt avant d'être stockés
- **Tokens JWT** : Utilisés pour l'authentification stateless
- **Protection des routes** : Middleware pour sécuriser les routes sensibles
- **Validation des entrées** : Vérification des données utilisateur
- **Expiration des tokens** : Les tokens JWT et de réinitialisation ont une durée de validité limitée

## Version de test

Pour faciliter les tests sans dépendre d'une base de données MongoDB, une version simplifiée du backend a été implémentée avec les caractéristiques suivantes :

- Stockage en mémoire au lieu de MongoDB
- Simulation des opérations de base de données
- Pas de hachage réel des mots de passe (pour simplifier les tests)
- Retour du token de réinitialisation dans la réponse (au lieu de l'envoi par email)

Cette version de test permet de tester l'intégration frontend-backend sans avoir à configurer une base de données.

## Dépendances

- **express** : Framework web
- **jsonwebtoken** : Génération et vérification des tokens JWT
- **bcryptjs** : Hachage des mots de passe
- **mongoose** : ODM pour MongoDB
- **dotenv** : Gestion des variables d'environnement
- **cors** : Gestion des requêtes cross-origin

## Configuration

Le backend utilise les variables d'environnement suivantes :

- **PORT** : Port du serveur (défaut: 5000)
- **MONGODB_URI** : URI de connexion à MongoDB
- **JWT_SECRET** : Clé secrète pour les tokens JWT
- **JWT_EXPIRE** : Durée de validité des tokens JWT

## Tests

Les tests unitaires et d'intégration peuvent être exécutés avec Jest :

```bash
npm test
```

## Améliorations futures

- Implémentation de l'authentification à deux facteurs
- Ajout de la validation avec express-validator
- Mise en place d'un système de limitation de débit (rate limiting)
- Journalisation des tentatives de connexion
- Support pour l'authentification via des fournisseurs tiers (OAuth)
