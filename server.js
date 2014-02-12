var express = require('express'),
    rest = require('restler'),
    app = express(),
    config;

if (process.env.NODE_ENV === 'dev') {
  console.log('Loading DEV config');
  config = require('./config-dev');
} else {
  console.log('Loading PROD config');
  config = require('./config');
}

app.configure(function(){
  app.use(express.bodyParser());
  app.use(express.static(__dirname + '/'));
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
      console.log(data);
      res.json(data);
    });
});

// Github api redirect
app.all('/api/*', function(req, res) {
  req.url = req.url.replace(/^\/api/, '');
  console.log(req.url);
  rest.get('https://api.github.com' + req.url, {
      headers: { 
        accept: req.headers.accept,
        'user-agent': req.headers['user-agent'],
        authorization: req.headers.authorization,
        'content-type': req.headers['content-type'],
        cookie: req.headers.cookie 
      },
      data: req.body,
      method: req.method
    }).on('complete', function (data) {
      res.json(data);
    });
});


app.listen(config.port);

console.log('Server is listening on: '+config.url);