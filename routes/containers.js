const express = require('express'),
  router = express.Router(),
  bodyParser = require('body-parser'),
  multer = require('multer')(),
  fs = require('fs'),
  createError = require('http-errors'),
  Containers = require('../models/container'),
  Analytics = require('../models/analytic'),
  FileHandler = require('../local_modules/fileHandler'),
  fh = new FileHandler({
    bucket: process.env.CDN_BUCKET,
    endpoint: `https://${process.env.CDN_ROUTE}`,
    accessKeyId: process.env.CDN_ID,
    secretAccessKey: process.env.CDN_SECRET,
    region: process.env.CDN_REGION,
    tempDir: process.env.TEMP_DIR
  });

router.route('/new')
  .get((req, res, next) => {
    res.render('new', { title: 'New Container' });
  })
  .post(
    bodyParser.urlencoded({extended: true }),
    async (req, res, next) => {
      try {
        const { name } = req.body,
          containerDoc = new Containers({ name: req.sanitize(name) }),
          newContainer = await containerDoc.save({ upsert: true, new: true });
        
        res.format({
          html: () => { res.redirect(newContainer.path) },
          json: () => { res.json(newContainer) }
        });
      } catch (err) {
        next(createError(500, err));
      }
    }
  );
router.route('/:id/files/:fileId?')
  .put(async (req, res, next) => { // CLIENT SIDE UPLOAD
    // make a call from the upload form
    // respond with a signed PUT url
  })
  .post(
    multer.array('files'),
    async (req, res, next) => {
    
    try {
      const container = await Containers.findById(req.params.id);
      let status, fileRefs;

      fh.uniqueId = container.id;

      // Upload files to the CDN
      status = await Promise.all(fh.add(req.files));
      fileRefs = status.map((upload, i) => ({
        bucket: process.env.CDN_BUCKET,
        key: upload.$response.request.params.Key,
        uuid: upload.ETag.slice(1, -1),
        size: req.files[i].size
      }));

      if (!status) throw 'Upload error';

      // Update the parent record in mongo
      await container.update({ $push: { files: { $each: fileRefs } } }).exec();

      // Respond positive
      res.format({
        html: () => {
          res.redirect(container.path);
        },
        json: () => {
          res.json({
            success: true,
            message: 'File(s) uploaded successfully.'
          });
        }
      });
    } catch (err) {
      // Repond negative, something went wrong
      res.json({
        success: false,
        message: err.message
      }) 
    }
  })
  .get(async (req, res, next) => {
    try {
      const container = await Containers.findById(req.params.id).exec();
      let fileInfo, filePath;

      fh.uniqueId = container.id;

      if (req.params.fileId === "all") {
        filePath = await fh.getZip(container.files);

        // Store some analytics
        new Analytics({
          category: 'download',
          reference: container,
          attrs: [
            'style=bulk' 
          ]
        }).save();

        // Serve the zip and clean up
        res.download(filePath, `${container.name}.zip`, (err) => {
          if (err) throw err;
          fs.unlink(filePath, (err) => {});
        });
      } else {
        // Single download
        fileInfo = container.files.id(req.params.fileId);
        filePath = fh.getPath(fileInfo);

        // Store some analytics
        new Analytics({
          category: 'download',
          reference: container,
          attrs: [
            `file=${fileInfo.key}`,
            'style=single' 
          ]
        }).save();

        // redirect the response to signed URL
        res.redirect(filePath);
      }
    } catch (err) {
      next(err.message);
    }
  })
  .delete(
    async (req, res, next) => {
    try {
      const container = await Containers.findById(req.params.id);
      let deleteQueue, status;

      fh.uniqueId = container.id;
      
      if (req.params.fileId) {
        deleteQueue = [ req.params.fileId ];
      } else if (req.body.files === 'all') {
        deleteQueue = container.files.map((f) => f.id)
      } else {
        req.body.files.split(',');
      }
      
      status = await fh.del(deleteQueue.map((fileId) => container.files.id(fileId)));

      if (!status) throw 'Delete failed';

      await container.update({ $pull: { files: { _id: { $in: deleteQueue } } } }).exec();

      // Respond positive
      res.json({
        success: true,
        message: 'File(s) deleted successfully.'
      });
    } catch (err) {
      // Respond negative, something went wrong
      res.json({
        success: false,
        message: err.message
      }); 
    }
  })
  .patch(async (req, res, next) => {
    // Rename a file??
  });
router.route('/:id')
  .get(async (req, res, next) => {
    try {
      const container = await Containers.findById(req.params.id).exec();

      // Add dynamic file paths
      container.files.forEach((file, i) => {
        file.path = `${req.originalUrl}/files/${file.id}`;
        file.name = file.key.split('/').pop();
      });

      res.format({
        html: () => {
          res.render('container', {
            title: container.name,
            container
          });
        },
        json: () => {
          res.json(container);
        }
      });
    } catch (err) {
      next(createError('404'));
    }
  });

module.exports = router;
