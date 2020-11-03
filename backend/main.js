const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const rootdir = path.dirname(path.dirname(process.argv[1]));
const Websocket = require('ws');  // npm install -g ws

const parseJSON = function(str) {
  let obj;
  try {
    obj = JSON.parse(str);
  } catch (e) {
  }
  return obj;
};

const config =
    parseJSON(fs.readFileSync(path.join(rootdir, 'backend', 'config.json')));

// Store incoming sensor data in a simple JSON file. Save DB every 10 seconds
const dbfile = path.join(rootdir, 'db.json');
const db = parseJSON(fs.readFileSync(dbfile)) || {};
setInterval(ev => fs.writeFileSync(dbfile, JSON.stringify(db, null, 2)), 10000);

// Set response line and mime type based on the served static file name
const set_mime_type = function(res, filename) {
  mimeTypes = {
    'html': 'text/html',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'png': 'image/png',
    'js': 'text/javascript',
    'svg': 'image/svg+xml',
    'css': 'text/css'
  };
  const mimeType = mimeTypes[filename.split('.').pop()] || 'text/plain';
  res.writeHead(200, {'Content-Type': mimeType});
};

// Send API request to the VCON backend, return a promise
const vconrequest = function(uri, body) {
  const data = typeof (body) == typeof ('') ? body : JSON.stringify(body);
  const options = {
    hostname: 'dash.vcon.io',
    port: 443,
    path: uri,
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data ? data.length : 0,
      'Authorization': `Bearer ${config.vcon_api_key}`,
    }
  };
  return new Promise(function(resolve, reject) {
    const req = https.request(options, res => {
      let str = '';
      res.on('data', chunk => str += chunk);
      res.on('end', ev => resolve(parseJSON(str)));
    });
    req.on('error', error => reject(error));
    if (data) req.write(data);
    req.end();
  });
};

const parseCookies = function(req) {
  let cookies = {}, h = req.headers.cookie;
  h && h.split(';').forEach(function(cookie) {
    let parts = cookie.split('=');
    cookies[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return cookies;
};

const parseQueryString = function(s) {
  let query = {};
  s && s.split('&').forEach(function(p) {
    var pair = p.split('=');
    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
  });
  return query;
};

// Get authorisation from the client's request
const get_auth_info = function(req) {
  const ah = req.headers.authorization || '';
  let p = Buffer.from(ah.split(' ')[1] || '', 'base64').toString().split(':')
  if (p && (p[0] || p[1])) return {user: p[0], pass: p[1]};
  if (ah.startsWith('Bearer ')) return {user: '', pass: ah.substring(7)};
  let cookies = parseCookies(req);
  if (cookies.access_token) return {user: '', pass: cookies.access_token};
  const query = parseQueryString(req.url.substring(req.url.indexOf('?') + 1));
  if (query.access_token) return {user: '', pass: query.access_token};
  return null;
};

const sendjson = function(res, obj) {
  const code = obj.error ? obj.error.code : 200;
  res.writeHead(code, {'Content-Type': 'application/json'});
  res.write(JSON.stringify(obj), 'utf-8');
  res.end();
};

// Implement the following API calls:
//   /api/user    - return information about the logged in user
//   /api/devices - return list of devices
//   /api/led     - set LED on/off, parameters: {"did": DEVICE_ID, "on": true}
//   /api/db      - send DB data
const handle_api_call = function(req, res, obj) {
  const auth = get_auth_info(req);
  // console.log('AUTH INFO', auth, config.logins);
  if (!auth) {
    sendjson(res, {error: {code: 403, message: 'auth required'}});
  } else if (req.url == '/api/user') {
    obj = {error: {code: 403, message: 'auth required'}};
    config.logins.forEach(function(entry) {
      if ((entry.user == auth.user && entry.pass == auth.pass) ||
          (auth.user == '' && auth.pass == entry.token)) {
        obj = entry;
      }
    });
    sendjson(res, obj);
  } else if (req.url == '/api/led') {
    const params = {data: obj.on ? '1' : '0'};
    vconrequest(`/api/v3/devices/${obj.did}/rpc/serial.write`, params)
        .then(r => sendjson(res, r))
        .catch(e => sendjson(res, {error: {code: 500, message: e.toString()}}))
  } else if (req.url == '/api/db') {
    const begin = obj.begin || Date.now() - 3600000;
    // Select only those datapoints that are more recent than 'begin'
    let data = {};
    for (let k in db) data[k] = db[k].filter(p => p[0] > begin);
    sendjson(res, data);
  } else if (req.url == '/api/devices') {
    vconrequest('/api/v3/devices')
        .then(r => sendjson(res, r))
        .catch(e => sendjson(res, {error: {code: 500, message: e.toString()}}))
  }
};

const http_handler = function(req, res) {
  let str = '';
  req.on('data', chunk => str += chunk);
  req.on('end', ev => {
    const obj = parseJSON(str);
    if (req.url.startsWith('/api/')) {
      // URI starts with /api/, handle API call
      handle_api_call(req, res, obj);
    } else {
      // Serve static content
      var content = '';
      var rootdir = path.dirname(path.dirname(process.argv[1]));
      var filename = path.resolve(path.join(
          rootdir, 'frontend', req.url == '/' ? '/index.html' : req.url));
      if (fs.existsSync(filename)) {
        set_mime_type(res, filename);
        res.write(fs.readFileSync(filename), 'binary');
      } else {
        res.writeHead(404);
        res.write('Not found');
      }
      res.end();
    }
  });
};

http.createServer(http_handler).listen(config.listening_port, function(err) {
  if (err) return console.log('Error starting server:', err);
  console.log(`Server is listening on port ${config.listening_port}`)
});


// Websocket listener, see https://vcon.io/docs/#notifications
// Connect to the VCON backend using Websocket, and catch all events coming
// from devices
const addr =
    `wss://dash.vcon.io/api/v3/notify?access_token=${config.vcon_api_key}`;
const reconnect = function() {
  const ws = new Websocket(addr, {origin: addr});
  ws.on('error', msg => console.log('Got error:', msg.toString()));
  ws.on('message', msg => {
    const obj = parseJSON(msg.toString());
    if (obj.name == 'serial.tx') {
      // We're particularly interested in the 'serial.tx' event,
      // which is sent when a device writes something to the Serial.
      // In our case, we know the format of the Serial message
      // {"led": NUMBER1, "sensor": NUMBER2}
      const state = parseJSON(Buffer.from(obj.data.data, 'base64').toString());
      // console.log('->', obj, data);

      // Store sensor data in a db
      if (!(obj.did in db)) db[obj.did] = [];
      db[obj.did].push([Date.now(), state.sensor]);

      // Update 'state' device cloud attribute, in order for the UI to update
      const params = {state: state};
      vconrequest(`/api/v3/devices/${obj.did}`, params);
    }
  });
  ws.on('close', () => setTimeout(reconnect, 1000));
};
reconnect();
