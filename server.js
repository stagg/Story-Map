var http = require("http");
var connect = require('connect');

var app = connect()

.use(connect.logger('dev'))

.use(connect.static('home'))

.use(function(req, res){

res.setHeader("Access-Control-Allow-Origin", "http://localhost:8080");
res.end('hello world\n');

});

connect.createServer(connect.static(__dirname))
.listen(8080, function () {
	console.log('Server is listening');
});

