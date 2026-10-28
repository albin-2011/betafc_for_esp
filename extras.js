// espfc12: extra tabs (calibration, ports, power, failsafe, blackbox, presets, CLI) and helpers
const IC = {setup: '⌂', calib: '⟲', ports: '⇄', config: '⚙', power: '⚡', failsafe: '⚠', receiver: '☰', modes: '⏻', pid: '≋', rates: '∿', motors: '✇', sensors: '⌖', gps: '⌾', blackbox: '▤', presets: '★', cli: '>_'};
const CAL = [
  ['Level', 'Put the drone flat on a table, nose pointing forward.'],
  ['Nose up', 'Stand the drone on its tail, so the nose points up.'],
  ['Nose down', 'Stand the drone on its nose, so the nose points down.'],
  ['Right side down', 'Lay the drone on its right side.'],
  ['Left side down', 'Lay the drone on its left side.'],
  ['Upside down', 'Turn the drone upside down on the table.']
];
const CALERR = ['Calibration done and saved. Tilt the drone and check the 3D model on the Setup tab.',
  'Not all positions were captured. Start again.',
  'Each position must be exactly flat or on its side. Start again.',
  'The positions were not square to each other. Hold the drone more exactly and start again.',
  'Right side and left side were swapped. Start again.'];
const CELLOPT = [[0, 'Auto']].concat(Array.from({length: 8}, (_, k) => [k + 1, (k + 1) + 'S']));
const PRESETS = [
  ['Beginner: gentle, use Angle mode', [30, 50, 18, 30, 50, 18, 30, 50, 0], [70, 350, 10, 70, 350, 10, 60, 300, 0], 100, 70],
  ['5 inch freestyle', [42, 65, 28, 45, 70, 30, 38, 65, 0], [100, 650, 25, 100, 650, 25, 100, 550, 15], 150, 90],
  ['3 inch / mini quad', [38, 60, 22, 40, 62, 24, 34, 60, 0], [100, 550, 20, 100, 550, 20, 90, 450, 10], 150, 90],
  ['Cinematic smooth', [32, 55, 22, 34, 58, 24, 32, 55, 0], [60, 300, 35, 60, 300, 35, 50, 250, 30], 100, 70],
  ['Plane / wing starter (low gains)', [8, 10, 0, 8, 10, 0, 5, 10, 0], [50, 200, 20, 50, 200, 20, 40, 150, 10], 100, 70]
];
const NAMES = ['align_roll', 'align_pitch', 'align_yaw', 'rx_protocol', 'aircraft', 'esc_protocol', 'motor_idle', 'pwm_rate', 'gyro_lpf', 'dterm_lpf', 'level_strength', 'max_angle', 'vbat_scale', 'gyro_sensor']
  .concat(['roll', 'pitch', 'yaw'].flatMap(a => ['p', 'i', 'd'].map(k => 'pid_' + a + '_' + k)))
  .concat(['roll', 'pitch', 'yaw'].flatMap(a => ['center', 'max', 'expo'].map(k => 'rate_' + a + '_' + k)))
  .concat(['arm', 'angle', 'airmode'].flatMap(m => ['aux', 'from', 'to'].map(k => 'mode_' + m + '_' + k)))
  .concat(['failsafe_delay', 'failsafe_action', 'failsafe_throttle', 'failsafe_seconds', 'cells', 'vbat_warn', 'servo_reverse']);

