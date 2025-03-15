# Gestion des Sprints

## Aperçu

La gestion des sprints est une fonctionnalité centrale de POTool. Elle permet de planifier, suivre et analyser les cycles de développement agile (sprints) de l'équipe.

## États d'un Sprint

Un sprint peut se trouver dans l'un des états suivants :

1. **Planifié (planned)** : Le sprint est créé et configuré, mais n'a pas encore démarré
2. **Actif (active)** : Le sprint est en cours d'exécution
3. **Terminé (completed)** : Le sprint est clôturé et les métriques finales sont calculées

## Configuration Prévisionnelle

### Création d'un Sprint

Lors de la création d'un sprint, l'utilisateur doit fournir les informations suivantes :

- **Nom du sprint** : Identifiant unique du sprint (ex: "Sprint 23")
- **Dates de début et fin** : Période couverte par le sprint
- **Configuration de l'équipe** :
  - Nombre de développeurs
  - Jours de congés prévus
  - Pourcentage de temps alloué aux réunions
  - Pourcentage de temps alloué aux bugs

### Calcul de la Capacité

Le système calcule automatiquement la capacité prévisionnelle du sprint en jours/homme selon la formule :

```
Capacité = (Jours ouvrés entre début et fin) × Nombre de développeurs - Jours de congés
```

Cette capacité brute est ensuite ajustée en fonction des pourcentages de temps alloués aux réunions et aux bugs :

```
Capacité ajustée = Capacité × (1 - % réunions - % bugs)
```

### Sélection des Epics

Une fois la capacité calculée, l'utilisateur peut sélectionner les epics à embarquer dans le sprint. Le système suggère un "panier" de story points embarquables en fonction de la vélocité historique de l'équipe.

Pour chaque epic sélectionné, l'utilisateur spécifie :
- L'epic à inclure
- Le nombre de story points associés

## Suivi Réel

### Mise à Jour des Données

Pendant le sprint, l'utilisateur peut mettre à jour les données réelles :
- Jours de congés effectifs
- Pourcentage réel de temps passé en réunions
- Pourcentage réel de temps consacré aux bugs

### Suivi des Epics

L'utilisateur peut également mettre à jour le statut des epics inclus dans le sprint :
- Marquer un epic comme complété ou non
- Ajuster les story points si nécessaire

## Clôture de Sprint

### Processus de Clôture

À la fin du sprint, l'utilisateur procède à la clôture :
1. Mise à jour finale des données réelles
2. Confirmation des epics effectivement livrés
3. Validation de la clôture

### Calcul de la Vélocité

Le système calcule automatiquement la vélocité du sprint selon la formule :

```
Vélocité = Somme des story points des epics complétés / Capacité réelle ajustée
```

Cette vélocité est enregistrée pour servir de référence pour les sprints futurs.

## Règles de Gestion

- Un sprint ne peut pas être créé avec une date de début postérieure à sa date de fin
- Un sprint ne peut pas être clôturé s'il n'est pas à l'état "actif"
- La capacité d'un sprint ne peut pas être négative
- Les pourcentages de réunions et de bugs doivent être compris entre 0 et 100%
- La somme des pourcentages de réunions et de bugs ne peut pas dépasser 100%

## Intégration avec d'Autres Modules

- **Gestion des epics** : Les epics sélectionnés dans un sprint sont liés au module de gestion des epics
- **Statistiques** : Les données des sprints alimentent les statistiques et graphiques de vélocité
- **Roadmap** : Les sprints complétés et planifiés sont visualisés dans la roadmap
- **Calendrier** : Les jours fériés et congés sont pris en compte dans le calcul de la capacité

## Interfaces Utilisateur

### Page de Liste des Sprints

Affiche tous les sprints avec leur statut, dates et vélocité (si complétés).

### Page de Création/Édition de Sprint

Interface permettant de configurer tous les paramètres d'un sprint.

### Page de Détail du Sprint

Vue détaillée d'un sprint avec :
- Informations générales
- Capacité calculée
- Liste des epics inclus
- Métriques de performance (pour les sprints complétés)

### Page de Clôture de Sprint

Interface dédiée à la clôture d'un sprint, avec récapitulatif des données réelles et calcul de la vélocité.
