const aws = require('aws-sdk'),
  https = require('https'),
  archiver = require('archiver'),
  fs = require('fs'),
  path = require('path'),
  mime = require('mime');

class FileHandler {
  constructor(options) {
    const { endpoint, accessKeyId, secretAccessKey, region, uniqueId, bucket, tempDir } = options;

    this.uniqueId = uniqueId || null;
    this.bucket = bucket || null;
    this.tempDir = tempDir || path.join(__dirname, '../temp');
    this.S3 = new aws.S3({
      endpoint,
      accessKeyId,
      secretAccessKey,
      region
    })
  }
  add(files) {
    if (!this.bucket) throw 'No bucket configured';

    // "files" argument derived from a Multer object.
    const uploads = files.map((file, i) => this.S3.putObject({
      Bucket: this.bucket,
      Key: `${this.uniqueId}/${file.originalname}`,
      Body: file.buffer
    }).promise());
    
    if (files.length <=0 ) throw 'No file(s) selected';

    return uploads;
  }
  del(files) {
    if (!this.bucket) throw 'No bucket configured';

    const deleteKeys = files.map(file => ({
        Key: file.key
      })),
      s3Params = {
        Bucket: this.bucket,
        Delete: {
          Objects: deleteKeys
        }
      };
  
    return this.S3.deleteObjects(s3Params).promise();
  }
  getPath(file) {
    return this.S3.getSignedUrl('getObject', {
      Bucket: file.bucket,
      Key: file.key,
      Expires: (60 * 60 * 24) // One day
    });
  }
  putPath(files) {
    if (!this.bucket) throw 'No bucket configured';

    return files.map(file => this.S3.getSignedUrl('putObject', {
      Bucket: this.bucket,
      Key: `${this.uniqueId}/${file.originalname}`,
      ContentType: mime.lookup(file.originalname),
      Body: '',
      Expires: (60 * 60 * 24) // One day
    }));
  }
  getZip(files) {
    return new Promise(async (resolve, reject) => {
      // Bulk download
      const tempFile = `${this.uniqueId}.zip`,
        output = fs.createWriteStream(path.join(this.tempDir, tempFile)),
        archive = archiver('zip', { zlib: 9 });
      let filePath, fileStreams;

      archive.pipe(output);
      
      output.on('close', () => {
        // Archive has finished writing to disk, return it
        resolve(path.join(this.tempDir, tempFile));
      });
      archive.on('error', reject)
      
      filePath = files.map(f => ({ key: f.key, path: this.getPath(f) }));
      // Fetch all selected files from remote
      fileStreams = await Promise.all(filePath.map(file => new Promise((resolve, reject) => {
        https.get(file.path, f => resolve({ stream: f, name: file.key.split('/').pop() }));
      })));

      // All files buffered, append them to the archive
      fileStreams.forEach(s => archive.append(s.stream, { name: s.name }));

      archive.finalize();
    });
  }
  set uniqueId(uid) {
    this._unique = uid;
  }
  get uniqueId() {
    return this._unique;
  }
  set bucket(b) {
    this._bucket = b;
  }
  get bucket() {
    return this._bucket;
  }
  set tempDir(dir) {
    this._tempDir = dir;
  }
  get tempDir() {
    return this._tempDir;
  }
}

module.exports = FileHandler;
