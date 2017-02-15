//Test server script for Node.js
"use strict";
//modules
var http = require("http"),
  url = require("url"),
  path = require("path"),
  fs = require("fs"),
  port = process.argv[2] || 8080;
//options
var LOOK_FOR_INDEX = true;	//if url is a dir, try to load index.html in this dir

http.createServer(function (request, response) {

  var uri = url.parse(request.url).pathname;
  var filename = path.join(process.cwd(), uri);
  var file = uri.toString().split('/').pop();

  fs.exists(filename, function (exists) {
    if (!exists) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.write("404 Not Found\n");
      response.end();
      return;
    }

    if (fs.statSync(filename).isDirectory()) {
      if (LOOK_FOR_INDEX) {
        filename += '/index.html';
      } else {
        //TODO
      }

    }

    fs.readFile(filename, "binary", function (err, file) {
      if (err) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        response.write(err + "\n");
        response.end();
        return;
      }

      response.writeHead(200);
      response.write(file, "binary");
      response.end();
    });
  });
}).listen(parseInt(port, 10));

console.log("Static file server running at\n  => http://localhost:" + port + "/\nCTRL + C to shutdown");