Object.assign(TABS, {
calib: ['Calibration', `<div class="row">
  ${box('Guided calibration', `<p class="mute">Follow the steps. The FC learns the gyro offset, the accelerometer scale and how the board is mounted, then saves it. Keep the drone completely still during each step.</p>
    <div>${CAL.map((c, i) => `<div class="cstep" id="cs${i}">${i + 1}. ${c[0]}</div>`).join('')}</div>
    <h2 id="calTitle">Ready</h2><p id="calText">Connect, then press Start.</p>
    <div class="bar big"><i id="calBar" style="width:0"></i></div><br>
    <button id="calStart">Start calibration</button> <button class="alt" id="calReset">Reset calibration</button>
    <label><input type="checkbox" id="calVoice" checked> Voice</label>`, 2)}
  ${box('Live accelerometer (sensor axes)', `<table><tr><td>X</td><td id="ca0">-</td></tr><tr><td>Y</td><td id="ca1">-</td></tr><tr><td>Z</td><td id="ca2">-</td></tr></table>
    <p class="mute">Values are in g. In each step one axis should read close to +1 or -1.</p>`)}
</div>`],
ports: ['Ports', `<div class="row">${box('Pin map', `<table><tr><td>Function</td><td>ESP32 DevKit</td><td>ESP32-S3</td></tr>
  <tr><td>USB / configurator (MSP)</td><td>UART0 (USB)</td><td>Native USB</td></tr>
  <tr><td>Receiver (CRSF, SBUS, IBUS)</td><td>GPIO16</td><td>GPIO18</td></tr>
  <tr><td>PPM receiver</td><td>GPIO4</td><td>GPIO17</td></tr>
  <tr><td>MPU6050 SDA / SCL</td><td>21 / 22</td><td>8 / 9</td></tr>
  <tr><td>Motors M1 to M6</td><td>25, 26, 27, 13, 32, 33</td><td>4, 5, 6, 7, 15, 16</td></tr>
  <tr><td>Servos S1 to S4</td><td>18, 19, 23, 5</td><td>10, 11, 12, 14</td></tr>
  <tr><td>Battery voltage</td><td>34</td><td>1</td></tr>
  <tr><td>GPS RX (planned)</td><td>17</td><td>21</td></tr></table>
  <p class="mute">All pins are 3.3 V. Pins are fixed in the firmware for now.</p>`)}</div>`],
config: ['Configuration', `<div class="row">
  ${box('Aircraft', `<table>${sel('Type', 4, [[0, 'Quad X'], [1, 'Quad +'], [2, 'Hex X'], [3, 'Tricopter'], [4, 'Plane'], [5, 'Flying wing']])}</table>
    <p>Servo reverse: ${[0, 1, 2, 3].map(k => `<label><input type="checkbox" data-bit="${k}"> S${k + 1}</label> `).join('')}</p>
    <p class="mute">Quad X: M1 rear right, M2 front right, M3 rear left, M4 front left (M1 and M4 spin CCW). Hex X adds M5 mid right and M6 mid left. Tricopter: M1 rear, M2 front right, M3 front left, S1 tail servo. Plane: M1 throttle, S1 aileron, S2 elevator, S3 rudder. Wing: M1 throttle, S1 left elevon, S2 right elevon. The type cannot change while armed.</p>`)}
  ${box('Gyro sensor', `<table>${sel('Sensor', 13, [[0, 'Auto-detect'], [1, 'MPU6050'], [2, 'MPU6500 / MPU9250']])}</table>
    <p class="mute">Detected: <span id="sensor2">-</span>. SPI sensors (ICM-42688-P, BMI270) are planned.</p>`)}
  ${box('Filters', `<table>${num('Gyro low-pass (Hz)', 8, 20, 400)}${num('D-term low-pass (Hz)', 9, 20, 400)}</table>`)}
  ${box('Angle mode', `<table>${num('Strength', 10, 1, 200)}${num('Max angle (°)', 11, 10, 80)}</table>`)}
</div>`],
power: ['Power & Battery', `<div class="row">
  ${box('Battery', `<table>${sel('Cells', 45, CELLOPT)}${num('Warning per cell (x0.01 V)', 46, 280, 420)}${num('Voltage scale (x100)', 12, 100, 5000)}</table>
    <p class="mute">Use a voltage divider (for example 10k and 1k) from the battery to the voltage pin. The pin must never see more than 3.3 V. Compare the voltage with a multimeter and change the scale until they match.</p>`)}
  ${box('Live', `<table><tr><td>Voltage</td><td id="pv">-</td></tr><tr><td>Cells</td><td id="pc">-</td></tr><tr><td>Per cell</td><td id="pp">-</td></tr><tr><td>Status</td><td id="pw">-</td></tr></table>`)}
</div>`],
failsafe: ['Failsafe', `<div class="row">${box('Failsafe', `<table>${num('Signal loss delay (ms)', 41, 100, 3000, 50)}${sel('Action', 42, [[0, 'Drop: stop motors'], [1, 'Auto-land: level + fixed throttle']])}${num('Auto-land throttle (x0.1 %)', 43, 0, 700)}${num('Auto-land time (s)', 44, 1, 30)}</table>
  <p class="mute">Drop stops the motors at once. Auto-land levels the aircraft and holds the throttle you set for the set time, then disarms. It does not know the height, so pick a throttle that sinks slowly. Test it with propellers off first.</p>`)}</div>`],
gps: ['GPS / Baro / OSD / VTX', `<div class="row">${box('Extra hardware', `<table>
  <tr><td>GPS</td><td>Not connected (driver comes with the hardware)</td></tr>
  <tr><td>Barometer (BMP280 / BMP388)</td><td>Not connected</td></tr>
  <tr><td>Compass (QMC5883L)</td><td>Not connected. It will fix yaw drift.</td></tr>
  <tr><td>OSD</td><td>Not connected</td></tr>
  <tr><td>VTX</td><td>Not connected</td></tr></table>
  <p class="mute">These tabs fill in when each module gets a driver.</p>`)}</div>`],
blackbox: ['Blackbox', `<div class="row">${box('Recorder', `<p class="mute">Records flight data over USB, about 40 samples per second, while this tab is open. Good for tuning. It is not a full-speed flash log.</p>
  <button id="bbRec">Start recording</button> <button class="alt" id="bbClr">Clear</button> <button class="alt" id="bbCsv">Download CSV</button> <span id="bbInfo" class="mute">0 samples</span>
  <p><select id="bbAx"><option value="0">Roll</option><option value="1">Pitch</option><option value="2">Yaw</option><option value="3">Motors</option></select>
  <input type="range" id="bbPos" min="0" max="0" value="0" style="width:60%"></p>`)}</div>
  <div class="row">${box('Graph', '<canvas id="bbc" width="900" height="300"></canvas><div class="in mute">Roll, Pitch, Yaw: yellow = gyro, green = setpoint, blue = PID output. Motors: six lines.</div>', 1, true)}</div>`],
presets: ['Presets', `<div class="row">${box('Presets', '<div id="presetBox"></div><p class="mute">Presets change PID, rates and filters only. Start gentle and tune from there.</p>')}</div>`],
cli: ['CLI', `<div class="row">${box('Command line', '<pre id="cliOut">Type help and press Enter.\n</pre><input type="text" id="cliIn" placeholder="help, get, set name=value, dump, save, defaults, status, calibrate, reboot">')}</div>`]
});
TABS = Object.fromEntries(['setup', 'calib', 'ports', 'config', 'power', 'failsafe', 'receiver', 'modes', 'pid', 'rates', 'motors', 'sensors', 'gps', 'blackbox', 'presets', 'cli'].map(k => [k, TABS[k]]));

