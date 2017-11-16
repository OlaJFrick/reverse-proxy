// Requires
const http = require('http');
const httpProxy = require('http-proxy');

// Create a new reverse Proxy
const proxy = httpProxy.createProxyServer();

// Handler proxy errors, so that it won't work.
proxy.on('error', function(e) {
  console.log('Proxy error', Date.now(), e);
});

// Create a new webserver
http.createServer((req, res) => {

  setResponseHeaders(req, res);
  // can we read the incoming url?
  let host = req.headers.host;
  let hostParts = host.split('.');
  let topDomain = hostParts.pop();
  let domain = hostParts.pop();
  let subDomain = hostParts.join('.');
  let urlParts = req.url.split('/');

  let port;

  if (urlParts[1] == '.well-known') {
    port = 5000; // certbot-helper
  }  else if (subDomain == '' || subDomain == 'www') {
    port = 4001;
  } else if (subDomain == 'portfolio') {
    port = 3000;
  } else {
    res.statusCode = 500;
    res.end('Can not fin your app!');
  }

  if (port) {
    proxy.web(req, res, {
      target: 'http://127.0.0.1:' + port
    });
  }

}).listen(80);

function setResponseHeaders(req, res) {
  // writeHead is built in.
  res.oldWriteHead = res.writeHead;

  res.writeHead = function(statusCode, headers) {
    res.setHeader('x-powered-by', 'Olas server');
    res.oldWriteHead(statusCode, headers);
  }
}
