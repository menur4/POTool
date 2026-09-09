# POTool – Extension Jira Sync (Chrome / Edge)

Synchronise les issues Jira vers POTool **sans token API**, en réutilisant votre
session Jira déjà ouverte dans le navigateur (les cookies sont envoyés
automatiquement vers `*.atlassian.net`).

## Fonctionnement

1. Vous êtes connecté(e) à Jira Cloud dans Chrome/Edge (SSO habituel).
2. L'extension appelle l'API de recherche Jira avec votre session (cookies).
3. Elle envoie les issues au backend POTool (`POST /api/jira/import-session`),
   qui les mappe en epics et les enregistre (même logique que la synchro par token).
4. En option, elle se relance automatiquement à intervalle régulier tant que le
   navigateur est ouvert.

## Installation (mode développeur)

1. Ouvrez `chrome://extensions` (ou `edge://extensions`).
2. Activez le **Mode développeur** (en haut à droite).
3. Cliquez **Charger l'extension non empaquetée** et sélectionnez le dossier
   `extension/`.
4. Épinglez l'extension, puis cliquez son icône pour ouvrir les réglages.

## Réglages

| Champ              | Exemple                              | Notes |
|--------------------|--------------------------------------|-------|
| URL Jira           | `https://monentreprise.atlassian.net`| Votre instance Cloud |
| Project key        | `PROJ`                               | Ignoré si une JQL est fournie |
| JQL (optionnel)    | `project = "PROJ" AND sprint in openSprints()` | Prioritaire sur le project key |
| Champ Story Points | `customfield_10016`                  | Voir ci-dessous |
| URL POTool         | `http://localhost:3002`              | Backend POTool |
| Synchro auto       | toutes les `30` min                  | Tourne tant que le navigateur est ouvert |

### Trouver l'id du champ Story Points

Sur votre instance, ouvrez :
`https://monentreprise.atlassian.net/rest/api/3/field`
et cherchez le champ « Story Points » / « Story point estimate ».
Son `id` ressemble à `customfield_10016`.

## Notes

- Aucun token n'est stocké : l'extension dépend uniquement de votre session Jira.
  Si la synchro échoue avec une erreur 401/403, reconnectez-vous à Jira dans un onglet.
- L'extension essaie l'endpoint moderne `/rest/api/3/search/jql` puis bascule sur
  l'historique `/rest/api/3/search` si nécessaire.
- Si votre URL POTool n'est pas `localhost:3002`, ajoutez-la dans
  `host_permissions` du `manifest.json`.
