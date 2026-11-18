// Fitty — send all your data straight to another device. No server, no account.
// The two devices make a direct (WebRTC) connection. To set it up they swap two short codes,
// shown as QR codes: the sender's "offer", then the receiver's "answer".

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
const PREFIX = 'FITTY1|';
const CHUNK = 16000;
const SETUP = { actpass: 'x', active: 'a', passive: 'p' };
const SETUP_BACK = { x: 'actpass', a: 'active', p: 'passive' };

// ---------- squeeze an SDP down to the few fields that matter (so the QR stays small) ----------
export function pack(sdp, kind) {
  const get = (re) => (sdp.match(re) || [])[1];
  const ufrag = get(/a=ice-ufrag:(\S+)/), pwd = get(/a=ice-pwd:(\S+)/);
  const fp = get(/a=fingerprint:sha-256 (\S+)/i), setup = get(/a=setup:(\S+)/);
  if (!ufrag || !pwd || !fp) throw new Error('bad description');
  const fpB64 = btoa(String.fromCharCode(...fp.split(':').map(h => parseInt(h, 16))));
  const seen = new Set(), cands = [];
  for (const m of sdp.matchAll(/a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ (host|srflx|prflx)/gi)) {
    const c = `${m[3][0]}${m[1]},${m[2]}`;
    if (!seen.has(c)) { seen.add(c); cands.push(c); }
  }
  return PREFIX + [kind, ufrag, pwd, fpB64, SETUP[setup] || 'x', ...cands.slice(0, 8)].join('|');
}

export function unpack(code, want) {
  code = String(code || '').trim();
  if (!code.startsWith(PREFIX)) throw new Error('not-fitty');
  const [kind, ufrag, pwd, fpB64, st, ...cands] = code.slice(PREFIX.length).split('|');
  if (want && kind !== want) throw new Error(want === 'o' ? 'need-offer' : 'need-answer');
  const fp = [...atob(fpB64)].map(c => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()).join(':');
  const TYPES = { h: 'host', s: 'srflx', p: 'prflx' };
  const lines = [
    'v=0', `o=- ${Date.now()} 2 IN IP4 127.0.0.1`, 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
    `a=ice-ufrag:${ufrag}`, `a=ice-pwd:${pwd}`, 'a=ice-options:trickle', `a=fingerprint:sha-256 ${fp}`,
    `a=setup:${SETUP_BACK[st] || 'actpass'}`, 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144',
    ...cands.filter(Boolean).map((c, i) => {
      const type = TYPES[c[0]] || 'host';
      const [ip, port] = c.slice(1).split(',');
      const prio = (type === 'host' ? 2122260223 : 1686052607) - i;
      return `a=candidate:${i + 1} 1 udp ${prio} ${ip} ${port} typ ${type}${type === 'host' ? '' : ' raddr 0.0.0.0 rport 0'}`;
    }),
    'a=end-of-candidates',
  ];
  return { type: kind === 'o' ? 'offer' : 'answer', sdp: lines.join('\r\n') + '\r\n' };
}

function gathered(pc, ms = 3500) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((res) => {
    const done = () => { clearTimeout(tm); pc.removeEventListener('icegatheringstatechange', chk); res(); };
    const chk = () => { if (pc.iceGatheringState === 'complete') done(); };
    const tm = setTimeout(done, ms);
    pc.addEventListener('icegatheringstatechange', chk);
  });
}

function watchFailure(pc, onFail) {
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed') onFail(new Error('connect-failed'));
  });
}

// ---------- the sending side ----------
export async function startSender() {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const dc = pc.createDataChannel('fitty', { ordered: true });
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  return {
    pc, dc,
    code: pack(pc.localDescription.sdp, 'o'),
    accept: (answer) => pc.setRemoteDescription(unpack(answer, 'a')),
    close: () => { try { dc.close(); } catch { } try { pc.close(); } catch { } },
  };
}

