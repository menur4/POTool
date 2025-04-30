# Documentation Fonctionnelle - Authentification

## Vue d'ensemble

Le module d'authentification de POTool permet aux utilisateurs de créer un compte, de se connecter à l'application, de gérer leur profil et de récupérer leur mot de passe en cas d'oubli. Cette documentation décrit les fonctionnalités disponibles et leur utilisation du point de vue de l'utilisateur.

## Fonctionnalités principales

### Inscription

L'inscription permet à un nouvel utilisateur de créer un compte dans l'application POTool.

**Processus d'inscription :**
1. L'utilisateur accède à la page d'inscription via le lien "S'inscrire" sur la page de connexion
2. Il remplit le formulaire avec les informations suivantes :
   - Prénom
   - Nom
   - Adresse email (qui servira d'identifiant)
   - Mot de passe (avec confirmation)
   - Langue préférée (français, anglais ou arabe)
3. Après validation du formulaire, un compte est créé et l'utilisateur est automatiquement connecté

**Règles de validation :**
- L'email doit être valide et unique dans la base de données
- Le mot de passe doit contenir au moins 8 caractères, incluant une majuscule, une minuscule, un chiffre et un caractère spécial
- Les deux champs de mot de passe doivent correspondre
- Tous les champs sont obligatoires

### Connexion

La connexion permet à un utilisateur existant d'accéder à son compte POTool.

**Processus de connexion :**
1. L'utilisateur accède à la page de connexion (page d'accueil par défaut pour les utilisateurs non connectés)
2. Il saisit son email et son mot de passe
3. Il peut choisir l'option "Se souvenir de moi" pour rester connecté
4. Après validation, l'utilisateur est redirigé vers le tableau de bord

**Fonctionnalités supplémentaires :**
- Option pour afficher/masquer le mot de passe
- Lien vers la page de récupération de mot de passe
- Lien vers la page d'inscription pour les nouveaux utilisateurs

### Récupération de mot de passe

Cette fonctionnalité permet à un utilisateur ayant oublié son mot de passe de le réinitialiser.

**Processus de récupération :**
1. L'utilisateur accède à la page "Mot de passe oublié" depuis la page de connexion
2. Il saisit son adresse email
3. Un email contenant un lien de réinitialisation est envoyé à cette adresse
4. L'utilisateur reçoit une confirmation que l'email a été envoyé

### Réinitialisation de mot de passe

Cette page permet à l'utilisateur de définir un nouveau mot de passe après avoir cliqué sur le lien de réinitialisation.

**Processus de réinitialisation :**
1. L'utilisateur clique sur le lien reçu par email
2. Il est dirigé vers la page de réinitialisation de mot de passe
3. Il saisit et confirme son nouveau mot de passe
4. Après validation, l'utilisateur est redirigé vers la page de connexion avec un message de succès

**Règles de validation :**
- Le nouveau mot de passe doit respecter les mêmes règles que lors de l'inscription
- Le lien de réinitialisation est valide pour une durée limitée (24 heures)

### Déconnexion

La déconnexion permet à l'utilisateur de se déconnecter de l'application.

**Processus de déconnexion :**
1. L'utilisateur clique sur le bouton de déconnexion dans le menu de navigation
2. Sa session est terminée et il est redirigé vers la page de connexion

## Aspects techniques

### Sécurité

- Authentification basée sur les tokens JWT (JSON Web Tokens)
- Mots de passe hachés avec bcrypt
- Protection contre les attaques CSRF et XSS
- Validation des données côté client et côté serveur
- Sessions expirées automatiquement après une période d'inactivité

### Internationalisation

L'interface d'authentification est disponible en trois langues :
- Français (langue par défaut)
- Anglais
- Arabe

L'utilisateur peut choisir sa langue préférée lors de l'inscription, et cette préférence est enregistrée dans son profil.

### Accessibilité