// ---------- guided calibration ----------
const calw = {step: -1, phase: ''};
const bb = {on: false, rows: []};
function say(t){ const v = $('#calVoice'); if(v && v.checked && 'speechSynthesis' in window){ speechSynthesis.cancel(); setTimeout(() => speechSynthesis.speak(new SpeechSynthesisUtterance(t)), 120); } }
function calShow(title, text, pct){ $('#calTitle').textContent = title; $('#calText').textContent = text; $('#calBar').style.width = pct + '%'; }
function calMark(){ document.querySelectorAll('.cstep').forEach((e, i) => e.className = 'cstep' + (i < calw.step ? ' done' : i == calw.step ? ' cur' : '')); }
function calMove(){
  calw.phase = 'move'; calw.t = Date.now() + 5000;
  const c = CAL[calw.step];
  calShow('Step ' + (calw.step + 1) + ' of 6: ' + c[0], c[1], 0); calMark();
  say('Step ' + (calw.step + 1) + '. ' + c[1]);
}
function calStart(){ if(!connected){ msg('Connect first.'); return; } calw.step = 0; calMove(); }
function calTick(){
  if(calw.step < 0) return;
  if(calw.phase == 'move'){
    const left = Math.ceil((calw.t - Date.now()) / 1000);
    if(left > 0){ $('#calText').textContent = CAL[calw.step][1] + ' Starting in ' + left + ' s...'; return; }
    calw.phase = 'hold'; calw.lastRx = Date.now(); calw.holdT = Date.now();
    send(260, [calw.step]); say('Hold still'); $('#calText').textContent = 'Hold still...';
  } else if(calw.phase == 'hold' && Date.now() - calw.lastRx > 3000){
    $('#calText').textContent = 'The FC is not answering. Flash the latest espfc12.ino, reconnect, and start again.';
  }
}
function calHandle(b){                       // state, pose, progress, done mask, live accel, reason
  for(let k = 0; k < 3; k++){ const v = (b[4 + 2 * k] | (b[5 + 2 * k] << 8)) << 16 >> 16; const el = $('#ca' + k); if(el) el.textContent = (v / 1000).toFixed(2); }
  if(calw.step < 0 || calw.phase != 'hold') return;
  calw.lastRx = Date.now();
  if(Date.now() - calw.holdT < 400 || b[1] != calw.step) return;     // ignore old replies
  const why = b.length > 10 ? b[10] : 0;
  $('#calBar').style.width = b[2] + '%';
  $('#calText').textContent = 'Hold still... ' + b[2] + '%' + (why == 1 ? ' (the drone is moving)' : why == 2 ? ' (accelerometer reading looks wrong)' : '');
  if(b[0] == 2){
    calw.step++;
    if(calw.step < 6) calMove();
    else { calw.phase = 'finish'; calMark(); calShow('Calculating...', 'Please wait.', 100); send(262); }
  }
}
function calResult(err){
  calw.step = -1; calw.phase = '';
  calShow(err ? 'Calibration failed' : 'Calibration complete', CALERR[err], err ? 0 : 100);
  document.querySelectorAll('.cstep').forEach(e => e.className = 'cstep' + (err ? '' : ' done'));
  say(err ? 'Calibration failed' : 'Calibration complete');
  if(!err) send(210);
}

