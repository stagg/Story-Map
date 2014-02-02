var config = {}

config.github = {};

config.port = 8080;
config.url = 'http://localhost' + (config.port ? ':'+config.port : '');

config.github.client_id = '';
config.github.client_secret = '';

module.exports = config;