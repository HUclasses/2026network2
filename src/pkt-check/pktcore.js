// ---- Twofish (encrypt only, 128-bit key) + EAX(CTR) + PT obfuscation ----
const PKT = (() => {
  const T = [
    [[8,1,7,13,6,15,3,2,0,11,5,9,14,12,10,4],[14,12,11,8,1,2,3,5,15,4,10,6,7,0,9,13],[11,10,5,14,6,13,9,0,12,8,15,3,2,4,7,1],[13,7,15,4,1,2,6,14,9,11,3,0,8,5,12,10]],
    [[2,8,11,13,15,7,6,14,3,1,9,4,0,10,12,5],[1,14,2,11,4,12,3,7,6,13,10,5,15,9,0,8],[4,12,7,5,1,6,9,10,0,14,13,8,2,11,3,15],[11,9,5,1,12,3,13,14,6,4,7,15,2,0,8,10]]];
  const ror4 = (x, n) => ((x >> n) | (x << (4 - n))) & 15;
  const Q = [0, 1].map(qi => { const t = T[qi], o = new Uint8Array(256);
    for (let x = 0; x < 256; x++) { let a = x >> 4, b = x & 15;
      let a1 = a ^ b, b1 = (a ^ ror4(b, 1) ^ ((8 * a) & 15)) & 15;
      let a2 = t[0][a1], b2 = t[1][b1];
      let a3 = a2 ^ b2, b3 = (a2 ^ ror4(b2, 1) ^ ((8 * a2) & 15)) & 15;
      o[x] = (t[3][b3] << 4) | t[2][a3]; }
    return o; });
  const gmul = (a, b, p) => { let r = 0; while (b) { if (b & 1) r ^= a; a <<= 1; if (a & 0x100) a ^= p; b >>= 1; } return r; };
  const MDS = [[0x01,0xEF,0x5B,0x5B],[0x5B,0xEF,0xEF,0x01],[0xEF,0x5B,0x01,0xEF],[0xEF,0x01,0xEF,0x5B]];
  const RS = [[0x01,0xA4,0x55,0x87,0x5A,0x58,0xDB,0x9E],[0xA4,0x56,0x82,0xF3,0x1E,0xC6,0x68,0xE5],[0x02,0xA1,0xFC,0xC1,0x47,0xAE,0x3D,0x19],[0xA4,0x55,0x87,0x5A,0x58,0xDB,0x9E,0x03]];
  const bytes = w => [w & 255, (w >>> 8) & 255, (w >>> 16) & 255, (w >>> 24) & 255];
  const word = b => (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
  const rol = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;
  const ror = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
  function h(X, L) { const y = bytes(X), l0 = bytes(L[0]), l1 = bytes(L[1]);
    const [q0, q1] = Q;
    const z = [q1[q0[q0[y[0]] ^ l1[0]] ^ l0[0]], q0[q0[q1[y[1]] ^ l1[1]] ^ l0[1]],
               q1[q1[q0[y[2]] ^ l1[2]] ^ l0[2]], q0[q1[q1[y[3]] ^ l1[3]] ^ l0[3]]];
    const o = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) o[i] ^= gmul(MDS[i][j], z[j], 0x169);
    return word(o); }
  function makeKey(key) { // 16 bytes
    const M = [0, 1, 2, 3].map(i => word(key.slice(4 * i, 4 * i + 4)));
    const Me = [M[0], M[2]], Mo = [M[1], M[3]];
    const S = [0, 1].map(i => { const s = [0, 0, 0, 0];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) s[r] ^= gmul(RS[r][c], key[8 * i + c], 0x14D);
      return word(s); });
    const SL = [S[1], S[0]], K = [];
    for (let i = 0; i < 20; i++) { const A = h(Math.imul(2 * i, 0x01010101) >>> 0, Me);
      const B = rol(h(Math.imul(2 * i + 1, 0x01010101) >>> 0, Mo), 8);
      K.push((A + B) >>> 0, rol((A + 2 * B) >>> 0, 9)); }
    // precompute g tables
    const G = [0, 1, 2, 3].map(() => new Uint32Array(256));
    { const [q0, q1] = Q, l0 = bytes(SL[0]), l1 = bytes(SL[1]);
      const qs = [x => q1[q0[q0[x] ^ l1[0]] ^ l0[0]], x => q0[q0[q1[x] ^ l1[1]] ^ l0[1]],
                  x => q1[q1[q0[x] ^ l1[2]] ^ l0[2]], x => q0[q1[q1[x] ^ l1[3]] ^ l0[3]]];
      for (let x = 0; x < 256; x++) for (let k = 0; k < 4; k++) { const z = qs[k](x), o = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) o[i] = gmul(MDS[i][k], z, 0x169);
        G[k][x] = word(o); } }
    return { K, G }; }
  function encryptBlock(ks, p) { const { K, G } = ks;
    const g = X => (G[0][X & 255] ^ G[1][(X >>> 8) & 255] ^ G[2][(X >>> 16) & 255] ^ G[3][X >>> 24]) >>> 0;
    let R = [0, 1, 2, 3].map(i => (word(p.slice(4 * i, 4 * i + 4)) ^ K[i]) >>> 0);
    for (let r = 0; r < 16; r++) { const T0 = g(R[0]), T1 = g(rol(R[1], 8));
      const F0 = (T0 + T1 + K[2 * r + 8]) >>> 0, F1 = (T0 + 2 * T1 + K[2 * r + 9]) >>> 0;
      const n2 = ror((R[2] ^ F0) >>> 0, 1), n3 = (rol(R[3], 1) ^ F1) >>> 0;
      R = [n2, n3, R[0], R[1]]; }
    const C = [R[2] ^ K[4], R[3] ^ K[5], R[0] ^ K[6], R[1] ^ K[7]];
    const out = new Uint8Array(16); C.forEach((w, i) => out.set(bytes(w >>> 0), 4 * i)); return out; }
  const KS = makeKey(new Uint8Array(16).fill(137));
  const E = b => encryptBlock(KS, b);
  const dbl = b => { const o = new Uint8Array(16); let c = 0;
    for (let i = 15; i >= 0; i--) { const v = (b[i] << 1) | c; o[i] = v & 255; c = v >> 8; }
    if (b[0] & 0x80) o[15] ^= 0x87; return o; };
  const xor = (a, b) => a.map((v, i) => v ^ b[i]);
  function cmac(m) { const K1 = dbl(E(new Uint8Array(16))); let x = new Uint8Array(16);
    const n = m.length / 16; for (let i = 0; i < n - 1; i++) x = E(xor(x, m.slice(16 * i, 16 * i + 16)));
    return E(xor(xor(x, m.slice(16 * (n - 1))), K1)); }
  async function inflate(u8) {
    if (typeof DecompressionStream === 'undefined') { if (typeof pako !== 'undefined') return pako.inflate(u8); throw new Error('inflate unavailable'); }
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([u8]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer()); }
  async function decrypt(data) { const n = data.length;
    const p = new Uint8Array(n); for (let i = 0; i < n; i++) p[i] = data[n - 1 - i] ^ ((n - i * n) & 255);
    const ct = p.subarray(0, n - 16);
    const iv = new Uint8Array(32); iv.fill(16, 16);
    const ctr = cmac(iv); const out = new Uint8Array(ct.length);
    for (let i = 0; i < ct.length; i += 16) { const ks = E(ctr);
      for (let j = 0; j < 16 && i + j < ct.length; j++) out[i + j] = ct[i + j] ^ ks[j];
      for (let k = 15; k >= 0; k--) { ctr[k] = (ctr[k] + 1) & 255; if (ctr[k]) break; } }
    const m = out.length; for (let i = 0; i < m; i++) out[i] ^= (m - i) & 255;
    const xml = await inflate(out.subarray(4));
    return new TextDecoder('utf-8').decode(xml); }
  return { decrypt, _Q: Q, _h: h, _E: E, _encryptBlock: encryptBlock, _makeKey: makeKey };
})();
if (typeof module !== 'undefined') module.exports = PKT;
