var config = {}

config.github = {};

config.ssl = false;
config.port = 8080;
config.url = (config.ssl ? 'https://' : 'http://') + 'localhost' + (config.port ? ':'+config.port : '');

config.github.client_id = '';
config.github.client_secret = '';

module.exports = config;