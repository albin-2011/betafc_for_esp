$('#nav').innerHTML = Object.entries(TABS).map(([id, [t]], k) => `<a data-t="${id}" data-ic="${IC[id] || '•'}" class="${k ? '' : 'act'}">${t}</a>`).join('');
$('#tabs').innerHTML = Object.entries(TABS).map(([id, [, h]], k) => `<section id="${id}" class="${k ? '' : 'act'}">${h}</section>`).join('');
function showTab(id){
  document.querySelectorAll('nav a,section').forEach(e => e.classList.remove('act'));
  const a = document.querySelector(`nav a[data-t="${id}"]`); if(a) a.classList.add('act');
  $('#' + id).classList.add('act');
}
document.querySelectorAll('nav a[data-t]').forEach(a => a.onclick = () => showTab(a.dataset.t));
const chName = ['Roll', 'Pitch', 'Throttle', 'Yaw'];
$('#chs').innerHTML = Array.from({length: 16}, (_, i) =>
  `<div style="display:flex;gap:10px;align-items:center;margin:5px 0"><span style="width:80px">${chName[i] || 'AUX ' + (i - 3)}</span>` +
  `<div class="bar" style="flex:1"><i id="b${i}" style="width:0"></i></div><span id="n${i}" style="width:44px;text-align:right">1500</span></div>`).join('');

// ---------- settings ----------
function fill(){ document.querySelectorAll('[data-i]').forEach(e => e.value = cfg[e.dataset.i]); wire(); if(window.extraFill) extraFill(); }
function wire(){ $('#wire').textContent = WIRES[cfg[3]] || ''; }
let pt;
function pushCfg(){ if(!cfgOk) return; clearTimeout(pt); pt = setTimeout(() => send(211, [...new Uint8Array(Int16Array.from(cfg).buffer)]), 200); }
document.addEventListener('change', e => { const i = e.target.dataset.i; if(i !== undefined){ cfg[+i] = +e.target.value; wire(); pushCfg(); } });
document.addEventListener('input', e => { const m = e.target.dataset.m; if(m !== undefined){ mt[m] = e.target.value * 4; if(mt[m] === 0) send(221, [+m, 0, 0]); } });
setInterval(() => { if(connected && $('#mtOk').checked) mt.forEach((v, i) => { if(v > 0) send(221, [i, v & 255, v >> 8]); }); }, 100);
function msg(t){ $('#msg').textContent = t; }
$('#save').onclick = () => send(250);
$('#cal').onclick = () => showTab('calib');
$('#def').onclick = async () => { await send(251); setTimeout(() => send(210), 300); msg('Defaults loaded. Click Save to FC to keep them.'); };

