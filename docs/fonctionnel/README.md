# Documentation Fonctionnelle de POTool

Cette section contient la documentation fonctionnelle détaillée de l'application POTool. Elle décrit les fonctionnalités, les processus métier et les règles de gestion implémentées dans l'application.

## Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Gestion des utilisateurs](./utilisateurs.md)
3. [Gestion des sprints](./sprints.md)
4. [Gestion des epics](./epics.md)
5. [Statistiques et reporting](./statistiques.md)
6. [Roadmap](./roadmap.md)
7. [Internationalisation](./internationalisation.md)
8. [Gestion du calendrier](./calendrier.md)
9. [Importation et exportation](./import-export.md)

## Vue d'ensemble

POTool est une application web permettant le suivi des sprints de développement, la gestion de la vélocité de l'équipe, et la visualisation de statistiques et d'une roadmap basée sur les données des sprints.

### Objectifs de l'application

- Faciliter la planification et le suivi des sprints
- Automatiser le calcul de la vélocité de l'équipe
- Fournir des visualisations claires de la performance des sprints
- Permettre la création d'une roadmap basée sur les données réelles
- Offrir une interface multilingue (français, anglais, arabe)

### Principaux flux utilisateurs

1. **Configuration d'un nouveau sprint**
   - Création d'un sprint avec dates et équipe
   - Configuration des contraintes (congés, réunions, bugs)
   - Calcul automatique de la capacité
   - Sélection des epics à embarquer
   - Validation du sprint

2. **Clôture de sprint**
   - Mise à jour des données réelles
   - Sélection des epics effectivement livrés
   - Recalcul de la vélocité
   - Validation de la clôture

3. **Gestion des epics**
   - Importation depuis Excel (exports Jira)
   - Catégorisation par thèmes et étiquettes
   - Suivi de l'avancement

4. **Analyse des performances**
   - Visualisation de la vélocité
   - Analyse des story points par catégorie
   - Exportation des données

### Public cible

- Chefs de projet
- Scrum Masters
- Product Owners
- Équipes de développement

## État actuel du développement

Cette documentation évoluera au fur et à mesure du développement. Actuellement, nous avons défini les spécifications et mis en place l'architecture de test pour le développement piloté par les tests (TDD).

Les sections suivantes seront complétées au fur et à mesure de l'implémentation des fonctionnalités correspondantes.
