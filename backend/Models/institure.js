const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const schoolSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true,
    maxlength: 100
  },
  displayName: { 
    type: String, 
    required: true,
    maxlength: 150
  },
  address: { 
    type: String, 
    required: true,
    maxlength: 500
  },
  phone: { 
    type: String, 
    required: true,
    match: [/^[+]?[0-9\s\-()]{10,20}$/, 'Please enter a valid phone number']
  },
  email: { 
    type: String, 
    required: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email']
  },
  website: {
    type: String,
    match: [/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/, 'Please enter a valid website URL']
  },
  logoUrl: String,
  themeColor: {
    type: String,
    default: '#3b82f6',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please enter a valid hex color code']
  },
  description: {
    type: String,
    maxlength: 1000
  },
  establishedYear: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear()
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  courses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }]
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Virtual for formatted established year
schoolSchema.virtual('establishedYearFormatted').get(function() {
  return this.establishedYear ? `Est. ${this.establishedYear}` : '';
});

// Index for better performance
schoolSchema.index({ name: 1 });
schoolSchema.index({ email: 1 });
schoolSchema.index({ createdBy: 1 });
schoolSchema.index({ createdAt: -1 });

// Add pagination plugin
schoolSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('School', schoolSchema);