// ---------- MSP ----------
function frame(c, p = []){ let x = p.length ^ c; p.forEach(b => x ^= b); return new Uint8Array([36, 77, 60, p.length, c, ...p, x]); }
async function send(c, p){ if(writer) try{ await writer.write(frame(c, p)); }catch(e){} }
let ps = 0, sz = 0, cm = 0, cr = 0, buf = [];
function parse(c){
  switch(ps){
    case 0: ps = c == 36 ? 1 : 0; break;
    case 1: ps = c == 77 ? 2 : 0; break;
    case 2: ps = c == 62 ? 3 : 0; break;
    case 3: sz = c; cr = c; buf = []; ps = 4; break;
    case 4: cm = c; cr ^= c; ps = sz ? 5 : 6; break;
    case 5: buf.push(c); cr ^= c; if(buf.length >= sz) ps = 6; break;
    case 6: if(cr === c) handle(cm, buf); ps = 0; break;
  }
}
function push(h, v){ v.forEach((x, i) => { h[i].push(x); if(h[i].length > N) h[i].shift(); }); }
function handle(c, b){
  const dv = new DataView(new Uint8Array(b).buffer), i16 = o => dv.getInt16(o, true), u16 = o => dv.getUint16(o, true);
  if(window.extraHandle && extraHandle(c, b, dv)) return;
  if(c == 108){ st.roll = i16(0) / 10; st.pitch = i16(2) / 10; st.yaw = i16(4);
    $('#vr').textContent = st.roll.toFixed(1) + '°'; $('#vp').textContent = st.pitch.toFixed(1) + '°'; $('#vy').textContent = st.yaw + '°'; }
  else if(c == 102){ push(hist.a, [i16(0) / 512, i16(2) / 512, i16(4) / 512]); push(hist.g, [i16(6) / 16, i16(8) / 16, i16(10) / 16]); }
  else if(c == 105){
    for(let k = 0; k < 16; k++){ rcv[k] = u16(k * 2); $('#b' + k).style.width = Math.max(0, Math.min(100, (rcv[k] - 1000) / 10)) + '%'; $('#n' + k).textContent = rcv[k]; }
    const ok = b[32]; $('#link').textContent = ok ? 'Receiving' : 'No signal'; $('#link').style.color = ok ? 'var(--ok)' : 'var(--bad)';
    MODES.forEach((m, k) => { const a = cfg[32 + k * 3], el = $('#mv' + k); if(a < 0){ el.textContent = 'Off'; return; }
      const v = rcv[4 + a], on = v >= cfg[33 + k * 3] && v <= cfg[34 + k * 3]; el.textContent = v + (on ? ' ON' : ''); el.style.color = on ? 'var(--ok)' : ''; });
  }
  else if(c == 220) statusUpdate(b, u16);
  else if(c == 210){ cfg = [...new Int16Array(new Uint8Array(b).buffer)]; cfgOk = true; fill(); }
  else if(c == 250){ msg('Saved to FC.'); }
  else if(c == 252){ msg('Gyro calibrated.'); }
  else if(c == 3) ['#sensor', '#sensor2'].forEach(s => { const el = $(s); if(el) el.textContent = String.fromCharCode(...b); });
  else if(c == 2) $('#variant').textContent = String.fromCharCode(...b);
  else if(c == 4) $('#board').textContent = String.fromCharCode(...b);
  else if(c == 1) $('#api').textContent = b[1] + '.' + b[2];
}

// ---------- connection ----------
async function readLoop(){
  try{ while(true){ const {value, done} = await reader.read(); if(done) break; for(const x of value) parse(x); } }
  catch(e){}
  finally{ reader.releaseLock(); }
}
function ui(){
  $('#btn').textContent = connected ? 'Disconnect' : 'Connect';
  $('#btn').className = connected ? 'off' : '';
  $('#status').textContent = connected ? 'Connected' : 'Disconnected';
  $('#status').className = connected ? 'on' : '';
  if(!connected){ $('#arm').style.display = 'none'; $('#batt').textContent = ''; }
}
async function connect(){
  try{ port = await navigator.serial.requestPort(); await port.open({baudRate: 115200}); }catch(e){ return; }
  writer = port.writable.getWriter(); reader = port.readable.getReader();
  connected = true; cfgOk = false; ui(); readP = readLoop();
  setTimeout(() => { if(!connected) return;      // the ESP32 restarts when the port opens
    [1, 2, 3, 4, 210].forEach((c, i) => setTimeout(() => send(c), i * 80));
    timer = setInterval(() => {
      send(108); send(102);
      if(++tick % 4 == 0) send(220);
      if(window.extraPoll) extraPoll(document.querySelector('section.act').id);
      const t = document.querySelector('section.act').id; if(t == 'receiver' || t == 'modes') send(105);
    }, 25); }, 3000);
}
async function disconnect(){
  connected = false; clearInterval(timer);
  try{ await reader.cancel(); await readP; }catch(e){}
  try{ writer.releaseLock(); await port.close(); }catch(e){}
  ui();
}
$('#btn').onclick = () => connected ? disconnect() : connect();
if(!('serial' in navigator)){ $('#warn').style.display = 'block'; $('#btn').disabled = true; }

