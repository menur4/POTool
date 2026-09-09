/**
 * Migration one-shot : propage les entityLabels des épics parents
 * vers leurs user stories enfants (parentKey défini, entityLabels vide).
 *
 * Usage: node src/scripts/propagateEntityLabels.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Epic = require('../models/Epic');
const { connectDB } = require('../config/database');

async function propagateEntityLabels() {
  const connected = await connectDB();
  if (!connected) {
    console.error('Impossible de se connecter à la base de données');
    process.exit(1);
  }

  console.log('Recherche des user stories sans entityLabels et avec un parentKey...');

  // Tous les enfants sans entityLabels
  const children = await Epic.find({
    parentKey: { $exists: true, $ne: null, $ne: '' },
    $or: [
      { entityLabels: { $exists: false } },
      { entityLabels: { $size: 0 } }
    ]
  }).select('_id key parentKey');

  console.log(`  ${children.length} user stories sans entityLabels trouvées`);

  if (children.length === 0) {
    console.log('Rien à migrer.');
    await mongoose.disconnect();
    return;
  }

  // Collecter les parentKeys uniques
  const uniqueParentKeys = [...new Set(children.map(c => c.parentKey))];
  console.log(`  ${uniqueParentKeys.length} épics parents distincts à vérifier`);

  // Récupérer les parents qui ont des entityLabels
  const parentEpics = await Epic.find({
    key: { $in: uniqueParentKeys },
    'entityLabels.0': { $exists: true }
  }).select('key entityLabels');

  console.log(`  ${parentEpics.length} parents avec des entityLabels trouvés`);

  if (parentEpics.length === 0) {
    console.log('Aucun parent avec des entityLabels — rien à propager.');
    await mongoose.disconnect();
    return;
  }

  const parentEntityMap = {};
  parentEpics.forEach(p => { parentEntityMap[p.key] = p.entityLabels; });

  // Filtrer les enfants dont le parent a des labels
  const toUpdate = children.filter(c => parentEntityMap[c.parentKey]);
  console.log(`\nPropagation vers ${toUpdate.length} user stories :`);

  let updated = 0;
  for (const child of toUpdate) {
    const labels = parentEntityMap[child.parentKey];
    await Epic.findByIdAndUpdate(child._id, { entityLabels: labels });
    console.log(`  ✓ ${child.key} ← [${labels.map(l => l.name).join(', ')}]`);
    updated++;
  }

  console.log(`\n${updated} user stories mises à jour.`);
  await mongoose.disconnect();
}

propagateEntityLabels().catch(err => {
  console.error(err);
  process.exit(1);
});
