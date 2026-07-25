// Read-only ZMK Studio RPC dump: device info + behaviors + full keymap.
// Sends no mutating requests.
import fs from 'node:fs';
import { Request, Response } from '@zmkfirmware/zmk-studio-ts-client/studio';

const PORT = process.argv[2] ||
  '/dev/' + (fs.readdirSync('/dev').sort().find((f) => f.startsWith('ttyACM')) ?? 'ttyACM0');
const SOF = 0xab, ESC = 0xac, EOF = 0xad;

const fd = fs.openSync(PORT, 'r+');

function frame(bytes) {
  const out = [SOF];
  for (const b of bytes) {
    if (b === SOF || b === ESC || b === EOF) out.push(ESC);
    out.push(b);
  }
  out.push(EOF);
  return Buffer.from(out);
}

// Incremental unframer feeding decoded payloads to a queue.
let state = 'IDLE', acc = [];
const pending = [];
let waiter = null;

function feed(buf) {
  for (const b of buf) {
    if (state === 'IDLE') {
      if (b === SOF) { state = 'DATA'; acc = []; }
    } else if (state === 'DATA') {
      if (b === ESC) state = 'ESCAPED';
      else if (b === EOF) {
        const payload = Uint8Array.from(acc);
        state = 'IDLE'; acc = [];
        if (waiter) { const w = waiter; waiter = null; w(payload); }
        else pending.push(payload);
      } else if (b === SOF) { acc = []; }
      else acc.push(b);
    } else {
      acc.push(b); state = 'DATA';
    }
  }
}

const rs = fs.createReadStream(null, { fd, autoClose: false });
rs.on('data', feed);
rs.on('error', (e) => { console.error('read error:', e.message); process.exit(1); });

function nextFrame(timeoutMs = 4000) {
  if (pending.length) return Promise.resolve(pending.shift());
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { waiter = null; reject(new Error('timeout waiting for response')); }, timeoutMs);
    waiter = (p) => { clearTimeout(t); resolve(p); };
  });
}

let requestId = 0;
async function rpc(body) {
  const id = ++requestId;
  fs.writeSync(fd, frame(Request.encode({ requestId: id, ...body }).finish()));
  for (;;) {
    const resp = Response.decode(await nextFrame());
    if (resp.requestResponse?.requestId === id) return resp.requestResponse;
    // else: notification or stale response, keep reading
  }
}

const dump = {};

const info = await rpc({ core: { getDeviceInfo: true } });
dump.device = info.core?.getDeviceInfo?.name;
console.error('device:', dump.device);

const lock = await rpc({ core: { getLockState: true } });
console.error('lockState:', lock.core?.getLockState);
if (lock.core?.getLockState === 2) {
  console.error('DEVICE IS LOCKED — press your studio_unlock key, then re-run.');
  process.exit(2);
}

const list = await rpc({ behaviors: { listAllBehaviors: true } });
const ids = list.behaviors?.listAllBehaviors?.behaviors ?? [];
console.error('behaviors:', ids.length);

dump.behaviors = {};
for (const behaviorId of ids) {
  const d = await rpc({ behaviors: { getBehaviorDetails: { behaviorId } } });
  const det = d.behaviors?.getBehaviorDetails;
  if (det) dump.behaviors[det.id] = det.displayName;
}

const km = await rpc({ keymap: { getKeymap: true } });
const keymap = km.keymap?.getKeymap;
if (!keymap) { console.error('no keymap in response'); process.exit(1); }

dump.availableLayers = keymap.availableLayers;
dump.layers = keymap.layers.map((l) => ({
  id: l.id,
  name: l.name,
  bindings: l.bindings.map((b) => ({
    behaviorId: b.behaviorId,
    behavior: dump.behaviors[b.behaviorId] ?? `?${b.behaviorId}`,
    param1: b.param1,
    param2: b.param2,
  })),
}));

const phys = await rpc({ keymap: { getPhysicalLayouts: true } });
dump.physical = phys.keymap?.getPhysicalLayouts?.layouts?.map((l) => ({ name: l.name, keys: l.keys.length }));
dump.activeLayout = phys.keymap?.getPhysicalLayouts?.activeLayoutIndex;

console.log(JSON.stringify(dump, null, 2));
process.exit(0);
