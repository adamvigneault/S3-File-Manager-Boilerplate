const Mongoose = require('mongoose'),
  analyticSchema = new Mongoose.Schema({
    category: {
      type: String,
      enum: [
        'misc',
        'download'
      ],
      required: true
    },
    attrs: Array,
    reference: Mongoose.Schema.ObjectId
  });

// Register model
Analytic = Mongoose.model('Analytic', analyticSchema);
module.exports = Analytic;
