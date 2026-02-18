const fs = require('fs');
const path = require('path');
const videos = require('../src/data/videos.json');

const nonprofits = videos.filter(v => v.category === 'Nonprofits');
console.log(JSON.stringify(nonprofits, null, 2));
