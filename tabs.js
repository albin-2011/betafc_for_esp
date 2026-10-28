
const $ = s => document.querySelector(s);
const NC = 48;
let cfg = new Array(NC).fill(0), cfgOk = false, rcv = new Array(16).fill(1500);
let port, reader, writer, readP, timer, connected = false, tick = 0;
const st = {roll: 0, pitch: 0, yaw: 0}, N = 240, hist = {g: [[], [], []], a: [[], [], []]}, mt = [0, 0, 0, 0, 0, 0];

// ---------- html helpers ----------
const box = (t, body, flex = 1, nopad = false) => `<div class="box" style="flex:${flex}"><h3>${t}</h3>${nopad ? body : `<div class="in">${body}</div>`}</div>`;
const sel = (label, i, opts) => `<tr><td>${label}</td><td><select data-i="${i}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></td></tr>`;
const num = (label, i, min, max, step = 1) => `<tr><td>${label}</td><td><input type="number" data-i="${i}" min="${min}" max="${max}" step="${step}"></td></tr>`;
const DEG = [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']];
const ESC = [[0, 'Brushed (MOSFET)'], [1, 'PWM (standard)'], [2, 'OneShot125'], [3, 'OneShot42'], [4, 'Multishot'], [5, 'DShot150'], [6, 'DShot300'], [7, 'DShot600']];
const AUXOPT = '<option value="-1">Off</option>' + Array.from({length: 12}, (_, k) => `<option value="${k}">AUX ${k + 1}</option>`).join('');
const AX = ['Roll', 'Pitch', 'Yaw'], MODES = ['ARM', 'ANGLE', 'AIRMODE'];
const FLAGS = ['No receiver signal', 'Throttle is not low', 'Turn the arm switch off first', 'Tilted too much', 'ARM mode not set (Modes tab)', 'Motor test running'];
const WIRES = {
  0: 'Choose your receiver type.',
  1: 'Receiver TX pin to GPIO16 (DevKit) or GPIO18 (S3). Signal must be 3.3 V.',
  2: 'SBUS pin to GPIO16 (DevKit) or GPIO18 (S3). The ESP32 inverts the signal, so no inverter is needed.',
  3: 'IBUS pin to GPIO16 (DevKit) or GPIO18 (S3).',
  4: 'PPM pin to GPIO4 (DevKit) or GPIO17 (S3). Signal must be 3.3 V.'
};

// ---------- tabs ----------
let TABS = {
setup: ['Setup', `<div class="row">
  ${box('Attitude', '<canvas id="model" width="640" height="380"></canvas>', 2, true)}
  ${box('Flight controller', `<table>
    <tr><td>Roll</td><td id="vr">0.0°</td></tr><tr><td>Pitch</td><td id="vp">0.0°</td></tr><tr><td>Heading</td><td id="vy">0°</td></tr>
    <tr><td>Battery</td><td id="vb">-</td></tr><tr><td>Loop work time</td><td id="vl">-</td></tr>
    <tr><td>Firmware</td><td id="variant">-</td></tr><tr><td>Board</td><td id="board">-</td></tr><tr><td>Gyro sensor</td><td id="sensor">-</td></tr><tr><td>API version</td><td id="api">-</td></tr></table>
    <p id="blk" class="mute"></p>`)}
  ${box('Board alignment', `<p class="mute">Tilt the board and watch the model. Change these until it moves the right way.</p><table>${sel('Roll', 0, DEG)}${sel('Pitch', 1, DEG)}${sel('Yaw', 2, DEG)}</table>`)}
</div>`],
config: ['Configuration', `<div class="row">
  ${box('Airframe', `<table>${sel('Frame', 4, [[0, 'Quad X'], [1, 'Quad +']])}</table><p class="mute">Quad X: M1 rear right, M2 front right, M3 rear left, M4 front left. M1 and M4 spin CCW, M2 and M3 spin CW.</p>`)}
  ${box('Filters', `<table>${num('Gyro low-pass (Hz)', 8, 20, 400)}${num('D-term low-pass (Hz)', 9, 20, 400)}</table>`)}
  ${box('Angle mode', `<table>${num('Strength', 10, 1, 200)}${num('Max angle (°)', 11, 10, 80)}</table>`)}
  ${box('Battery', `<table>${num('Voltage scale (x100)', 12, 100, 5000)}</table><p class="mute">Compare the voltage in the header with a multimeter. Change the scale until they match.</p>`)}
</div>`],
receiver: ['Receiver', `<div class="row">
  ${box('Receiver', `<table>${sel('Protocol', 3, [[0, 'None'], [1, 'CRSF / ELRS'], [2, 'SBUS'], [3, 'IBUS'], [4, 'PPM']])}<tr><td>Link</td><td id="link">No signal</td></tr></table><p class="mute" id="wire"></p>`)}
  ${box('Channels', '<div id="chs"></div>', 2)}
</div>`],
modes: ['Modes', `<div class="row">${box('Modes', `<p class="mute">Pick the switch and the range that turns each mode on.</p><table>
  <tr><td></td><td>Switch</td><td>From</td><td>To</td><td>Now</td></tr>
  ${MODES.map((m, k) => `<tr><td>${m}</td><td><select data-i="${32 + k * 3}">${AUXOPT}</select></td>
   <td><input type="number" data-i="${33 + k * 3}" min="900" max="2100" step="25"></td>
   <td><input type="number" data-i="${34 + k * 3}" min="900" max="2100" step="25"></td><td id="mv${k}">-</td></tr>`).join('')}
  </table><p class="mute">ARM turns the motors on (throttle must be low). ANGLE self-levels. AIRMODE keeps control at zero throttle.</p>`)}</div>`],
pid: ['PID Tuning', `<div class="row">${box('PID gains', `<table><tr><td></td><td>P</td><td>I</td><td>D</td></tr>
  ${AX.map((n, a) => `<tr><td>${n}</td>${[0, 1, 2].map(k => `<td><input type="number" data-i="${14 + a * 3 + k}" min="0" max="250"></td>`).join('')}</tr>`).join('')}
  </table><p class="mute">Start low and raise P in small steps. Stop when the aircraft starts to shake, then go back a little.</p>`)}</div>`],
rates: ['Rates', `<div class="row">
  ${box('Rates', `<table><tr><td></td><td>Center (°/s)</td><td>Max (°/s)</td><td>Expo %</td></tr>
  ${AX.map((n, a) => `<tr><td>${n}</td>${[0, 1, 2].map(k => `<td><input type="number" data-i="${23 + a * 3 + k}" min="0" max="1500"></td>`).join('')}</tr>`).join('')}</table>`)}
  ${box('Rate curve', '<canvas id="rcv" width="480" height="300"></canvas><div class="in leg"><span style="color:#ffbb00">Roll</span><span style="color:#6bc04b">Pitch</span><span style="color:#4aa3ff">Yaw</span></div>', 1, true)}
</div>`],
motors: ['Motors', `<div class="warn2"><b>Remove all propellers</b> before you use the motor test or change ESC settings.</div><div class="row">
  ${box('ESC and motors', `<table>${sel('ESC protocol', 5, ESC)}${num('Motor idle (0.1 %)', 6, 0, 200)}${num('PWM rate (Hz, PWM only)', 7, 50, 490)}</table>
   <p class="mute">DShot300 is a good start. DShot600 may be unreliable on ESP32. ESC and receiver settings cannot change while armed.</p>`)}
  ${box('Motor test (disarmed only, max 40 %)', `<label><input type="checkbox" id="mtOk"> Propellers are removed</label>
   ${[0, 1, 2, 3, 4, 5].map(i => `<div class="mrow"><span>M${i + 1}</span><input type="range" min="0" max="100" value="0" data-m="${i}"><div class="bar"><i id="mo${i}" style="width:0"></i></div></div>`).join('')}`, 2)}
</div>`],
sensors: ['Sensors', `<div class="row">
  ${box('Gyroscope (deg/s)', '<canvas id="g1" width="640" height="240"></canvas><div class="in leg"><span style="color:#ffbb00">X</span><span style="color:#6bc04b">Y</span><span style="color:#4aa3ff">Z</span></div>', 1, true)}
  ${box('Accelerometer (g)', '<canvas id="g2" width="640" height="240"></canvas><div class="in leg"><span style="color:#ffbb00">X</span><span style="color:#6bc04b">Y</span><span style="color:#4aa3ff">Z</span></div>', 1, true)}
</div>`]
};
