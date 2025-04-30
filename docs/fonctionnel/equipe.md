# Gestion de l'équipe

## Présentation

La fonctionnalité de gestion d'équipe permet aux utilisateurs de POTool de gérer les membres de leur équipe de développement. Cette fonctionnalité est particulièrement utile pour :

- Maintenir une liste à jour des membres de l'équipe
- Enregistrer le Taux Journalier Moyen (TJM) de chaque membre
- Calculer la valeur financière des user stories en fonction du temps estimé et du TJM des membres de l'équipe

## Fonctionnalités

### Liste des membres de l'équipe

La page principale affiche un tableau de tous les membres de l'équipe avec les informations suivantes :
- Nom et prénom
- Email
- Rôle dans l'équipe
- Taux Journalier Moyen (TJM)
- Statut (actif/inactif)

### Ajout d'un membre

Les administrateurs peuvent ajouter de nouveaux membres à l'équipe en fournissant :
- Prénom
- Nom
- Email
- Rôle (développeur, designer, testeur, product owner, scrum master, autre)
- Taux Journalier Moyen (TJM) en euros

### Modification d'un membre

Les administrateurs peuvent modifier les informations d'un membre existant, y compris son TJM.

### Activation/Désactivation d'un membre

Les administrateurs peuvent activer ou désactiver un membre de l'équipe sans le supprimer définitivement. Cela est utile lorsqu'un membre quitte temporairement l'équipe ou n'est plus actif sur le projet.

### Suppression d'un membre

Les administrateurs peuvent supprimer définitivement un membre de l'équipe.

## Calcul de la valeur financière des user stories

Le TJM enregistré pour chaque membre de l'équipe sera utilisé pour calculer la valeur financière des user stories. Cette fonctionnalité sera intégrée ultérieurement dans le module de gestion des sprints et des user stories.

La formule de calcul sera la suivante :
```
Valeur financière = Temps estimé (en jours) × TJM moyen de l'équipe
```

Où le TJM moyen de l'équipe est calculé comme la moyenne des TJM des membres actifs de l'équipe.

## Accès et permissions

- Les administrateurs ont un accès complet à toutes les fonctionnalités de gestion d'équipe
- Les utilisateurs standard peuvent voir la liste des membres de l'équipe mais ne peuvent pas les modifier
- Seuls les administrateurs peuvent voir et modifier les informations de TJM

## Intégration avec d'autres modules

La fonctionnalité de gestion d'équipe est intégrée avec :
- Le système d'authentification pour gérer les permissions
- Le module de gestion des sprints (à venir) pour calculer la valeur financière des user stories
