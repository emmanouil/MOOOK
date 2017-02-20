//Test server script for Node.js
"use strict";

//modules
var http = require("http"),
  url = require("url"),
  path = require("path"),
  fs = require("fs"),
  port = process.argv[2] || 8080;
var tools = require('./tools.js');

//options
var LOOK_FOR_INDEX = true;	//if url is a dir, try to load index.html in this dir

//variables
var pl_parsed = false;
var plArray = [];   //playlist elements in Array format
var plText ='';     //actual playlist to be constructed and send
var intervalID;     //holds update playlist timer

http.createServer(function (request, response) {



//Handle POST
  var body = [];
  request.on('data', function(chunk) {
    if(request.method === "POST")
      body.push(chunk);
  }).on('end', function() {
      if(request.method === "POST"){
        body = Buffer.concat(body).toString();
        if(body === 'reset'){
          resetServer();
        }
        return;
      }
  });


  var uri = url.parse(request.url).pathname;
  var filename = path.join(process.cwd(), uri);
  var file = uri.toString().split('/').pop();

  console.log(uri)

  if(file === 'playlist.m3u8'){
    if(pl_parsed){
      pl_send(response);
      return;
    }else{
      plArray = tools.pl_parse(filename);
      pl_update(2);
      pl_parsed = true;
      pl_send(response);
      intervalID = setInterval(pl_update, 1000);  //TODO: check for coords/segs
      return;
    }
  }

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



/**
 * @description Sends the playlist ( {plText} ) as a response
 * @param {response} The response object
 */
function pl_send(response){
  response.writeHead(200);
  response.write(plText);
  response.end();
}

/**
 * @description Apends {num} entries to the playlist to be send
 * @param {num} (optional) default: 1
 * @return The updated playlist text
 * 
 */
function pl_update(num){
  if(typeof num === 'undefined' || num ===''){
    num = 1;
  }
  for(var i=0; i<num; i++)
    plText += next_m4s_element();
//    plText += plArray.shift();

  //check if there is a coordinate set following
  if(plArray[0].endsWith('txt')||plArray[0].endsWith('txt'+String.fromCharCode(13))){
    plText +=plArray.shift();
  }

  return plText;
}

function next_m4s_element(){
  var elem = plArray.shift();
  while(typeof elem !== 'undefined' && (!elem.endsWith('m4s')&&!elem.endsWith('m4s'+String.fromCharCode(13)))){
      elem += plArray.shift();
  }
  return elem;
  /*
  console.log(elem)
  if(typeof elem ==='undefined')
    return '';
  if(elem.endsWith('m4s')){
    return elem;
  }else{
    elem += next_m4s_element();
    return elem;
  }
  */
}


function resetServer(){
  console.log('reseting server...')
  pl_parsed = false;
  plArray = [];
  plText ='';     //actual playlist to be constructed and send
  clearInterval(intervalID);
}