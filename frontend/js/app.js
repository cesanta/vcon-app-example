const {h, render, Component} = preact;
const html = htm.bind(h);
const VCON_URL = 'https://dash.vcon.io';

class LoadingIndicator extends Component {
  state = {count: 0, message: 'Loading...'};
  componentDidMount() {
    var self = this, app = this.props.app;
    this.sub = app.pubsub.subscribe('xhr', function(data) {
      var count = self.state.count + (data.state == 'start' ? 1 : -1);
      if (count < 0) count = 0;
      var message = 'Loading...';
      if (data.error) {
        var e = data.error;
        var m = (e.response || {}).data || {};
        var message = (m.message || (m.error || {}).message) || e.message || e;
        count++;
        setTimeout(function() {
          self.setState({count: self.state.count - 1});
        }, 3000);
      }
      self.setState({count: count, message: message});
    });
  };
  componentWillUnmount() {
    this.props.app.pubsub.unsubscribe('xhr', this.sub);
  };
  render({app}, state) {
    if (state.count == 0) return null;
    return html`
        <div class="position-absolute text-center" style="left: 45%">
          <div class="bg-warning badge badge-warning px-2">
            ${state.message}
          </div>
        </div>`;
  };
};

class Dropdown extends Component {
  state = {show: false};
  render(props, state) {
    const onclick = x => this.setState({show: x});
    const show = state.show ? 'show' : '';
    return html`
      <div class="dropdown autoexpand ${props.cls}">
        <div type="buttonx" onclick=${() => onclick(!state.show)}
          class="dropdown-toggle my-0 ${props.bcls}"
          data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
          ${props.title}
        </div>
        <div onclick=${() => onclick(false)} style=${props.dstyle}
          class="dropdown-menu ${props.dcls} ${show}">
          ${props.children}
        </div>
      </div>`;
  }
};

class Button extends Component {
  state = {spin: false};
  render({text, onclick, disabled, cls, icon, ref}, state) {
    const cb = (ev) => {
      this.setState({spin: true});
      var res = onclick();
      if (!res || !res.catch) {
        this.setState({spin: false});
        return;
      }
      res.catch(() => false).then(() => this.setState({spin: false}));
    };
    const color = 'btn-outline-primary';
    const icls = state.spin ? 'spinner-border spinner-border-sm' : '';
    return html`<button class="btn btn-sm ${color} ${cls} text-nowrap"
      ref=${ref} onclick=${cb} disabled=${disabled || state.spin} >
        <div class="d-inline-block text-center m-0 p-0" style="min-width:1.5em;">
          <span class="mr-1 ${icls}">${state.spin ? '' : icon}</span>
        </div>
        ${text}
      </button>`
  }
};

const NavLink = ({href, title, url}) => html`<a class="nav-item nav-link
    ${url == href ? 'active' : ''}"
    target=${href.match(/^http/) ? '_blank' : ''}
    href="${href.match(/^http/) ? '' : '#'}${href}">${title}</a>`;

class Header extends Component {
  state = {expanded: false};
  ontoggle = () => this.setState({expanded: !this.state.expanded});
  render(props, state) {
    const u = props.app.state.user || {};
    return html`
      <nav class="navbar navbar-expand-md navbar-dark bg-dark">
        <${LoadingIndicator} app=${props.app} />
        <a class="navbar-brand" href="#">
          <img src="images/logo.png" width="26" height="26" alt="" class="mr-2" />
        </a>
          <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation" 
            onclick=${() => this.ontoggle()} >
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="navbar-collapse ${state.expanded ? '' : 'collapse'}"
            id="navbarNav">
          <div class="nav navbar-nav mr-auto">
            <${NavLink} href="/" title="Dashboard" url=${props.url} />
            <${NavLink} href="/about" title="About" url=${props.url} />
          </div>
        </div>
        <form class="form-inline">
          <${Dropdown} title="${u.user}" cls="mr-2" 
          bcls="btn btn-sm btn-outline-light pointer" dcls="m-0 dropdown-menu-right">
            <div onclick=${() => props.app.setToken('')}
              class="dropdown-item small pointer text-center">logout</div>
          </${Dropdown}>
          <img src="images/user.png" class="rounded-circle nav-item mr-2" width="30" />
        </form>
      </nav>
    `
  }
};

