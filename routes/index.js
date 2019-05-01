const express = require('express'),
  router = express.Router(),
  createError = require('http-errors'),
  Containers = require('../models/container');

/* GET home page. */
router.get('/', async (req, res, next) => {
  try {
    const containers = await Containers.find({}, (err, conti) => {
      if (err) throw err;
    }).exec();

    res.render('index', { title: 'Container Index', containers });
  } catch (err) {
    next(createError(404, err));
  }
});

module.exports = router;
