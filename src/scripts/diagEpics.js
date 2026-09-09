const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const Epic = require('../models/Epic');
const Sprint = require('../models/Sprint');
const { connectDB } = require('../config/database');

(async () => {
  await connectDB();

  // 1. Les Epics et leurs sprints
  const epics = await Epic.find({ issueType: 'Epic' }).populate('sprints', 'name').select('key title sprints');
  console.log('=== Les ' + epics.length + ' Epics ===');
  epics.forEach(e => {
    const sprintNames = (e.sprints || []).map(s => s.name || s).join(', ') || '(aucun)';
    console.log('  ' + e.key + ' | sprints: ' + sprintNames + ' | ' + e.title);
  });

  // 2. parentKey sans item en base
  const allParentKeys = await Epic.distinct('parentKey', { parentKey: { $ne: null } });
  const existingKeysArr = await Epic.distinct('key');
  const existingKeys = new Set(existingKeysArr);
  const missing = allParentKeys.filter(k => !existingKeys.has(k));
  console.log('\n=== ParentKeys sans item en base (' + missing.length + ') ===');
  missing.forEach(k => console.log('  ' + k));

  // 3. Items par sprint (unwind sprints array)
  const sprintStats = await Epic.aggregate([
    { $unwind: { path: '$sprints', preserveNullAndEmptyArrays: true } },
    { $group: { _id: '$sprints', count: { $sum: 1 }, epics: { $sum: { $cond: [{ $eq: ['$issueType', 'Epic'] }, 1, 0] } } } }
  ]);
  const sprintIds = sprintStats.filter(s => s._id).map(s => s._id);
  const sprintMap = {};
  if (sprintIds.length) {
    const sprints = await Sprint.find({ _id: { $in: sprintIds } }).select('name');
    sprints.forEach(s => { sprintMap[s._id.toString()] = s.name; });
  }
  console.log('\n=== Items par sprint ===');
  sprintStats.forEach(s => {
    const name = s._id ? (sprintMap[s._id.toString()] || String(s._id)) : '(sans sprint)';
    console.log('  ' + name + ': ' + s.count + ' items (' + s.epics + ' Epics)');
  });

  // 4. Epics multi-sprint
  const multiSprint = await Epic.find({ 'sprints.1': { $exists: true } }).populate('sprints', 'name').select('key title sprints');
  console.log('\n=== Epics multi-sprint (' + multiSprint.length + ') ===');
  multiSprint.forEach(e => {
    const sprintNames = e.sprints.map(s => s.name || s).join(', ');
    console.log('  ' + e.key + ' | ' + sprintNames + ' | ' + e.title);
  });

  // 5. Combien de parentKeys sont en fait des Epics vs d'autres items
  const parentItemsInDb = await Epic.find({ key: { $in: allParentKeys } }).select('key issueType');
  console.log('\n=== ParentKeys existants en base (' + parentItemsInDb.length + '/' + allParentKeys.length + ') ===');
  parentItemsInDb.forEach(p => console.log('  ' + p.key + ' → ' + p.issueType));

  await mongoose.disconnect();
})();