class Modal extends Component {
  state = {show: true};
  esc = (ev) => this.onEscapeKey(ev);
  componentDidMount() {
    document.addEventListener('keydown', this.esc);
  };
  componentWillUnmount() {
    document.removeEventListener('keydown', this.esc);
  };
  onHide() {
    this.setState({show: false});
    setTimeout(() => {
      // this.props.app.setState({[this.props.vn]: false});
      if (this.props.hide) this.props.hide();
      this.setState({show: true});
    }, 300);
  };
  onEscapeKey(ev) {
    if (ev.keyCode === 27) this.onHide();
  };
  render(props, state) {
    return html`
      <div class="d-block modal show">
        <div class="modal-dialog mw-100 w-50 position-relative p-3">
          <div class="modal-content p-2 w-100 overflow-auto animated faster
              ${state.show ? 'zoomIn' : 'zoomOut'}" style="z-index:99;">
            <b style="cursor: pointer; position: absolute; right:1em; top:1em; z-index:999;"
              onclick=${() => this.onHide()} > \u2716 </b>
            ${props.children}
          </div>
        </div>
        <div class="position-absolute h-100 w-100 animated faster
          ${state.show ? 'fadeIn' : 'fadeOut'}"
          style="z-index:98;top:0;left:0; background:rgba(0,0,0,0.5);"
        ></div>
      </div>`;
  }
};

class Login extends Component {
  state = {user: '', pass: ''};
  onclick = (app) => {
    const authhdr = 'Basic ' + btoa(this.state.user + ':' + this.state.pass);
    const headers = {Authorization: authhdr};
    return axios.get('/api/user', {headers})
        .then(res => app.setToken(res.data.token))
        .catch(ev => alert('Login failed'));
  };
  onpassinput = (ev) => this.setState({pass: ev.target.value});
  onuserinput = (ev) => this.setState({user: ev.target.value});
  render({app}, {user, pass}) {
    return html`
      <div class='mx-auto bg-light rounded border my-5' style='max-width: 480px;'>
        <div class='form p-5 rounded form-sm'>
          <h4 class="text-muted mb-4">Dashboard login</h4>
          <input type='email' placeholder='Username' class='my-2 form-control'
            oninput=${this.onuserinput} value=${user} />
          <input type="password" placeholder="Password" class="my-2 form-control"
            oninput=${this.onpassinput} value=${pass}
            onchange=${() => this.onclick(app)} />
          <div class="mb-4">
          <button class="btn btn-info btn-block" 
            disabled=${!user || !pass}
            onclick="${() => this.onclick(app)}"
          > Login</button>
          </div>
          <p class="text-muted small alert alert-warning">
            Use test/test to login
          </p>
          <p class="text-muted small alert alert-warning">
            Note: this is an example dashboard built on VCON platform.
            Visit <a href="https://vcon.io/docs/#dashboard">documentation</a> for
            a detailed tutorial
          </p>
        </div>
      </div>
    `
  }
};

class About extends Component {
  render(props, state) {
    return html`
      <div class="m-5">
        <div class="jumbotron text-muted text-center">
          An example dashboard built on VCON.IO platform.<br/> See detailed
          tutorial at <a href="https://vcon.io/docs">https://vcon.io/docs</a>
          <p>Copyright (c) 2020 Cesanta</p>
        </div>
      </div>
    `
  }
};

class Device extends Component {
  state = {checked: false};
  componentWillReceiveProps(nextProps, nextState) {
    this.setState({checked: (nextProps.d.state || {}).led});
  }
  render({d}, state) {
    const self = this;
    const onchange = function(ev) {
      self.setState({checked: ev.target.checked});
      axios.post('/api/led', {did: d.did, on: !!ev.target.checked});
    };
    const id = `cb_${d.did}`;
    const online = d.online;
    return html`
      <div style="height: 3em;"
        class="bg-white text-muted my-3 d-flex px-2 rounded border justify-content-between">
        <b class="my-auto mr-3">
          Device ${d.did} <small
              class=${online ? 'text-success' : 'text-danger'}>
              (${online ? 'online' : 'offline'})
            </small>
        </b>
        <b class="my-auto">${(d.state || {}).sensor}</b>
        <span class="toggle my-auto">
          <input type="checkbox" id=${id}
            disabled=${!d.online}
            checked=${state.checked}
            onchange=${onchange}
          />
          <label for=${id}><span></span></label>
        </span>
      </div>
  `;
  }
};

