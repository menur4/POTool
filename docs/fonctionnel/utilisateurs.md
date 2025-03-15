# Gestion des Utilisateurs et Authentification

## Aperçu

Le module de gestion des utilisateurs et d'authentification est la pierre angulaire de la sécurité de POTool. Il permet de contrôler l'accès à l'application, de gérer les profils utilisateurs et d'appliquer des permissions basées sur les rôles.

## Fonctionnalités d'Authentification

### Inscription et Création de Compte

POTool offre plusieurs méthodes pour créer un compte utilisateur :

1. **Inscription directe** : L'utilisateur fournit son email, son prénom, son nom et crée un mot de passe
   - Le mot de passe doit respecter les règles de sécurité (8 caractères minimum, majuscules, minuscules, chiffres et caractères spéciaux)
   - L'email doit être unique dans le système
   - Après inscription réussie, l'utilisateur est automatiquement connecté et redirigé vers le tableau de bord
2. **Invitation par administrateur** : Un administrateur crée un compte et envoie une invitation par email (fonctionnalité à venir)
3. **Authentification unique (SSO)** : Intégration avec des systèmes d'authentification d'entreprise (fonctionnalité optionnelle à venir)

### Processus de Connexion

Le processus d'authentification comprend :

- Formulaire de connexion sécurisé (email/mot de passe)
- Authentification par token JWT avec expiration configurable
- Protection contre les attaques par force brute
- Option "Se souvenir de moi" pour les sessions prolongées (fonctionnalité à venir)
- Déconnexion sécurisée avec suppression du token côté client

### Gestion des Sessions

Le système gère les sessions utilisateur avec :

- Jetons JWT (JSON Web Tokens) pour l'authentification sans état
- Expiration automatique des sessions inactives
- Possibilité de voir et terminer les sessions actives

### Récupération de Compte

En cas d'oubli de mot de passe, le système propose :

- Processus de réinitialisation par email
- Questions de sécurité (optionnel)
- Verrouillage temporaire après plusieurs tentatives échouées

## Gestion des Utilisateurs

### Profils Utilisateurs

Chaque utilisateur dispose d'un profil comprenant :

- Informations personnelles (nom, prénom, email)
- Préférences (langue, notifications, thème)
- Équipe(s) associée(s)
- Historique d'activité

### Système de Rôles et Permissions

POTool implémente un système de contrôle d'accès basé sur les rôles (RBAC) avec les rôles suivants :

1. **Administrateur** :
   - Gestion complète des utilisateurs
   - Configuration système
   - Accès à toutes les fonctionnalités

2. **Chef de Projet / Scrum Master** :
   - Création et gestion des sprints
   - Accès aux statistiques et à la roadmap
   - Gestion des epics
   - Configuration des paramètres d'équipe

3. **Membre d'Équipe** :
   - Visualisation des sprints
   - Mise à jour du statut des epics
   - Accès limité aux statistiques

4. **Observateur** :
   - Accès en lecture seule
   - Visualisation des sprints et statistiques
   - Aucune modification possible

### Gestion des Équipes

Le système permet de :

- Créer et gérer des équipes
- Assigner des utilisateurs à une ou plusieurs équipes
- Définir des rôles spécifiques par équipe
- Visualiser la composition des équipes

## Sécurité

### Protection des Données

POTool implémente plusieurs niveaux de sécurité :

- Chiffrement des mots de passe avec des algorithmes robustes (bcryptjs)
- Protection contre les attaques CSRF
- Validation des entrées pour prévenir les injections
- Chiffrement des données sensibles

### Mode Mémoire

POTool peut fonctionner en mode mémoire lorsque la connexion à MongoDB n'est pas disponible. Ce mode est particulièrement utile pour :

- Le développement local sans avoir à configurer MongoDB
- Les tests et démonstrations rapides
- Les environnements où la persistance des données n'est pas nécessaire

En mode mémoire, toutes les données sont stockées temporairement et seront perdues lors du redémarrage du serveur. Pour une utilisation en production, il est recommandé de configurer une connexion à MongoDB.

### Journalisation et Audit

Le système maintient des logs détaillés :

- Tentatives de connexion (réussies et échouées)
- Actions administratives importantes
- Modifications de permissions
- Création/suppression de comptes

### Conformité

L'application est conçue pour respecter les normes de sécurité et de confidentialité :

- Conformité RGPD pour les données personnelles
- Politique de conservation des données
- Fonctionnalités d'exportation et de suppression de données personnelles

## Interfaces Utilisateur

### Page de Connexion

Interface épurée et sécurisée pour l'authentification.

### Gestion de Profil

Page permettant à l'utilisateur de :
- Visualiser et modifier ses informations
- Changer son mot de passe
- Configurer ses préférences

### Administration des Utilisateurs

Interface réservée aux administrateurs pour :
- Voir tous les utilisateurs
- Créer, modifier, désactiver des comptes
- Gérer les rôles et permissions
- Réinitialiser les mots de passe

### Gestion des Équipes

Interface pour :
- Créer et configurer des équipes
- Assigner des membres
- Définir des responsables d'équipe