// Sends `text` over the channel in chunks, then waits for the receiver's "done" reply.
export function sendText(dc, pc, text, header, onProgress, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const fail = (e) => { if (!finished) { finished = true; reject(e); } };
    watchFailure(pc, fail);
    const openTimer = setTimeout(() => { if (dc.readyState !== 'open') fail(new Error('connect-timeout')); }, timeoutMs);
    dc.onmessage = (e) => {
      if (typeof e.data !== 'string' || e.data[0] !== 'C') return;
      const m = JSON.parse(e.data.slice(1));
      if (m.t === 'done') { finished = true; resolve(m); }
      if (m.t === 'error') fail(new Error(m.msg || 'receiver-error'));
    };
    dc.onclose = () => fail(new Error('closed'));
    const run = async () => {
      clearTimeout(openTimer);
      try {
        dc.bufferedAmountLowThreshold = 256 * 1024;
        dc.send('C' + JSON.stringify({ t: 'hi', size: text.length, ...header }));
        for (let i = 0; i < text.length; i += CHUNK) {
          if (dc.bufferedAmount > 1024 * 1024) await new Promise(r => { dc.onbufferedamountlow = () => { dc.onbufferedamountlow = null; r(); }; });
          dc.send('D' + text.slice(i, i + CHUNK));
          onProgress && onProgress(Math.min(1, (i + CHUNK) / text.length));
        }
        dc.send('C' + JSON.stringify({ t: 'end' }));
      } catch (e) { fail(e); }
    };
    if (dc.readyState === 'open') run(); else dc.onopen = run;
  });
}

// ---------- the receiving side ----------
export async function startReceiver(offer) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  await pc.setRemoteDescription(unpack(offer, 'o'));
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  const channel = new Promise((res) => { pc.ondatachannel = (e) => res(e.channel); });
  return { pc, code: pack(pc.localDescription.sdp, 'a'), channel, close: () => { try { pc.close(); } catch { } } };
}

// Collects the incoming text. `handle(text)` imports it and returns stats that go back to the sender.
export function receiveText(dc, pc, { onStart, onProgress, handle }) {
  return new Promise((resolve, reject) => {
    let parts = [], got = 0, size = 0, header = null, done = false;
    watchFailure(pc, (e) => { if (!done) reject(e); });
    dc.onclose = () => { if (!done) reject(new Error('closed')); };
    dc.onmessage = async (e) => {
      const d = e.data;
      if (typeof d !== 'string') return;
      if (d[0] === 'D') { parts.push(d.slice(1)); got += d.length - 1; onProgress && onProgress(size ? got / size : 0); return; }
      const m = JSON.parse(d.slice(1));
      if (m.t === 'hi') { header = m; size = m.size; parts = []; got = 0; onStart && onStart(m); }
      if (m.t === 'end') {
        try {
          const stats = await handle(parts.join(''), header);
          done = true;
          dc.send('C' + JSON.stringify({ t: 'done', ...stats }));
          resolve(stats);
        } catch (err) {
          done = true;
          try { dc.send('C' + JSON.stringify({ t: 'error', msg: String(err.message || err) })); } catch { }
          reject(err);
        }
      }
    };
  });
}

// ---------- QR codes ----------
const loaded = {};
function loadScript(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('load ' + src)); };
    document.head.appendChild(s);
  });
  return loaded[src];
}

export async function qrSVG(text) {
  await loadScript(new URL('./vendor/qrcode.min.js', import.meta.url).href);
  const q = window.qrcode(0, 'L');
  q.addData(text, 'Byte');
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
}

// Opens the camera into `video` and calls onCode(text) once a QR is read. Returns a stop() function.
export async function startScanner(video, onCode, accept = () => true) {
  await loadScript(new URL('./vendor/jsqr.min.js', import.meta.url).href);
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play().catch(() => { });
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  let stopped = false, last = 0;
  const stop = () => { stopped = true; stream.getTracks().forEach(tr => tr.stop()); video.srcObject = null; };
  const tick = (ts) => {
    if (stopped) return;
    if (ts - last > 120 && video.readyState >= 2 && video.videoWidth) {
      last = ts;
      const sc = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
      cv.width = Math.round(video.videoWidth * sc); cv.height = Math.round(video.videoHeight * sc);
      ctx.drawImage(video, 0, 0, cv.width, cv.height);
      const img = ctx.getImageData(0, 0, cv.width, cv.height);
      const hit = window.jsQR(img.data, cv.width, cv.height, { inversionAttempts: 'attemptBoth' });
      if (hit && hit.data && accept(hit.data)) { stop(); onCode(hit.data); return; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return stop;
}