// ---------- status, battery, sidebar ----------
function statusUpdate(b, u16){
  const armed = b[0], blk = u16(3), vb = u16(5) / 100, work = u16(7), cells = b[21], warn = b[22], fs = b[23];
  $('#arm').style.display = 'inline-block'; $('#arm').textContent = fs ? 'FAILSAFE' : armed ? 'ARMED' : 'DISARMED'; $('#arm').className = 'badge' + (armed || fs ? ' on' : '');
  $('#sGyro').classList.add('on'); $('#sAcc').classList.add('on');
  $('#batt').textContent = vb.toFixed(1) + ' V';
  $('#sbV').textContent = vb.toFixed(2) + ' V'; $('#sbArm').textContent = fs ? 'Failsafe' : armed ? 'Armed' : 'Disarmed';
  $('#sbCyc').textContent = work + ' µs'; $('#sbCpu').textContent = (work / 10).toFixed(0) + ' %';
  $('#vb').textContent = vb.toFixed(2) + ' V'; $('#vl').textContent = work + ' µs';
  for(let k = 0; k < 6; k++){ const el = $('#mo' + k); if(el) el.style.width = Math.min(100, u16(9 + k * 2) / 10) + '%'; }
  $('#blk').textContent = armed ? 'Armed.' : blk ? 'Cannot arm: ' + FLAGS.filter((_, k) => blk >> k & 1).join(', ') + '.' : 'Ready to arm.';
  $('#pv').textContent = vb.toFixed(2) + ' V'; $('#pc').textContent = cells ? cells + 'S' : '-';
  $('#pp').textContent = cells ? (vb / cells).toFixed(2) + ' V' : '-';
  $('#pw').textContent = warn ? 'LOW BATTERY' : 'OK'; $('#pw').style.color = warn ? 'var(--bad)' : 'var(--ok)';
}

function extraHandle(c, b, dv){
  if(c == 261){ calHandle(b); return true; }
  if(c == 262){ calResult(b[0]); return true; }
  if(c == 263){ msg('Calibration reset.'); send(210); return true; }
  if(c == 253){ msg('Rebooting. Disconnect and connect again in a few seconds.'); return true; }
  if(c == 230){
    const v = i => dv.getInt16(i * 2, true);
    const r = [performance.now() / 1000];
    for(let k = 0; k < 9; k++) r.push(v(k) / (k < 6 ? 16 : 1));
    for(let k = 9; k < 15; k++) r.push(v(k) / 10);
    r.push(v(15) / 10, v(16) / 100);
    bb.rows.push(r); if(bb.rows.length > 30000) bb.rows.shift();
    return true;
  }
  return false;
}
function extraPoll(t){
  if(t == 'calib' || (calw.step >= 0 && calw.phase == 'hold')) send(261);
  if(t == 'blackbox' && bb.on) send(230);
}
function extraFill(){ document.querySelectorAll('[data-bit]').forEach(e => e.checked = (cfg[47] >> e.dataset.bit) & 1); }

