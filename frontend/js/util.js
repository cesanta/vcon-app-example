var util = {};

util.getCookie = function(name) {
  var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
  return v ? v[2] : '';
};

util.alertErr = function(e) {
  if (e.response && e.response.status == 401) {
    // util.logout(error);
  } else {
    var x = (e.response || {}).data || e.message || e;
    alert(x);
    return x;
  }
};

util.copyToClipboard = function(text) {
  var el = document.createElement('input');
  el.style = 'position: absolute; left: -1000px; top: -1000px';
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
};

util.pubsub = function() {
  var events = {}, id = 0;
  return {
    subscribe: function(name, fn) {
      if (!events[name]) events[name] = {};
      events[name][id] = fn;
      return id++;
    },
    unsubscribe: function(name, key) {
      delete (events[name] || {})[key];
    },
    publish: function(name, data) {
      var m = events[name] || {};
      for (k in m) m[k](data);
    },
  };
};

util.websocket = function(uri) {
  var l = window.location, proto = l.protocol.replace('http', 'ws');
  var wsURI = proto + '//' + l.host + l.pathname + uri;
  var wrapper = {
    reconnect: true,
    close: function() {
      wrapper.reconnect = false;
      wrapper.ws.close();
    },
  };
  var reconnect = function() {
    wrapper.ws = new WebSocket(wsURI);
    wrapper.ws.onopen = function() {
      if (wrapper.onopen) wrapper.onopen();
    };
    wrapper.ws.onmessage = function(ev) {
      try {
        var msg = JSON.parse(ev.data);
        wrapper.onmessage(msg);
        // console.log('ws->', msg);
      } catch (e) {
        console.log('Invalid ws frame:', ev.data);  // eslint-disable-line
      }
    };
    wrapper.ws.onerror = function(e) {
      console.log('WS error: ', e);
    };
    wrapper.ws.onclose = function() {
      window.clearTimeout(wrapper.tid);
      if (wrapper.reconnect) wrapper.tid = window.setTimeout(reconnect, 1000);
      if (wrapper.onclose) wrapper.onclose();
    };
  };
  reconnect();
  return wrapper;
};

util.isJSON = function(text) {
  return /^[\],:{}\s]*$/.test(
      text.replace(/\\["\\\/bfnrtu]/g, '@')
          .replace(
              /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,
              ']')
          .replace(/(?:^|:|,)(?:\s*\[)+/g, ''));
};

util.toJSON = function(text) {
  if (typeof (text) == 'object') return text || {};
  var obj = {};
  try {
    obj = JSON.parse(text);
  } catch (e) {
    console.log('toJSON', e);
  }
  return obj;
};

util.getvalue = function(obj, key) {
  if (!key || !obj) return obj;
  try {
    if (typeof (obj) != 'object') obj = JSON.parse(obj);
    var parts = key.split('.');
    for (var i = 0; i < parts.length; i++) obj = obj[parts[i]];
    return obj;
  } catch (e) {
    return undefined;
  }
};

