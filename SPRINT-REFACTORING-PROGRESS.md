# Refonte du Cycle de Vie des Sprints — Suivi d'avancement

## Phase 1 : Backend — Modèle Holiday + Renommage support → TNR

| Tâche | Fichier | Statut |
|-------|---------|--------|
| 1A. Modèle Holiday | `src/models/Holiday.js` | ✅ Terminé |
| 1B. Service Holiday | `src/services/holiday.service.js` | ✅ Terminé |
| 1C. Contrôleur Holiday | `src/controllers/holiday.controller.js` | ✅ Terminé |
| 1C. Routes Holiday | `src/routes/holiday.routes.js` | ✅ Terminé |
| 1C. Montage routes dans app.js | `src/app.js` | ✅ Terminé |
| 1D. Renommer support→TNR + champs clôture | `src/models/Sprint.js` | ✅ Terminé |
| 1E. Renommer support→TNR dans capacity service | `src/services/capacity.service.js` | ✅ Terminé |

## Phase 2 : Backend — Clôture de sprint enrichie

| Tâche | Fichier | Statut |
|-------|---------|--------|
| 2A. Endpoint delivered-sp | `src/controllers/sprint.controller.js` | ✅ Terminé |
| 2A. Route delivered-sp | `src/routes/sprint.routes.js` | ✅ Terminé |
| 2B. Réécrire closeSprint | `src/controllers/sprint.controller.js` | ✅ Terminé |
| 2C. Holidays dans calculateCapacity | `src/controllers/sprint.controller.js` | ✅ Terminé |

## Phase 3 : Frontend — Fondations (services + i18n + renommage)

| Tâche | Fichier | Statut |
|-------|---------|--------|
| 3A. Service Holiday frontend | `client/src/services/holidayService.js` | ✅ Terminé |
| 3B. getDeliveredStoryPoints dans sprintService | `client/src/services/sprintService.js` | ✅ Terminé |
| 3C. Renommer support→TNR dans SprintFormModal | `client/src/components/sprint/SprintFormModal.js` | ✅ Terminé |
| 3C. Renommer support→TNR dans CapacityPreviewCard | `client/src/components/sprint/CapacityPreviewCard.js` | ✅ Terminé |
| 3C. Renommer CSS constraint dot | `client/src/components/sprint/CapacityPreviewCard.css` | ✅ Terminé |
| 3D. Clés i18n FR (closeSprint, holidays, vélocité) | `client/src/locales/fr.json` | ✅ Terminé |
| 3D. Clés i18n EN (closeSprint, holidays, vélocité) | `client/src/locales/en.json` | ✅ Terminé |

## Phase 4 : Frontend — CloseSprintModal

| Tâche | Fichier | Statut |
|-------|---------|--------|
| 4A. Composant CloseSprintModal (4 onglets) | `client/src/components/sprint/CloseSprintModal.js` | ✅ Terminé |
| 4A. CSS CloseSprintModal | `client/src/components/sprint/CloseSprintModal.css` | ✅ Terminé |
| 4C. Export dans index.js | `client/src/components/sprint/index.js` | ✅ Terminé |
| 4B. Intégration dans Sprints.js | `client/src/pages/Sprints.js` | ✅ Terminé |

## Phase 5 : Frontend — Panier + Holidays dans SprintFormModal

| Tâche | Fichier | Statut |
|-------|---------|--------|
| 5A. Panier recommandé (onglet Résumé) | `client/src/components/sprint/SprintFormModal.js` | ✅ Terminé |
| 5B. Jours fériés (onglet Info) | `client/src/components/sprint/SprintFormModal.js` | ✅ Terminé |
| 5C. CSS basket + holidays | `client/src/components/sprint/SprintFormModal.css` | ✅ Terminé |

## Phase 6 : Page Calendrier (sprints + jours fériés)

| Tâche | Fichier | Statut |
|-------|---------|--------|
| 6A. Page Calendar (timeline sprints + holidays + gestion) | `client/src/pages/Calendar.js` | ✅ Terminé |
| 6A. CSS Calendar | `client/src/styles/Calendar.css` | ✅ Terminé |
| 6B. Route /calendar dans App.js | `client/src/App.js` | ✅ Terminé |
| 6B. Lien Calendrier dans Navbar | `client/src/components/Navbar.js` | ✅ Terminé |
| 6C. Clés i18n calendar FR/EN | `client/src/locales/fr.json`, `en.json` | ✅ Terminé |

> **Note** : La page Holidays séparée a été remplacée par la page Calendar qui combine la visualisation des sprints (timeline + cartes détaillées avec jours fériés associés) et la gestion des jours fériés (pré-remplissage, ajout, suppression).

---

**Légende** : ✅ Terminé | ⏳ En cours | ⬜ À faire

**Toutes les phases sont terminées !**
