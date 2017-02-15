"use strict"
var fs = require("fs");

module.exports = {

/**
 * @description Reads a UTF-8 textfile to a line-by-line Array
 * @param {filename} Filename to read
 * @return The contents of the file in Array format
 * 
 */
    pl_parse: function (filename) {
        var contents = fs.readFileSync(filename, 'utf-8');//, function(err, contents){
        return contents.split('\n');
    }


};