// ---------- blackbox ----------
function drawBB(){
  const c = $('#bbc'), x = c.getContext('2d'), W = c.width, H = c.height, win = 600, n = bb.rows.length;
  $('#bbInfo').textContent = n + ' samples';
  $('#bbPos').max = Math.max(0, n - win); if(bb.on) $('#bbPos').value = Math.max(0, n - win);
  x.clearRect(0, 0, W, H);
  const s = +$('#bbPos').value, rows = bb.rows.slice(s, s + win), ax = +$('#bbAx').value;
  const cols = ['#ffbb00', '#6bc04b', '#4aa3ff', '#e5483a', '#b07cff', '#cccccc'];
  const series = ax < 3 ? [1 + ax, 4 + ax, 7 + ax] : [10, 11, 12, 13, 14, 15];
  let top = 1; if(ax < 3) rows.forEach(r => series.forEach(k => top = Math.max(top, Math.abs(r[k]))));
  x.strokeStyle = '#444'; [0, .25, .5, .75, 1].forEach(f => { x.beginPath(); x.moveTo(0, f * H); x.lineTo(W, f * H); x.stroke(); });
  series.forEach((k, j) => {
    x.strokeStyle = cols[j]; x.lineWidth = 2; x.beginPath();
    rows.forEach((r, i) => { const px = i / (win - 1) * W, py = ax < 3 ? H / 2 - r[k] / top * H / 2 : H - r[k] / 100 * H; i ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.stroke();
  });
  x.fillStyle = '#a0a0a0'; x.font = '12px sans-serif'; x.fillText(ax < 3 ? '+' + Math.round(top) : '100 %', 6, 14);
}
function extraDraw(t){ if(t == 'blackbox') drawBB(); }

// ---------- CLI ----------
function cliPrint(s){ const o = $('#cliOut'); o.textContent += s + '\n'; o.scrollTop = o.scrollHeight; }
function cliRun(line){
  cliPrint('# ' + line);
  const p = line.trim().split(/\s+/), cmd = p.shift(), arg = p.join(' ');
  if(cmd == 'help') cliPrint('help, get [text], set name=value, dump, save, defaults, status, calibrate, reboot, version');
  else if(cmd == 'get') NAMES.forEach((n, i) => { if(!arg || n.includes(arg)) cliPrint(n + ' = ' + cfg[i]); });
  else if(cmd == 'set'){
    const m = arg.match(/^(\S+)\s*=\s*(-?\d+)$/), i = m ? NAMES.indexOf(m[1]) : -1;
    if(i < 0) cliPrint('Usage: set name=value (see get for names)');
    else { cfg[i] = +m[2]; fill(); pushCfg(); cliPrint(NAMES[i] + ' = ' + cfg[i]); }
  }
  else if(cmd == 'dump') NAMES.forEach((n, i) => cliPrint('set ' + n + ' = ' + cfg[i]));
  else if(cmd == 'save'){ send(250); cliPrint('Saved.'); }
  else if(cmd == 'defaults'){ send(251); setTimeout(() => send(210), 300); cliPrint('Defaults loaded. Type save to keep them.'); }
  else if(cmd == 'status') cliPrint('Connected: ' + connected + '\nSensor: ' + $('#sensor').textContent + '\nBoard: ' + $('#board').textContent + '\n' + $('#blk').textContent);
  else if(cmd == 'calibrate') showTab('calib');
  else if(cmd == 'reboot') send(253);
  else if(cmd == 'version') cliPrint('espfc12 configurator 2.0');
  else if(cmd) cliPrint('Unknown command. Type help.');
}

// ---------- start-up wiring (runs after the tabs exist) ----------
function extraInit(){
  $('#calStart').onclick = calStart;
  $('#calReset').onclick = () => send(263);
  setInterval(calTick, 200);
  $('#reboot').onclick = () => send(253);
  $('#bbRec').onclick = () => { bb.on = !bb.on; $('#bbRec').textContent = bb.on ? 'Stop recording' : 'Start recording'; };
  $('#bbClr').onclick = () => { bb.rows = []; };
  $('#bbCsv').onclick = () => {
    const head = 'time,gyro_roll,gyro_pitch,gyro_yaw,setpoint_roll,setpoint_pitch,setpoint_yaw,pid_roll,pid_pitch,pid_yaw,m1,m2,m3,m4,m5,m6,throttle,vbat\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([head + bb.rows.map(r => r.join(',')).join('\n')], {type: 'text/csv'}));
    a.download = 'espfc12_blackbox.csv'; a.click();
  };
  $('#cliIn').onkeydown = e => { if(e.key == 'Enter'){ cliRun(e.target.value); e.target.value = ''; } };
  $('#presetBox').innerHTML = PRESETS.map((p, i) => `<div class="preset"><b>${p[0]}</b><button data-p="${i}">Apply</button></div>`).join('');
  document.querySelectorAll('[data-p]').forEach(btn => btn.onclick = () => {
    if(!cfgOk){ msg('Connect first.'); return; }
    const p = PRESETS[btn.dataset.p];
    p[1].forEach((v, k) => cfg[14 + k] = v); p[2].forEach((v, k) => cfg[23 + k] = v); cfg[8] = p[3]; cfg[9] = p[4];
    fill(); pushCfg(); msg('Preset applied. Click Save to FC to keep it.');
  });
  document.addEventListener('change', e => {
    const b = e.target.dataset.bit;
    if(b !== undefined){ cfg[47] = e.target.checked ? cfg[47] | (1 << b) : cfg[47] & ~(1 << b); pushCfg(); }
  });
}
