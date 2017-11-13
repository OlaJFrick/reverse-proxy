// Requires
const http = require('http');
const httpProxy = require('http-proxy');

// Create a new reverse Proxy
const proxy = httpProxy();
// const proxy = httpProxy.createProxyServer(options); // See (†)

// Create a new webserver
http.createServer((req,res) => {
  // can we read the incoming url?
  res.write(req.url);
}).listen(80);

