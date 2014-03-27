var express = require('express'),
    rest = require('restler'),
    fs = require('fs'),
    http = require('http'),
    https = require('https'),
    app = express(),
    credentials = {key:'', cert:''},
    config;

if (process.env.NODE_ENV === 'dev') {
  console.log('Loading DEV config');
  config = require('./config-dev');
} else {
  console.log('Loading PROD config');
  config = require('./config');
}

if (config.ssl !== false) {
  var privateKey = fs.readFileSync('./server.key', 'utf8');
  var certificate = fs.readFileSync('./server.crt', 'utf8');
  credentials.key = privateKey;
  credentials.cert = certificate;
}

app.configure(function(){
  app.use(express.bodyParser());
  app.use(express.static(__dirname + '/static'));
});

app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);

app.get('/', function(req, res) {
  res.cookie('clientid', config.github.client_id);
  res.render('index.html');
});

// Redirect uri for GitHub access 
app.get('/auth/', function(req, res) {
  res.render('auth.html');
});

// Send oauth verification code for access codez
app.post('/oauth', function(req, res) {
  console.log(req.body);
  rest.post('https://github.com/login/oauth/access_token', {
      headers: { 
        accept: 'application/json',
      },
      data: {
        client_id: config.github.client_id,
        client_secret: config.github.client_secret,
        code: req.body.verification,
        redirect_uri: req.body.redirect_uri
      }
    }).on('complete', function (data) {
      console.log('Token:' + data.access_token);
      res.cookie('access_token', data.access_token);
      res.json(data);
    });
});

// Github api redirect
app.get('/api/*', function(req, res) {
  req.url = req.url.replace(/^\/api/, '');
  console.log(req.url);
  rest.get('https://api.github.com' + req.url, {
      headers: {
        accept: req.headers.accept,
        'user-agent': req.headers['user-agent'],
        authorization: req.headers.authorization,
        'content-type': req.headers['content-type'],
        cookie: req.headers.cookie
      }
  }).on('complete', function (data) {
    res.json(data);
  });
});

app.post('/api/*', function(req, res) {
  req.url = req.url.replace(/^\/api/, '');
  console.log(req.url);
  console.log(req.headers);
  console.log(req.body);
  rest.post('https://api.github.com' + req.url, {
      headers: {
        accept: req.headers.accept,
        authorization: req.headers.authorization,
        'content-type': req.headers['content-type'],
        cookie: req.headers.cookie
      },
      data: JSON.stringify(req.body)
  }).on('complete', function (data) {
    res.json(data);
  });
});

app.patch('/api/*', function(req, res) {
  req.url = req.url.replace(/^\/api/, '');
  console.log(req.url);
  console.log(req.headers);
  console.log(req.body);
  rest.patch('https://api.github.com' + req.url, {
      headers: {
        accept: req.headers.accept,
        authorization: req.headers.authorization,
        'content-type': req.headers['content-type'],
        cookie: req.headers.cookie
      },
      data: JSON.stringify(req.body)
  }).on('complete', function (data) {
    res.json(data);
  });
});

app.del('/api/*', function(req, res) {
  req.url = req.url.replace(/^\/api/, '');
  console.log(req.url);
  console.log(req.headers);
  console.log(req.body);
  rest.del('https://api.github.com' + req.url, {headers: {
      accept: req.headers.accept,
      authorization: req.headers.authorization,
      'content-type': req.headers['content-type'],
      cookie: req.headers.cookie
  }}).on('complete', function (data) {
    res.json(data);
  });
});

if (config.ssl === true) {
  https.createServer(credentials, app).listen(config.port);
} else {
  http.createServer(app).listen(config.port);
}

console.log('Server is listening on: '+config.url);