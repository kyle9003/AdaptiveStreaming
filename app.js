var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')
  , exec = require('child_process').exec
  , util = require('util')
  , stream = require('stream')
  , del = require('node-delete')
  , express = require('express')
 
app.listen(8080);
console.log("listening");
 
function handler (req, res) {
  var stream = fs.createReadStream(__dirname + '/index.html');
  stream.pipe(res);

  // fs.readFile(__dirname + '/index.html', function (err, data) {
  //   if (err) {
  //     res.writeHead(500);
  //     return res.end('Error loading index.html');
  //   }
  //   res.writeHead(200);
  //   res.end(data);
  // });

}
 
var Files = {};

io.sockets.on('connection', function (socket) {
    socket.on('Start', function (data) { //data contains the variables that we passed through in the html file
        var Name = data['Name'];
        Files[Name] = {  //Create a new Entry in The Files Variable
            FileSize : data['Size'],
            Data     : "",
            Downloaded : 0
        }
        var Place = 0;
        try {
          console.log("check file:" + Name);
            var Stat = fs.statSync('Temp/' +  Name);
            if(Stat.isFile()) {
                console.log("stat is file")
                Files[Name]['Downloaded'] = Stat.size;
                Place = Stat.size / 524288;
                console.log("place in file" + place);
            }
        } catch(er){
          console.log("error: " + er);
        } //It's a New File
        fs.open("Temp/" + Name, "a", 0755, function(err, fd){
            if(err) {
                console.log(err);
            } else {
                Files[Name]['Handler'] = fd; //We store the file handler so we can write to it later
                socket.emit('MoreData', { 'Place' : Place, Percent : 0 });
            }
        });
    });

    socket.on('Upload', function (data){
        var Name = data['Name'];
        Files[Name]['Downloaded'] += data['Data'].length;
        Files[Name]['Data'] += data['Data'];
        if(Files[Name]['Downloaded'] == Files[Name]['FileSize']) //If File is Fully Uploaded
        {
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
              console.log(Writen);
                //Get Thumbnail Here
                var input = fs.createReadStream("Temp/" + Name);
                var output = fs.createWriteStream("Video/" + Name);
                input.pipe(output);
                input.on("close", function (){
                  fs.closeSync(Files[Name]['Handler']);
                  fs.unlink("Temp/" + Name, function (err, ){
                    exec("ffmpeg -n -i Video/" + Name  + " -ss 00:30 -r 1 -an -vframes 1 -f mjpeg Video/" + Name  + ".jpg", function(err){
                        socket.emit('Done', {'Image' : 'Video/' + Name + '.jpg'});
                      });
                  });  
                }); 
            });
        }
        else if(Files[Name]['Data'].length > 10485760) { //If the Data Buffer reaches 10MB
          console.log("10mb reached");
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
                Files[Name]['Data'] = ""; //Reset The Buffer
                var Place = Files[Name]['Downloaded'] / 524288;
                var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
                socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
            });
        }
        else
        {
          console.log("not 10mb");
            var Place = Files[Name]['Downloaded'] / 524288;
            var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
            socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
        }
    });


    socket.on('Delete', function(data) {
      var name = data['Name'];
      fs.unlink(__dirname + '/temp/'+name, function(){
        console.log("deleted " + name);
      })
    });

     

});