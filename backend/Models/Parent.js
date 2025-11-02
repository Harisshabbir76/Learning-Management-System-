// models/Parent.js
const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }]
});

module.exports = mongoose.models.Parent || mongoose.model('Parent', parentSchema);
