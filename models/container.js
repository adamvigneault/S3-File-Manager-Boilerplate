const Mongoose = require('mongoose'),
  FileHandler = require('../local_modules/fileHandler'),
  containerSchema = new Mongoose.Schema({
    name: String,
    files: [{
      bucket: String,
      key: String,
      name: String,
      uuid: String,
      size: Number
    }]
  });

containerSchema.virtual('path').get(function getPath() {
  return `/container/${this.id}`;
});

containerSchema.post('remove', function postRemove() {
  const cdn = new FileHandler({ parent: this });

  // Cleanup image assets
  files.del(this.files.map(file => file.key));
});

// Register model
Container = Mongoose.model('Container', containerSchema);
module.exports = Container;
