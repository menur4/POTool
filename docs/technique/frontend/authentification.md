# Documentation Technique - Authentification Frontend

## Vue d'ensemble

Le système d'authentification frontend de POTool est construit avec React et utilise un ensemble de composants et de contextes pour gérer l'état d'authentification des utilisateurs. Cette documentation décrit l'architecture, les composants principaux et les flux d'authentification.

## Architecture

L'authentification frontend est basée sur une architecture de contexte React qui centralise la gestion de l'état d'authentification. Les composants principaux sont :

1. **AuthContext** : Contexte central qui gère l'état d'authentification et fournit des méthodes pour l'authentification.
2. **ProtectedRoute** : Composant qui protège les routes nécessitant une authentification.
3. **Pages d'authentification** : Composants de page pour la connexion, l'inscription et la gestion des mots de passe.

## Composants principaux

### AuthContext

Le contexte d'authentification (`AuthContext.js`) est le cœur du système d'authentification. Il :

- Gère l'état d'authentification global
- Fournit des méthodes pour la connexion, l'inscription et la déconnexion
- Gère la récupération et la réinitialisation des mots de passe
- Stocke et récupère les informations d'authentification dans le localStorage
- Gère les erreurs d'authentification

```jsx
// Structure simplifiée de AuthContext.js
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Méthodes d'authentification
  const login = async (email, password, rememberMe) => { /* ... */ };
  const register = async (firstName, lastName, email, password, confirmPassword, language) => { /* ... */ };
  const logout = () => { /* ... */ };
  const forgotPassword = async (email) => { /* ... */ };
  const resetPassword = async (token, password, confirmPassword) => { /* ... */ };

  // Valeur du contexte
  const value = {
    user,
    isAuthenticated,
    error,
    loading,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    clearError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
```

### ProtectedRoute

Le composant `ProtectedRoute` protège les routes qui nécessitent une authentification. Il redirige les utilisateurs non authentifiés vers la page de connexion.

```jsx
// Structure simplifiée de ProtectedRoute.js
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return children;
};
```

### Pages d'authentification

#### Login.js

La page de connexion permet aux utilisateurs de se connecter avec leur email et mot de passe. Elle utilise Formik pour la gestion du formulaire et Yup pour la validation.

Caractéristiques principales :
- Interface moderne avec design responsive et animations subtiles
- Icônes visuelles pour améliorer l'expérience utilisateur (email, mot de passe, bouton de connexion)
- Bouton de visibilité du mot de passe pour afficher/masquer le mot de passe
- Validation des champs email et mot de passe
- Option "Se souvenir de moi"
- Affichage des erreurs d'authentification avec gestion optimisée des messages longs
- Indication de connexion sécurisée
- Lien vers la récupération de mot de passe
- Lien vers la page d'inscription
- Largeur fixe de la boîte de connexion pour une meilleure cohérence visuelle

#### Register.js

La page d'inscription permet aux nouveaux utilisateurs de créer un compte. Elle utilise également Formik et Yup pour la gestion et la validation du formulaire.

Caractéristiques principales :
- Validation complète des champs (prénom, nom, email, mot de passe)
- Vérification de la correspondance des mots de passe
- Sélection de la langue préférée
- Affichage des erreurs d'inscription

#### ForgotPassword.js

Cette page permet aux utilisateurs de demander une réinitialisation de mot de passe en fournissant leur email.

Caractéristiques principales :
- Validation de l'email
- Affichage d'un message de succès après l'envoi
- Lien de retour vers la page de connexion

#### ResetPassword.js

Cette page permet aux utilisateurs de définir un nouveau mot de passe après avoir cliqué sur le lien de réinitialisation envoyé par email.

Caractéristiques principales :
- Validation du nouveau mot de passe
- Vérification de la correspondance des mots de passe
- Redirection automatique vers la page de connexion après réinitialisation réussie

## Flux d'authentification

### Connexion

1. L'utilisateur accède à la page de connexion
2. Il saisit son email et son mot de passe
3. Le formulaire est validé côté client
4. Les informations sont envoyées à l'API via la méthode `login` du contexte d'authentification
5. En cas de succès :
   - Les informations d'authentification sont stockées dans le localStorage
   - L'état d'authentification est mis à jour
   - L'utilisateur est redirigé vers la page d'accueil
6. En cas d'échec, un message d'erreur est affiché

### Inscription

1. L'utilisateur accède à la page d'inscription
2. Il remplit le formulaire avec ses informations
3. Le formulaire est validé côté client
4. Les informations sont envoyées à l'API via la méthode `register` du contexte d'authentification
5. En cas de succès :
   - Les informations d'authentification sont stockées dans le localStorage
   - L'état d'authentification est mis à jour
   - L'utilisateur est redirigé vers la page d'accueil
6. En cas d'échec, un message d'erreur est affiché

### Récupération de mot de passe

1. L'utilisateur accède à la page de récupération de mot de passe
2. Il saisit son email
3. L'email est validé côté client
4. La demande est envoyée à l'API via la méthode `forgotPassword` du contexte d'authentification
5. Un message de succès est affiché, indiquant à l'utilisateur de vérifier son email

### Réinitialisation de mot de passe

1. L'utilisateur clique sur le lien de réinitialisation dans l'email
2. Il est dirigé vers la page de réinitialisation avec un token dans l'URL
3. Il saisit et confirme son nouveau mot de passe
4. Les mots de passe sont validés côté client
5. La demande est envoyée à l'API via la méthode `resetPassword` du contexte d'authentification
6. En cas de succès, l'utilisateur est redirigé vers la page de connexion

## Internationalisation

Le système d'authentification prend en charge l'internationalisation via la bibliothèque i18next. Les traductions sont disponibles en français, anglais et arabe, et sont stockées dans des fichiers JSON dans le dossier `locales`.

```jsx
// Exemple d'utilisation de l'internationalisation
import { useTranslation } from 'react-i18next';

const LoginPage = () => {
  const { t } = useTranslation();
  
  return (
    <h1>{t('auth.login')}</h1>
    // ...
  );
};
```

## Tests

Des tests unitaires complets ont été implémentés pour tous les composants d'authentification à l'aide de Jest et React Testing Library. Les tests couvrent :

- Le contexte d'authentification
- Les routes protégées
- Les pages de connexion, d'inscription, de récupération et de réinitialisation de mot de passe

Les tests se trouvent dans le dossier `__tests__` et peuvent être exécutés avec la commande `npm test`.

## Sécurité

Le système d'authentification frontend implémente plusieurs mesures de sécurité :

- Validation côté client des entrées utilisateur
- Stockage sécurisé des tokens d'authentification
- Protection des routes sensibles
- Gestion des erreurs d'authentification
- Option pour masquer/afficher les mots de passe

## Dépendances

- **React** : Bibliothèque UI principale
- **React Router** : Gestion des routes et navigation
- **Formik** : Gestion des formulaires
- **Yup** : Validation des formulaires
- **Axios** : Requêtes HTTP vers l'API
- **React Bootstrap** : Composants UI
- **i18next** : Internationalisation

## Améliorations futures

- Implémentation de l'authentification à deux facteurs
- Support pour l'authentification via des fournisseurs tiers (Google, GitHub, etc.)
- Amélioration de la gestion des sessions
- Mise en place d'un système de rafraîchissement automatique des tokens
