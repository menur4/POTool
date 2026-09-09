/**
 * Migration : champ sprint (ObjectId) → sprints (tableau d'ObjectId)
 *
 * Usage : node src/scripts/migrateSprintToSprints.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connexion MongoDB OK');

  const db = mongoose.connection.db;
  const collection = db.collection('epics');

  // 1. Convertir sprint → sprints pour les epics qui ont un sprint
  const withSprint = await collection.updateMany(
    { sprint: { $exists: true, $ne: null } },
    [{ $set: { sprints: { $cond: { if: { $isArray: '$sprint' }, then: '$sprint', else: ['$sprint'] } } } }]
  );
  console.log(`${withSprint.modifiedCount} epics : sprint → sprints[]`);

  // 2. Supprimer l'ancien champ sprint
  const unset = await collection.updateMany(
    { sprint: { $exists: true } },
    { $unset: { sprint: '' } }
  );
  console.log(`${unset.modifiedCount} epics : ancien champ sprint supprimé`);

  // 3. Initialiser sprints = [] pour les epics sans sprints
  const withoutSprints = await collection.updateMany(
    { sprints: { $exists: false } },
    { $set: { sprints: [] } }
  );
  console.log(`${withoutSprints.modifiedCount} epics : sprints initialisé à []`);

  // 4. Vérification
  const total = await collection.countDocuments();
  const withSprintsField = await collection.countDocuments({ sprints: { $exists: true } });
  const withOldField = await collection.countDocuments({ sprint: { $exists: true } });
  const withMultiple = await collection.countDocuments({ 'sprints.1': { $exists: true } });

  console.log('\n--- Vérification ---');
  console.log(`Total epics : ${total}`);
  console.log(`Avec champ sprints : ${withSprintsField}`);
  console.log(`Avec ancien champ sprint : ${withOldField} (devrait être 0)`);
  console.log(`Avec plusieurs sprints : ${withMultiple}`);

  // Afficher quelques exemples
  const examples = await collection.find({}).limit(5).project({ key: 1, title: 1, sprints: 1 }).toArray();
  console.log('\nExemples :');
  examples.forEach(e => {
    console.log(`  ${e.key} : ${e.sprints.length} sprint(s)`);
  });

  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
