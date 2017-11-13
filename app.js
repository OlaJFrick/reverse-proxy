// Requires
const http = require('http');
const httpProxy = require('http-proxy');

// Create a new reverse Proxy
const proxy = httpProxy.createProxyServer();

// Create a new webserver
http.createServer((req,res) => {
  // can we read the incoming url?
  let host = req.headers.host;
  res.end(host + req.url);
}).listen(80);

