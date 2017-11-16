// Requires
const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const tls = require('tls');
const path = require('path');
const fs = require('fs');

// Read all certs from certbot into an object
let certs = readCerts('/etc/letsencrypt/live');
console.log(certs);

// Create a new reverse Proxy
const proxy = httpProxy.createProxyServer();

// Handler proxy errors, so that it won't work.
proxy.on('error', function(e) {
  console.log('Proxy error', Date.now(), e);
});


// Create a new webserver
https.createServer({
  SNICallback: (domain, callback) => callback(
    certs[domain] ? null : new Error('No such cert'),
    certs[domain] ? certs[domain].secureContext : null
  key: certs['olafrick.se'].key,
  cert: certs['olafrick.se'].cert
}, (req, res) => {

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
  } else if (subDomain == '' || subDomain == 'www') {
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

}).listen(443);

function setResponseHeaders(req, res) {
  // writeHead is built in.
  res.oldWriteHead = res.writeHead;

  res.writeHead = function(statusCode, headers) {
    res.setHeader('x-powered-by', 'Olas server');
    res.oldWriteHead(statusCode, headers);
  }
}

function readCerts(pathToCerts) {
  let certs = {},
    domains = fs.readdirSync(pathToCerts);

  // Read all ssl certs into memory from file
  for (let domain of domains) {
    let domainName = domain.split('-0')[0];
    certs[domainName] = {
      key: fs.readFileSync(path.join(pathToCerts, domain, 'privkey.pem')),
      cert: fs.readFileSync(path.join(pathToCerts, domain, 'fullchain.pem'))
    };
    certs[domainName].secureContext = tls.createSecureContext(certs[domainName]);
  }

  return certs;

}
