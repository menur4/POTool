/**
 * Script de correction des Epics en base de données.
 *
 * 1. Crée les Epics manquants (parentKey référencés sans item correspondant)
 * 2. Corrige le issueType des items qui sont des parents mais pas typés Epic
 * 3. Assigne un sprint aux Epics qui n'en ont pas (basé sur le sprint le plus fréquent de leurs enfants)
 *
 * Usage: node src/scripts/fixEpicTypes.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Epic = require('../models/Epic');
const { connectDB } = require('../config/database');

async function fixEpicTypes() {
  const connected = await connectDB();
  if (!connected) {
    console.error('Impossible de se connecter à MongoDB');
    process.exit(1);
  }

  console.log('--- Diagnostic et correction des Epics ---\n');

  // 1. État initial
  const typeCounts = await Epic.aggregate([
    { $group: { _id: '$issueType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log('État initial par issueType:');
  typeCounts.forEach(t => console.log(`  ${t._id || '(null)'}: ${t.count}`));

  // 2. Trouver tous les parentKey référencés
  const allParentKeys = await Epic.distinct('parentKey', { parentKey: { $ne: null } });
  console.log(`\nClés parentes référencées: ${allParentKeys.length}`);

  // 3. Identifier les parentKeys sans item en base → créer les Epics manquants
  const existingKeysArr = await Epic.distinct('key');
  const existingKeys = new Set(existingKeysArr);
  const missingKeys = allParentKeys.filter(k => !existingKeys.has(k));

  if (missingKeys.length > 0) {
    console.log(`\n${missingKeys.length} Epic(s) manquant(s) à créer:`);

    for (const parentKey of missingKeys) {
      // Récupérer les infos depuis les enfants
      const children = await Epic.find({ parentKey }).select('parentSummary sprints').limit(10);
      const title = children.find(c => c.parentSummary)?.parentSummary || `Epic ${parentKey}`;

      // Collecter tous les sprints des enfants
      const sprintSet = new Set();
      children.forEach(c => {
        (c.sprints || []).forEach(s => sprintSet.add(s.toString()));
      });
      const sprintIds = [...sprintSet];

      try {
        await Epic.create({
          key: parentKey,
          title,
          description: '',
          storyPoints: 0,
          status: 'backlog',
          priority: 'medium',
          category: 'feature',
          issueType: 'Epic',
          tags: [],
          sprints: sprintIds,
          importedAt: new Date(),
          importSource: 'manual'
        });
        console.log(`  + ${parentKey} → "${title}" (sprints: ${sprintIds.length})`);
      } catch (err) {
        console.log(`  ! ${parentKey} → Erreur: ${err.message}`);
      }
    }
  } else {
    console.log('\nAucun Epic manquant.');
  }

  // 4. Corriger le issueType des items parents pas encore typés Epic
  const mistyped = await Epic.find({
    key: { $in: allParentKeys },
    issueType: { $ne: 'Epic' }
  });

  if (mistyped.length > 0) {
    console.log(`\n${mistyped.length} item(s) parent(s) à promouvoir en Epic:`);
    for (const item of mistyped) {
      console.log(`  ${item.key} (${item.issueType || 'null'}) → Epic`);
    }
    await Epic.updateMany(
      { key: { $in: allParentKeys }, issueType: { $ne: 'Epic' } },
      { $set: { issueType: 'Epic' } }
    );
  }

  // 5. Assigner des sprints aux Epics existants qui n'en ont pas
  const epicsWithoutSprint = await Epic.find({
    issueType: 'Epic',
    $or: [{ sprints: { $exists: false } }, { sprints: { $size: 0 } }]
  }).select('key');

  if (epicsWithoutSprint.length > 0) {
    console.log(`\n${epicsWithoutSprint.length} Epic(s) sans sprint — attribution via les enfants:`);

    for (const epic of epicsWithoutSprint) {
      const children = await Epic.find({
        parentKey: epic.key,
        'sprints.0': { $exists: true }
      }).select('sprints').limit(20);

      const sprintSet = new Set();
      children.forEach(c => {
        (c.sprints || []).forEach(s => sprintSet.add(s.toString()));
      });

      if (sprintSet.size > 0) {
        const sprintIds = [...sprintSet];
        await Epic.updateOne({ _id: epic._id }, { $set: { sprints: sprintIds } });
        console.log(`  ${epic.key} → ${sprintIds.length} sprint(s)`);
      } else {
        console.log(`  ${epic.key} → aucun enfant avec sprint`);
      }
    }
  }

  // 6. Résumé final
  console.log('\n--- Résumé final ---');
  const finalCounts = await Epic.aggregate([
    { $group: { _id: '$issueType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  finalCounts.forEach(t => console.log(`  ${t._id || '(null)'}: ${t.count}`));

  const totalEpics = finalCounts.find(t => t._id === 'Epic');
  console.log(`\nTotal Epics: ${totalEpics?.count || 0}`);
  console.log('Total items: ' + finalCounts.reduce((sum, t) => sum + t.count, 0));

  await mongoose.disconnect();
  console.log('\nTerminé.');
}

fixEpicTypes().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