// ---------- 3D model ----------
const mc = $('#model'), mx = mc.getContext('2d');
function drawModel(){
  const W = mc.width, H = mc.height, S = 120, v = 60 * Math.PI / 180;
  mx.clearRect(0, 0, W, H);
  const r = st.roll * Math.PI / 180, p = st.pitch * Math.PI / 180, y = st.yaw * Math.PI / 180;
  const T = ([x, yy, z]) => {                       // x front, y right, z down
    let a = yy * Math.cos(r) - z * Math.sin(r), b = yy * Math.sin(r) + z * Math.cos(r); yy = a; z = b;
    a = x * Math.cos(p) + z * Math.sin(p); b = -x * Math.sin(p) + z * Math.cos(p); x = a; z = b;
    a = x * Math.cos(y) - yy * Math.sin(y); b = x * Math.sin(y) + yy * Math.cos(y); x = a; yy = b;
    return [W / 2 + yy * S, H / 2 - x * Math.sin(v) * S + z * Math.cos(v) * S];
  };
  const o = T([0, 0, 0]);
  [[1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, yy]) => [x * .8, yy * .8, 0]).forEach((a, i) => {
    const e = T(a);
    mx.strokeStyle = '#8a8a8a'; mx.lineWidth = 6; mx.beginPath(); mx.moveTo(...o); mx.lineTo(...e); mx.stroke();
    mx.fillStyle = i < 2 ? '#ffbb00' : '#d0d0d0'; mx.globalAlpha = .55; mx.beginPath(); mx.arc(e[0], e[1], 34, 0, 7); mx.fill(); mx.globalAlpha = 1;
  });
  const body = [[.35, -.2], [.35, .2], [-.35, .2], [-.35, -.2]].map(([x, yy]) => T([x, yy, -.05]));
  mx.fillStyle = '#4a4a4a'; mx.strokeStyle = '#ffbb00'; mx.lineWidth = 2; mx.beginPath();
  body.forEach((q, i) => i ? mx.lineTo(...q) : mx.moveTo(...q)); mx.closePath(); mx.fill(); mx.stroke();
  mx.fillStyle = '#9a9a9a'; mx.font = '12px sans-serif'; mx.fillText('Front = yellow arms', 12, 20);
}

// ---------- graphs ----------
function graph(id, data, range){
  const c = $(id), x = c.getContext('2d'), W = c.width, H = c.height;
  x.clearRect(0, 0, W, H); x.strokeStyle = '#444'; x.lineWidth = 1;
  [0, .25, .5, .75, 1].forEach(f => { x.beginPath(); x.moveTo(0, f * H); x.lineTo(W, f * H); x.stroke(); });
  ['#ffbb00', '#6bc04b', '#4aa3ff'].forEach((col, k) => {
    x.strokeStyle = col; x.lineWidth = 2; x.beginPath();
    data[k].forEach((val, i) => { const px = i / (N - 1) * W, py = H / 2 - val / range * H / 2; i ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.stroke();
  });
  x.fillStyle = '#9a9a9a'; x.font = '12px sans-serif'; x.fillText('+' + range, 6, 14); x.fillText('-' + range, 6, H - 6);
}
function rateOf(a, s){   // same formula as the firmware
  const c = cfg[23 + a * 3], m = cfg[24 + a * 3], e = cfg[25 + a * 3] / 100;
  return s * c + (m - c) * s * (Math.pow(s, 5) * e + s * (1 - e)) * 1;
}
function drawRates(){
  const c = $('#rcv'), x = c.getContext('2d'), W = c.width, H = c.height;
  x.clearRect(0, 0, W, H); x.strokeStyle = '#444'; x.lineWidth = 1;
  [.25, .5, .75].forEach(f => { x.beginPath(); x.moveTo(0, f * H); x.lineTo(W, f * H); x.stroke(); x.beginPath(); x.moveTo(f * W, 0); x.lineTo(f * W, H); x.stroke(); });
  const top = Math.max(200, ...[0, 1, 2].map(a => cfg[24 + a * 3] || 0));
  ['#ffbb00', '#6bc04b', '#4aa3ff'].forEach((col, a) => {
    x.strokeStyle = col; x.lineWidth = 2; x.beginPath();
    for(let i = 0; i <= 50; i++){ const s = i / 50, px = s * W, py = H - rateOf(a, s) / top * H; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
  });
  x.fillStyle = '#9a9a9a'; x.font = '12px sans-serif'; x.fillText(top + ' °/s', 6, 14); x.fillText('stick 0 to 100 %', 6, H - 6);
}

(function loop(){
  const t = document.querySelector('section.act').id;
  if(t == 'setup') drawModel();
  else if(t == 'sensors'){ graph('#g1', hist.g, 500); graph('#g2', hist.a, 4); }
  else if(t == 'rates') drawRates();
  else if(window.extraDraw) extraDraw(t);
  requestAnimationFrame(loop);
})();
fill(); ui(); if(window.extraInit) extraInit();
