# Gestion des Epics

## Aperçu

La gestion des epics permet d'organiser et de suivre les éléments de travail de grande envergure qui seront découpés et réalisés sur plusieurs sprints. Cette fonctionnalité est essentielle pour la planification à moyen et long terme.

## Définition d'un Epic

Dans POTool, un epic représente une fonctionnalité ou un ensemble de fonctionnalités connexes qui apportent une valeur métier significative. Chaque epic est caractérisé par :

- Un titre descriptif
- Une description détaillée
- Un nombre de story points
- Un statut d'avancement
- Un thème ou domaine fonctionnel
- Des tags pour faciliter la catégorisation
- Une priorité
- Un identifiant externe (pour les epics importés depuis Jira)

## États d'un Epic

Un epic peut se trouver dans l'un des états suivants :

1. **À faire (to-do)** : L'epic est identifié mais pas encore commencé
2. **En cours (in-progress)** : Le travail sur l'epic a commencé
3. **Terminé (done)** : L'epic est complètement réalisé
4. **Bloqué (blocked)** : Le travail sur l'epic est temporairement bloqué

## Fonctionnalités Principales

### Création et Édition Manuelle

L'application permet de créer et d'éditer manuellement des epics avec tous leurs attributs :
- Informations de base (titre, description)
- Estimation en story points
- Catégorisation (thème, tags)
- Prioritisation

### Importation depuis Excel

Une fonctionnalité clé est l'importation d'epics depuis des fichiers Excel, typiquement exportés depuis Jira :

1. L'utilisateur télécharge un fichier Excel contenant les epics
2. Le système analyse le fichier et mappe les colonnes aux attributs des epics
3. Les epics sont importés dans le système avec leurs attributs
4. Un rapport d'importation est généré, indiquant les succès et les éventuelles erreurs

Le système gère intelligemment les mises à jour incrémentales, en identifiant si un epic importé existe déjà (via son identifiant externe) pour le mettre à jour plutôt que de créer un doublon.

### Catégorisation et Organisation

POTool offre des outils puissants pour organiser les epics :

- **Thèmes** : Regroupement de haut niveau (ex: "Sécurité", "Performance", "UX")
- **Tags** : Étiquettes flexibles pour une catégorisation multi-dimensionnelle
- **Filtres** : Recherche avancée par tous les attributs des epics
- **Tri** : Organisation des epics par priorité, taille, statut, etc.

### Suivi de l'Avancement

Le système permet de suivre l'avancement des epics à travers les sprints :

- Visualisation des sprints dans lesquels un epic a été inclus
- Historique des modifications de statut
- Progression des story points réalisés vs. estimés

## Intégration avec les Sprints

La gestion des epics est étroitement liée à la gestion des sprints :

1. Lors de la planification d'un sprint, l'utilisateur sélectionne les epics à inclure
2. À la clôture d'un sprint, le statut des epics est automatiquement mis à jour
3. Un epic peut être réparti sur plusieurs sprints jusqu'à sa complétion

## Règles de Gestion

- Un epic doit avoir un titre unique
- Les story points doivent être des nombres positifs
- Un epic ne peut pas être marqué comme terminé s'il n'a pas été inclus dans au moins un sprint
- La priorité doit être l'une des valeurs prédéfinies : "low", "medium", "high", "critical"

## Interfaces Utilisateur

### Page de Liste des Epics

Affiche tous les epics avec filtres et options de tri avancés.

### Page de Détail d'un Epic

Vue détaillée d'un epic avec :
- Toutes ses caractéristiques
- Historique des modifications
- Sprints associés
- Progression

### Interface d'Importation

Page dédiée à l'importation d'epics depuis Excel, avec :
- Téléchargement de fichier
- Mappage des colonnes
- Prévisualisation des données
- Rapport d'importation

### Interface de Catégorisation

Outil visuel permettant de :
- Assigner des thèmes et tags en masse
- Organiser les epics par glisser-déposer
- Visualiser les regroupements d'epics
