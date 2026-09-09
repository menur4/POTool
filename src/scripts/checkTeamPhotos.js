const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  require('../models/TeamMember');
  const Sprint = require('../models/Sprint');
  const sprint = await Sprint.findOne({ status: 'active' })
    .populate('team.member', 'firstName lastName email role photo');

  if (!sprint) {
    console.log('No active sprint');
    process.exit(0);
  }

  console.log('Sprint:', sprint.name);
  console.log('Team members:');
  sprint.team.forEach(tm => {
    const m = tm.member;
    if (m) {
      console.log(`  ${m.firstName} ${m.lastName} | photo: ${m.photo || '(none)'}`);
    }
  });
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
