// ---- MD5 + md5-crypt ($1$) : enable secret / username secret の照合用 ----
const MD5C = (() => {
  function md5(bytes) {
    const K = new Int32Array(64), S = [7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
    const len = bytes.length, nb = ((len + 8) >> 6) + 1, M = new Int32Array(nb * 16);
    for (let i = 0; i < len; i++) M[i >> 2] |= bytes[i] << ((i % 4) * 8);
    M[len >> 2] |= 0x80 << ((len % 4) * 8); M[nb * 16 - 2] = len * 8;
    let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    for (let o = 0; o < M.length; o += 16) { let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) { let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; } else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; } else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        const s = S[(i >> 4) * 4 + (i % 4)], t = (A + F + K[i] + M[o + g]) | 0;
        A = D; D = C; C = B; B = (B + ((t << s) | (t >>> (32 - s)))) | 0; }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0; }
    const out = []; for (const v of [a0, b0, c0, d0]) for (let i = 0; i < 4; i++) out.push((v >>> (8 * i)) & 255);
    return out; }
  const enc = s => Array.from(new TextEncoder().encode(s));
  const I64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  function crypt(pw, salt) { const P = enc(pw), Sa = enc(salt), magic = enc('$1$');
    let ctx = [...P, ...magic, ...Sa]; const alt = md5([...P, ...Sa, ...P]);
    for (let pl = P.length; pl > 0; pl -= 16) ctx.push(...alt.slice(0, Math.min(16, pl)));
    for (let i = P.length; i; i >>= 1) ctx.push(i & 1 ? 0 : P[0]);
    let f = md5(ctx);
    for (let i = 0; i < 1000; i++) { let c = [];
      c.push(...(i & 1 ? P : f)); if (i % 3) c.push(...Sa); if (i % 7) c.push(...P); c.push(...(i & 1 ? f : P));
      f = md5(c); }
    let r = ''; const to64 = (v, n) => { while (n--) { r += I64[v & 63]; v >>= 6; } };
    for (const [a, b, c] of [[0,6,12],[1,7,13],[2,8,14],[3,9,15],[4,10,5]]) to64((f[a] << 16) | (f[b] << 8) | f[c], 4);
    to64(f[11], 2); return '$1$' + salt + '$' + r; }
  // "enable secret 5 $1$mERr$..." の末尾ハッシュが pw と一致するか
  function check(hash, pw) { const m = /^\$1\$([^$]{0,8})\$/.exec(hash || ''); if (!m) return null; return crypt(pw, m[1]) === hash; }
  return { crypt, check };
})();
if (typeof module !== 'undefined') module.exports = MD5C;
