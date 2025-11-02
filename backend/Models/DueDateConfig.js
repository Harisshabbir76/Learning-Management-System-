// models/DueDateConfig.js
const mongoose = require('mongoose');

const DueDateConfigSchema = new mongoose.Schema({
  dayOfMonth: {
    type: Number,
    required: true,
    min: 1,
    max: 31,
    default: 1
  },
  lastApplied: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Static method to get the current configuration
DueDateConfigSchema.statics.getConfig = function() {
  return this.findOne().then(config => {
    if (!config) {
      // Create default config if none exists
      return this.create({ dayOfMonth: 1 });
    }
    return config;
  });
};

module.exports = mongoose.model('DueDateConfig', DueDateConfigSchema);