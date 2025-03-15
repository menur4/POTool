# Documentation Technique - Authentification et Gestion des Utilisateurs

## Architecture

Le système d'authentification et de gestion des utilisateurs de POTool est basé sur une architecture moderne utilisant JWT (JSON Web Tokens) pour l'authentification sans état. Cette approche permet une meilleure scalabilité et une séparation claire entre le frontend et le backend.

## Modèle de Données

### Schéma Utilisateur

Le modèle utilisateur (`User`) est défini avec les champs suivants :

```javascript
{
  firstName: String,       // Prénom de l'utilisateur
  lastName: String,        // Nom de l'utilisateur
  email: String,           // Email (unique, utilisé pour l'authentification)
  password: String,        // Mot de passe (haché avec bcryptjs)
  role: String,            // Rôle (admin, project_manager, member, observer)
  teams: [ObjectId],       // Équipes auxquelles l'utilisateur appartient
  language: String,        // Préférence de langue (fr, en, ar)
  active: Boolean,         // Statut du compte (actif/inactif)
  lastLogin: Date,         // Date de dernière connexion
  resetPasswordToken: String,     // Token pour réinitialisation de mot de passe
  resetPasswordExpires: Date,     // Date d'expiration du token
  createdAt: Date,         // Date de création du compte
  updatedAt: Date          // Date de dernière mise à jour
}
```

## Sécurité

### Hachage des Mots de Passe

Les mots de passe sont hachés à l'aide de bcryptjs avec un facteur de coût de 10. Ce processus est automatiquement géré par un middleware Mongoose qui s'exécute avant chaque sauvegarde d'utilisateur.

```javascript
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});
```

### Authentification JWT

L'authentification est gérée via des tokens JWT (JSON Web Tokens) qui sont générés lors de la connexion et de l'inscription. Ces tokens contiennent l'ID de l'utilisateur et expirent après une durée configurable (par défaut 1 heure).

```javascript
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};
```

### Protection des Routes

Les routes nécessitant une authentification sont protégées par un middleware qui vérifie la présence et la validité du token JWT.

```javascript
exports.protect = async (req, res, next) => {
  // Vérification du token
  // ...
  
  // Ajout de l'utilisateur à la requête
  req.user = user;
  next();
};
```

### Contrôle d'Accès Basé sur les Rôles (RBAC)

Le système implémente un contrôle d'accès basé sur les rôles qui permet de restreindre l'accès à certaines fonctionnalités en fonction du rôle de l'utilisateur.

```javascript
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: req.t('auth.unauthorized')
      });
    }
    next();
  };
};
```

### Mesures de Sécurité Supplémentaires

- **Helmet** : Configuration des en-têtes HTTP pour améliorer la sécurité
- **XSS-Clean** : Protection contre les attaques XSS
- **Express-Mongo-Sanitize** : Prévention des injections NoSQL
- **Rate Limiting** : Limitation du nombre de requêtes pour prévenir les attaques par force brute

## API Endpoints

### Inscription

- **URL** : `/api/auth/register`
- **Méthode** : `POST`
- **Corps de la requête** :
  ```json
  {
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean.dupont@example.com",
    "password": "MotDePasse123!",
    "confirmPassword": "MotDePasse123!"
  }
  ```
- **Réponse** :
  ```json
  {
    "user": {
      "_id": "60d21b4667d0d8992e610c85",
      "firstName": "Jean",
      "lastName": "Dupont",
      "email": "jean.dupont@example.com",
      "role": "member"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### Connexion

- **URL** : `/api/auth/login`
- **Méthode** : `POST`
- **Corps de la requête** :
  ```json
  {
    "email": "jean.dupont@example.com",
    "password": "MotDePasse123!"
  }
  ```
- **Réponse** :
  ```json
  {
    "user": {
      "_id": "60d21b4667d0d8992e610c85",
      "firstName": "Jean",
      "lastName": "Dupont",
      "email": "jean.dupont@example.com",
      "role": "member"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### Mot de Passe Oublié

- **URL** : `/api/auth/forgot-password`
- **Méthode** : `POST`
- **Corps de la requête** :
  ```json
  {
    "email": "jean.dupont@example.com"
  }
  ```
- **Réponse** :
  ```json
  {
    "message": "Un email de réinitialisation a été envoyé si cet email est associé à un compte"
  }
  ```

### Réinitialisation de Mot de Passe

- **URL** : `/api/auth/reset-password`
- **Méthode** : `POST`
- **Corps de la requête** :
  ```json
  {
    "token": "token_de_reinitialisation",
    "password": "NouveauMotDePasse123!",
    "confirmPassword": "NouveauMotDePasse123!"
  }
  ```
- **Réponse** :
  ```json
  {
    "message": "Votre mot de passe a été réinitialisé avec succès",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### Profil Utilisateur

- **URL** : `/api/auth/me`
- **Méthode** : `GET`
- **En-têtes** : `Authorization: Bearer <token>`
- **Réponse** :
  ```json
  {
    "_id": "60d21b4667d0d8992e610c85",
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean.dupont@example.com",
    "role": "member",
    "language": "fr",
    "teams": []
  }
  ```

### Mise à Jour du Profil

- **URL** : `/api/auth/me`
- **Méthode** : `PUT`
- **En-têtes** : `Authorization: Bearer <token>`
- **Corps de la requête** :
  ```json
  {
    "firstName": "Jean-Pierre",
    "language": "en"
  }
  ```
- **Réponse** :
  ```json
  {
    "_id": "60d21b4667d0d8992e610c85",
    "firstName": "Jean-Pierre",
    "lastName": "Dupont",
    "email": "jean.dupont@example.com",
    "role": "member",
    "language": "en",
    "teams": []
  }
  ```

### Changement de Mot de Passe

- **URL** : `/api/auth/change-password`
- **Méthode** : `PUT`
- **En-têtes** : `Authorization: Bearer <token>`
- **Corps de la requête** :
  ```json
  {
    "currentPassword": "MotDePasse123!",
    "newPassword": "NouveauMotDePasse123!",
    "confirmNewPassword": "NouveauMotDePasse123!"
  }
  ```
- **Réponse** :
  ```json
  {
    "message": "Votre mot de passe a été changé avec succès",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

## Internationalisation

Tous les messages d'erreur et de succès sont internationalisés à l'aide de i18next. Les traductions sont disponibles en français, anglais et arabe.

## Tests

Le système d'authentification est testé de manière approfondie avec Jest. Les tests couvrent :

1. **Tests unitaires** pour le modèle utilisateur
2. **Tests d'intégration** pour les contrôleurs d'authentification
3. **Tests de validation** pour les entrées utilisateur

## Variables d'Environnement

Les variables d'environnement suivantes sont utilisées pour la configuration :

- `JWT_SECRET` : Clé secrète pour signer les tokens JWT
- `JWT_EXPIRES_IN` : Durée de validité des tokens JWT (ex: "1h", "7d")
- `MONGODB_URI` : URI de connexion à la base de données MongoDB
- `DEFAULT_LANGUAGE` : Langue par défaut pour l'internationalisation

## Prochaines Étapes

- Implémentation de l'envoi d'emails pour la réinitialisation de mot de passe
- Ajout de l'authentification à deux facteurs
- Gestion des sessions multiples
- Journalisation des activités utilisateur
