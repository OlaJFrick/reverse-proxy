// requires 
const http = require("http");
const https = require("https");
const httpProxy = require("http-proxy");
const tls = require("tls");
const fs = require("fs");
const path = require("path");
const exec = require("child_process").exec;

// read our routes
const routes = require("./routing.json");

// read all certs from certbot into an object
let certs = readCerts("/etc/letsencrypt/live");

// Create a new reverse proxy
const proxy = httpProxy.createProxyServer();

// Handle proxy errors - thus not breaking the whole
// reverse-proxy app if an app doesn't answer
proxy.on("error", function(e) {
  console.log("Proxy error: ", e);
});

// Create a new unencrypted webserver for certbot challenges
// and redirects to https
http
  .createServer((req, res) => {
    const urlParts = req.url.split("/");

    if (urlParts[1] == ".well-known") {
      // using certbot-helper on port 5000
      proxy.web(req, res, { target: "http://127.0.0.1:5000" });
    } else {
      // redirect to https
      let url = "https://" + req.headers.host + req.url;
      res.writeHead(301, { Location: url });
      res.end();
    }
  })
  .listen(80);

// Create a new secure webserver
https
  .createServer(
    {
      // SNICallback lets us get the correct certs
      // depending on what the domain the user asks for
      SNICallback: (domain, callback) =>
        callback(
          certs[domain] ? null : new Error("No such cert"),
          certs[domain] ? certs[domain].secureContext : null
        ),
      // But we still have the server start with a "default" cert
      key: certs["olafrick.se"].key,
      cert: certs["olafrick.se"].cert
    },
    (req, res) => {
      // replace setResponseHeaders
      setResponseHeaders(req, res);

      const host = req.headers.host;

      let url = req.url;
      let portToUse;

      url = url + (url.substr(-1) != "/" ? "/" : "");

      for (let route in routes) {
        let port = routes[route];

        if (route.includes("/")) {
          route += route.substr(-1) != "/" ? "/" : "";
        }

        if (route === host) {
          portToUse = port;
        } else if (url != '/' && (host + url).indexOf(route) == 0) {
          portToUse = port;
        }
      }

      if (portToUse && portToUse.redirect) {
        // redirect to domain without www
        let urlLocation = "https://" + portToUse.redirect;
        res.writeHead(301, { Location: urlLocation });
        res.end();
      } else if (portToUse) {
        proxy.web(req, res, { target: "http://127.0.0.1:" + portToUse });
      } else {
        res.statusCode = 404;
        res.end("This is not the page you are looking for.");
      }
    }
  )
  .listen(443);

function setResponseHeaders(req, res) {
  res.oldWriteHead = res.writeHead;
  res.writeHead = function(statusCode, headers) {
    res.setHeader("x-powered-by", "vgl server");

    // Security related
    res.setHeader(
      "strict-transport-security",
      "max-age=31536000; includeSubDomains; preload"
    );
    res.setHeader("x-frame-options", "SAMEORIGIN");
    res.setHeader("x-xss-protection", "1");
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader(
      "content-security-policy",
      "default-src * 'unsafe-inline' 'unsafe-eval'"
    );

    // Call the original write head function as well
    res.oldWriteHead(statusCode, headers);
  };
}

function readCerts(pathToCerts) {
  let certs = {},
    domains = fs.readdirSync(pathToCerts);

  // Read all ssl certs into memory from file
  for (let domain of domains) {
    let domainName = domain.split("-0")[0];
    certs[domainName] = {
      key: fs.readFileSync(path.join(pathToCerts, domain, "privkey.pem")),
      cert: fs.readFileSync(path.join(pathToCerts, domain, "fullchain.pem"))
    };
    certs[domainName].secureContext = tls.createSecureContext(
      certs[domainName]
    );
  }
  return certs;
}

function renewCerts() {
  exec("certbot renew", (error, stdout, stdError) => {
    console.log("renewing certs", stdout);
    certs = readCerts("/etc/letsencrypt/live");
  });
}

// Renew certs if needed on start
renewCerts();
// and then once every day
setInterval(renewCerts, 1000 * 60 * 60 * 24);