class Main extends Component {
  state = {total: 0, online: 0, devices: []};
  refresh() {
    axios.get('/api/devices')
        .then(res => {
          const devices = res.data;
          const total = devices.length;
          const online = devices.filter(d => d.online).length;
          this.setState({devices, online, total});
        })
        .catch(err => console.log('ERR', err));
  }
  updateGraph() {
    const self = this;
    const end = Date.now();
    const begin = end - 900 * 1000;
    axios.post('/api/db', {begin}).then(res => {
      self.chart.data.datasets = [];
      for (let k in res.data) {
        self.chart.data.datasets.push({
          data: res.data[k].map(p => Object.assign({}, {t: p[0], y: p[1]})),
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          fill: true,
          label: `device ${k}`,
        });
      }
      self.chart.options.scales.xAxes[0].ticks.min = begin;
      self.chart.options.scales.xAxes[0].ticks.max = end;
      self.chart.update();
    });
  }
  componentDidMount() {
    this.timer = setInterval(ev => {
      this.refresh();
      this.updateGraph();
    }, 3000);
    this.chart = new Chart(this.canvas.getContext('2d'), {
      type: 'line',
      options: {
        animation: {duration: 0},
        scales: {
          yAxes: [{ticks: {suggestedMin: 0, suggestedMax: 35}}],
          xAxes: [{type: 'time', ticks: {maxTicksLimit: 10}}]
        }
      }
    });
    this.updateGraph();
    this.refresh();
  }
  componentWillUnmount() {
    clearInterval(this.timer)
  }
  render(props, state) {
    const devices = state.devices.map(d => h(Device, {d: d}));
    return html`
      <div class="row m-3 text-muted ">
        <div class="col-md-8">
          <div class="card-deck text-center">
            <div class="card bg-light text-muted">
              <div class="card-header">Devices Total</div>
              <div class="card-body display-4"><b>${state.total}</b></div>
            </div>
            <div class="card bg-light text-muted">
              <div class="card-header">Devices Online</div>
              <div class="card-body display-4"><b>${state.online}</b></div>
            </div>
          </div>
          <div class="bg-light my-3 text-muted position-relative border rounded">
            <b style="position: absolute; top: 65%; left:45%;">Sensor data</b>
            <canvas class="w-100" style="height: 280px;"
              ref=${el => this.canvas = el}></canvas>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card bg-light text-muted">
            <div class="card-header">Device control: LED on/off</div>
            <div class="card-body">
              ${devices}
            </div>
          </div>
        </div>
      </div>
    `
  }
};

class App extends Component {
  state = {token: '', url: '/', user: null, now: 0};
  pubsub = util.pubsub();
  setToken(token) {
    const maxAge = token ? 86400 : 0;
    document.cookie = `access_token=${token};path=/;max-age=${maxAge}`;
    this.setState({token});
    // console.log('SETTING TOKEN TO ', token, document.cookie);
    return axios.get(`/api/user`)
        .then(res => this.setState({user: res.data}))
        .catch(() => {});
  }
  componentDidMount() {
    var self = this;
    axios.interceptors.request.use(
        function(config) {
          self.pubsub.publish('xhr', {state: 'start'});
          return config;
        },
        function(error) {
          return Promise.reject(error);
        });
    axios.interceptors.response.use(
        function(response) {
          self.pubsub.publish('xhr', {state: 'stop'});
          return response;
        },
        function(error) {
          self.pubsub.publish('xhr', {state: 'error', error: error});
          return Promise.reject(error);
        });
    this.setToken(util.getCookie('access_token'));
    setInterval(() => this.setState({now: Date.now()}), 15 * 1000);
  }
  render(props, state) {
    return !state.token ?
        h(Login, {app: this}) :
        h('div', {class: 'h-100'}, h(Header, {url: state.url, app: this}),
          h(preactRouter.Router, {
            history: History.createHashHistory(),
            onChange: ev => this.setState({url: ev.url}),
          },
            h(Main, {default: true}), h(About, {path: 'about'})));
  }
};


window.onload = () => render(h(App), document.body);