L'interface d'authentification a été conçue en tenant compte des principes d'accessibilité :
- Structure sémantique HTML appropriée
- Messages d'erreur clairs et descriptifs
- Support pour la navigation au clavier
- Contraste de couleurs adéquat

## Captures d'écran

*Note: Des captures d'écran seront ajoutées ultérieurement pour illustrer chaque écran d'authentification.*

## Flux utilisateur

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │
│   Accueil   │────▶│  Connexion  │────▶│ Tableau de  │
│             │     │             │     │    bord     │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           │
                    ┌──────▼──────┐
                    │             │
                    │ Inscription │
                    │             │
                    └──────┬──────┘
                           │
                           │
                    ┌──────▼──────┐     ┌─────────────┐
                    │  Mot de     │     │ Réinitiali- │
                    │  passe      │────▶│ sation mot  │
                    │  oublié     │     │ de passe    │
                    └─────────────┘     └─────────────┘
```

## Messages d'erreur

Les messages d'erreur sont affichés de manière claire et précise pour guider l'utilisateur :

- **Connexion :**
  - "Email ou mot de passe incorrect"
  - "Votre compte a été désactivé. Veuillez contacter l'administrateur"

- **Inscription :**
  - "Cet email est déjà utilisé"
  - "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial"
  - "Les mots de passe ne correspondent pas"

- **Récupération de mot de passe :**
  - "Aucun compte n'est associé à cet email"

- **Réinitialisation de mot de passe :**
  - "Le lien de réinitialisation est invalide ou a expiré"

## Cas particuliers

### Première connexion

Lors de la première connexion après l'inscription, l'utilisateur est invité à compléter son profil avec des informations supplémentaires.

### Compte verrouillé

Après plusieurs tentatives de connexion échouées, le compte peut être temporairement verrouillé pour des raisons de sécurité. Un message approprié est affiché à l'utilisateur.

### Session expirée

Si la session de l'utilisateur expire pendant qu'il utilise l'application, il est automatiquement redirigé vers la page de connexion avec un message indiquant que sa session a expiré.

## Mode de test

Pour faciliter les tests des fonctionnalités d'authentification sans avoir besoin d'une base de données MongoDB, un backend de test a été implémenté.

### Caractéristiques du mode test

- Stockage des données en mémoire (pas de persistance après redémarrage du serveur)
- Fonctionnement sans base de données MongoDB
- Simulation des opérations CRUD pour les utilisateurs
- Simplification de certaines fonctionnalités de sécurité pour faciliter les tests

### Utilisation du mode test

1. Démarrer le serveur backend avec la commande `npm start` dans le dossier `server`
2. Démarrer le frontend avec la commande `npm start` dans le dossier `client`
3. Accéder à l'application via http://localhost:3000

### Particularités du mode test

- Lors de la récupération de mot de passe, le token de réinitialisation est retourné directement dans la réponse API (au lieu d'être envoyé par email)
- Les mots de passe ne sont pas réellement hachés dans ce mode
- Les données sont perdues à chaque redémarrage du serveur

### Guide de test

1. **Inscription** : Créer un compte avec des informations valides
2. **Connexion** : Se connecter avec l'email et le mot de passe créés
3. **Récupération de mot de passe** : Tester la fonctionnalité et récupérer le token dans la réponse API
4. **Réinitialisation de mot de passe** : Utiliser le token pour définir un nouveau mot de passe
5. **Routes protégées** : Vérifier que les routes protégées ne sont accessibles qu'après connexion

## Évolutions futures

Les fonctionnalités suivantes sont prévues pour les prochaines versions :

1. **Authentification à deux facteurs (2FA)** : Ajout d'une couche de sécurité supplémentaire avec vérification par SMS ou application d'authentification
2. **Connexion via réseaux sociaux** : Possibilité de se connecter via Google, GitHub, etc.
3. **Gestion des appareils connectés** : Visualisation et déconnexion des sessions actives sur différents appareils
4. **Historique des connexions** : Journal des connexions récentes avec informations sur l'appareil et la localisation
