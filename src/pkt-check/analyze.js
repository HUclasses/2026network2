// ---- 授業回ごとの要件（新しい回はここに足す） ----
const SPECS = {
  '3': {
    label: '第3回 ルータとスイッチ', pages: { table: 'p.28', diagram: 'p.27', steps: 'p.29', trouble: 'p.30' },
    routerModel: '2811', switchModel: '2950T', pcModel: 'PC-PT',
    routers: { RT0: { if: { 'FastEthernet0/0': '10.3.1.1/24', 'FastEthernet0/1': '10.3.2.1/24' }, routes: [] } },
    switches: { SW1: { ip: '10.3.1.2/24', gw: '10.3.1.1' }, SW2: { ip: '10.3.2.2/24', gw: '10.3.2.1' } },
    pcs: { PC0: { ip: '10.3.1.11/24', gw: '10.3.1.1' }, PC1: { ip: '10.3.1.12/24', gw: '10.3.1.1' },
           PC2: { ip: '10.3.2.11/24', gw: '10.3.2.1' }, PC3: { ip: '10.3.2.12/24', gw: '10.3.2.1' } },
    enable: 'class', routerLogin: 'telnet', vtyPassword: 'cisco',
    shot: { from: 'PC1', to: 'SW2', how: 'telnet' },
    stages: [
      { name: '確認①', page: 'p.9', need: [['pc', 'PC0'], ['count', 'Switch', 'SW1（2950T）を置いて PC0 とつなぐ']] },
      { name: '確認②', page: 'p.16', need: [['rhost', 'RT0'], ['rif', 'RT0'], ['pc', 'PC2'], ['ping', 'PC0>PC2']] },
      { name: '確認③', page: 'p.23', need: [['sw', 'SW1'], ['secret', 'SW1'], ['vty', 'SW1'], ['reach', 'PC2>SW1']] },
      { name: '実習', page: 'p.26〜29', need: [['pc', 'PC1'], ['pc', 'PC3'], ['secret', 'RT0'], ['vty', 'RT0'], ['sw', 'SW2'], ['secret', 'SW2'], ['vty', 'SW2'], ['allping'], ['allreach'], ['nofix']] },
    ],
  },
  '4': {
    label: '第4回 ルータ2台のネットワークとSSH', pages: { table: 'p.35', diagram: 'p.32', steps: 'p.34', ssh: 'p.26', trouble: '確認①〜③の「うまくいかないとき」' },
    routerModel: '2811', switchModel: '2950T', pcModel: 'PC-PT',
    routers: {
      RT1: { if: { 'FastEthernet0/0': '10.4.1.1/24', 'FastEthernet0/1': '10.4.3.1/24' }, routes: [{ net: '10.4.2.0/24', via: '10.4.3.2' }] },
      RT2: { if: { 'FastEthernet0/0': '10.4.3.2/24', 'FastEthernet0/1': '10.4.2.1/24' }, routes: [{ net: '10.4.1.0/24', via: '10.4.3.1' }] } },
    switches: { SW1: { ip: '10.4.1.2/24', gw: '10.4.1.1' }, SW2: { ip: '10.4.2.2/24', gw: '10.4.2.1' } },
    pcs: { PC0: { ip: '10.4.1.11/24', gw: '10.4.1.1' }, PC1: { ip: '10.4.1.12/24', gw: '10.4.1.1' },
           PC2: { ip: '10.4.2.11/24', gw: '10.4.2.1' }, PC3: { ip: '10.4.2.12/24', gw: '10.4.2.1' } },
    enable: 'class', routerLogin: 'ssh', vtyPassword: 'cisco', sshUserPassword: 'cisco',
    shot: { from: 'PC3', to: 'RT1', how: 'ssh' },
    stages: [
      { name: '確認①', page: 'p.15', need: [['rhost', 'RT1'], ['rhost', 'RT2'], ['rif', 'RT1'], ['rif', 'RT2'], ['routes', 'RT1'], ['routes', 'RT2'], ['pc', 'PC0'], ['pc', 'PC2'], ['ping', 'PC0>PC2']] },
      { name: '確認②', page: 'p.19', need: [['secret', 'RT1'], ['vtyorssh', 'RT1']] },
      { name: '確認③', page: 'p.28', need: [['ssh', 'RT1'], ['reach', 'PC0>RT1']] },
      { name: '実習', page: 'p.32〜35', need: [['pc', 'PC1'], ['pc', 'PC3'], ['secret', 'RT2'], ['ssh', 'RT2'], ['sw', 'SW1'], ['secret', 'SW1'], ['vty', 'SW1'], ['sw', 'SW2'], ['secret', 'SW2'], ['vty', 'SW2'], ['allping'], ['allreach'], ['nofix']] },
    ],
  },
};

const NET = (() => {
  const ip2n = s => { const p = String(s || '').split('.').map(Number); if (p.length !== 4 || p.some(x => !(x >= 0 && x <= 255))) return null; return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0; };
  const mask2len = m => { const n = ip2n(m); if (n === null) return null; let l = 0; while (l < 32 && (n & (0x80000000 >>> l))) l++; return ((n << l) >>> 0) === 0 ? l : null; };
  const len2mask = l => l === 0 ? 0 : (0xFFFFFFFF << (32 - l)) >>> 0;
  const n2ip = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  const same = (a, b, len) => { const A = ip2n(a), B = ip2n(b); if (A === null || B === null || len == null) return false; const m = len2mask(len); return ((A & m) >>> 0) === ((B & m) >>> 0); };
  const netOf = (ip, len) => n2ip((ip2n(ip) & len2mask(len)) >>> 0) + '/' + len;
  const cidr = s => { const [ip, l] = s.split('/'); return { ip, len: Number(l), mask: n2ip(len2mask(Number(l))) }; };
  return { ip2n, mask2len, len2mask, n2ip, same, netOf, cidr };
})();

// ---- pkt の XML から機器・配線を取り出す ----
function readNetwork(doc) {
  const kids = (el, tag) => el ? Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.nodeName === tag) : [];
  const kid = (el, tag) => kids(el, tag)[0] || null;
  const txt = (el, tag) => { const k = kid(el, tag); return k ? (k.textContent || '').trim() : ''; };
  const root = doc.documentElement;
  const net = kid(root, 'NETWORK');
  const devs = [], byRef = {};
  for (const d of kids(kid(net, 'DEVICES'), 'DEVICE')) {
    const e = kid(d, 'ENGINE'), t = kid(e, 'TYPE');
    const dev = { kind: (t && t.textContent || '').trim(), model: t ? t.getAttribute('model') || '' : '', name: txt(e, 'NAME'),
      ref: txt(e, 'SAVE_REF_ID').replace('save-ref-id:', ''), ports: [], gateway: txt(e, 'GATEWAY') };
    const rc = kid(e, 'RUNNINGCONFIG');
    if (rc) dev.cfg = kids(rc, 'LINE').map(l => l.textContent || '');
    const sec = kid(e, 'SECURITY');
    if (sec) dev.rsaBits = Number(txt(sec, 'MODULUS_BITS') || 0), dev.rsaKey = !!txt(sec, 'RSA_KEY');
    for (const p of Array.from(e.getElementsByTagName('PORT'))) {
      const mac = txt(p, 'MACADDRESS'); if (!mac) continue;
      dev.ports.push({ mac, ip: txt(p, 'IP'), mask: txt(p, 'SUBNET'), gw: txt(p, 'PORT_GATEWAY'), dhcp: txt(p, 'PORT_DHCP_ENABLE') === 'true' });
    }
    devs.push(dev); byRef[dev.ref] = dev;
  }
  const links = [];
  for (const l of kids(kid(net, 'LINKS'), 'LINK')) {
    const c = kid(l, 'CABLE'); if (!c) continue;
    const ps = kids(c, 'PORT').map(p => p.textContent.trim());
    const a = byRef[txt(c, 'FROM').replace('save-ref-id:', '')], b = byRef[txt(c, 'TO').replace('save-ref-id:', '')];
    if (a && b) links.push({ a, ap: ps[0], b, bp: ps[1], type: txt(c, 'TYPE') });
  }
  return { version: txt(root, 'VERSION'), devs, links };
}

function parseIOS(lines) {
  const r = { hostname: null, secret: null, enablePassword: null, vty: {}, ifaces: {}, dgw: null, routes: [], users: [], domain: null, sshVer: null };
  let cur = null;
  for (const raw of lines) {
    const s = raw.replace(/\s+$/, ''); if (!s || s === '!') { cur = null; continue; }
    if (!/^\s/.test(s)) { cur = null; let m;
      if ((m = /^hostname (\S+)/.exec(s))) r.hostname = m[1];
      else if ((m = /^enable secret (?:\d+ )?(\S+)/.exec(s))) r.secret = m[1];
      else if ((m = /^enable password (?:\d+ )?(\S+)/.exec(s))) r.enablePassword = m[1];
      else if ((m = /^ip default-gateway (\S+)/.exec(s))) r.dgw = m[1];
      else if ((m = /^ip route (\S+) (\S+) (\S+)/.exec(s))) r.routes.push({ dest: m[1], mask: m[2], via: m[3] });
      else if ((m = /^ip domain-name (\S+)/.exec(s))) r.domain = m[1];
      else if ((m = /^ip ssh version (\d)/.exec(s))) r.sshVer = m[1];
      else if ((m = /^username (\S+)(?: privilege \d+)? (secret|password) (?:\d+ )?(\S+)/.exec(s))) r.users.push({ name: m[1], kind: m[2], value: m[3] });
      else if ((m = /^interface (\S+)/.exec(s))) { cur = { t: 'if', n: m[1] }; r.ifaces[m[1]] = { ip: null, mask: null, shutdown: false, vlan: null }; }
      else if ((m = /^line vty (\d+)(?: (\d+))?/.exec(s))) { cur = { t: 'vty', n: m[1] + ' ' + (m[2] || m[1]) }; r.vty[cur.n] = { password: null, login: null, transport: null }; }
    } else if (cur) { const t = s.trim(); let m;
      if (cur.t === 'if') { const i = r.ifaces[cur.n];
        if ((m = /^ip address (\S+) (\S+)/.exec(t))) { i.ip = m[1]; i.mask = m[2]; }
        else if (t === 'shutdown') i.shutdown = true;
        else if ((m = /^switchport access vlan (\d+)/.exec(t))) i.vlan = m[1];
      } else if (cur.t === 'vty') { const v = r.vty[cur.n];
        if ((m = /^password (?:\d+ )?(\S+)/.exec(t))) v.password = m[1];
        else if (/^login local/.test(t)) v.login = 'local';
        else if (/^login/.test(t)) v.login = 'line';
        else if ((m = /^transport input (.+)/.exec(t))) v.transport = m[1].trim();
      }
    }
  }
  return r;
}

// ---- 診断本体 ----
function diagnose(xmlDoc, specKey, opts = {}) {
  const spec = SPECS[specKey], P = spec.pages;
  const { devs, links, version } = readNetwork(xmlDoc);
  const items = []; // {level:'fix'|'check'|'info', who, text, hint}
  const add = (level, who, text, hint) => items.push({ level, who, text, hint: hint || '' });
  const routers = devs.filter(d => d.kind === 'Router'), switches = devs.filter(d => d.kind === 'Switch'), pcs = devs.filter(d => d.kind === 'Pc');
  for (const d of [...routers, ...switches]) d.ios = parseIOS(d.cfg || []);
  const label = d => (d.ios && d.ios.hostname && d.ios.hostname !== d.name) ? `${d.ios.hostname}（表示名 ${d.name}）` : d.name;
  const linked = new Set(); links.forEach(l => { linked.add(l.a); linked.add(l.b); });

  // 1. 機器
  const nR = Object.keys(spec.routers).length, nS = Object.keys(spec.switches).length, nP = Object.keys(spec.pcs).length;
  const badR = routers.filter(d => d.model !== spec.routerModel), badS = switches.filter(d => !d.model.startsWith(spec.switchModel + '-') && d.model !== spec.switchModel);
  if (routers.length !== nR) add('fix', 'ファイル全体', `ルータが ${routers.length} 台あります（この回は ${nR} 台）。`, `構成図（${P.diagram}）と見比べよう。どこにもつながっていない機器が残っていないかも確かめる。`);
  if (switches.length !== nS) add('fix', 'ファイル全体', `スイッチが ${switches.length} 台あります（この回は ${nS} 台）。`, `構成図（${P.diagram}）と見比べよう。`);
  if (pcs.length !== nP) add('fix', 'ファイル全体', `PC が ${pcs.length} 台あります（この回は ${nP} 台）。`, `構成図（${P.diagram}）と見比べよう。`);
  badR.forEach(d => add('check', label(d), `ルータの機種が ${d.model} です（指定は ${spec.routerModel}）。`, '機種が違うと、コマンドやポート名が資料と変わることがある。'));
  badS.forEach(d => add('check', label(d), `スイッチの機種が ${d.model} です（指定は ${spec.switchModel}）。`, '指定どおりの機種で作ろう。'));
  devs.filter(d => ['Router', 'Switch', 'Pc'].includes(d.kind) && !linked.has(d)).forEach(d => add('check', d.name, 'どこにもケーブルがつながっていません。', '使わない機器なら削除しよう。'));

  // 2. ケーブル
  const role = d => d.kind === 'Switch' ? 'S' : 'H';
  const linkUp = new Set();
  for (const l of links) {
    if (!['Router', 'Switch', 'Pc'].includes(l.a.kind) || !['Router', 'Switch', 'Pc'].includes(l.b.kind)) continue;
    const need = role(l.a) === role(l.b) ? 'eCrossOver' : 'eStraightThrough';
    if (l.type !== need) add('fix', `${l.a.name}–${l.b.name}`, `ケーブルの種類が違います（${need === 'eCrossOver' ? 'クロス' : 'ストレート'}でつなぐ所）。`, 'Packet Tracer の構成図で、リンクの両端が赤い▼になっていないか見てみよう。ルータどうしはクロス、それ以外はストレート。');
    else linkUp.add(l);
  }

  // 機器を要件の名前に対応づける（ホスト名 → 表示名 → アドレス）
  const pick = (list, name, ipOf) => list.find(d => d.ios && d.ios.hostname === name) || list.find(d => d.name === name) || (ipOf ? list.find(ipOf) : null);
  const mapR = {}, mapS = {}, mapP = {};
  for (const [n, r] of Object.entries(spec.routers)) mapR[n] = pick(routers, n, d => Object.entries(r.if).every(([k, v]) => d.ios.ifaces[k] && d.ios.ifaces[k].ip === NET.cidr(v).ip));
  for (const [n, s] of Object.entries(spec.switches)) mapS[n] = pick(switches, n, d => d.ios.ifaces.Vlan1 && d.ios.ifaces.Vlan1.ip === NET.cidr(s.ip).ip);
  const pcIP = d => { const p = d.ports.find(q => q.ip) || d.ports[0] || {}; return { ip: p.ip || '', mask: p.mask || '', gw: p.gw || d.gateway || '', dhcp: !!p.dhcp }; };
  for (const [n, p] of Object.entries(spec.pcs)) mapP[n] = pcs.find(d => pcIP(d).ip === NET.cidr(p.ip).ip) || pcs.find(d => d.name === n) || null;

  const checkEnable = (d, who) => { const io = d.ios;
    if (!io.secret && !io.enablePassword) add('fix', who, '特権パスワード（enable secret）が設定されていません。', `enable で特権モードに入れない。設定方法は ${P.steps} と第3回の資料へ。`);
    else if (!io.secret && io.enablePassword) add('fix', who, '特権パスワードが enable password で設定されています。', 'enable secret で設定しよう（設定ファイル上でハッシュ化され、そのままでは読めなくなる）。');
    else { const ok = MD5C.check(io.secret, spec.enable);
      if (ok === false) add('fix', who, `特権パスワード（enable secret）が ${spec.enable} ではないようです。`, '打ち間違いや、telnet 用のパスワードとの取り違えがないか。もう一度 enable secret を設定し直そう。');
      if (io.enablePassword) add('check', who, 'enable secret のほかに enable password も残っています。', 'secret が優先されるので動作はするが、no enable password で消しておこう。'); } };
  const vty04 = io => io.vty['0 4'] || io.vty['0 15'] || Object.entries(io.vty).find(([k]) => k.startsWith('0 '))?.[1] || null;
  const checkTelnetVty = (d, who) => { const v = vty04(d.ios);
    if (!v || !v.login) add('fix', who, 'line vty 0 4 に login が設定されていません。', 'telnet でログインできない（「Password required, but none set」や切断になる）。line vty 0 4 で password と login を設定しよう。');
    else if (v.login === 'line' && v.password !== spec.vtyPassword) add('fix', who, v.password ? `telnet 用のパスワード（line vty）が ${spec.vtyPassword} ではありません（${v.password} になっています）。` : 'telnet 用のパスワード（line vty の password）が設定されていません。', `特権パスワード（enable secret）と取り違えていないか確かめよう。設定値は ${P.diagram} の表。`);
    if (v && v.transport && !/telnet|all/.test(v.transport)) add('fix', who, `line vty が transport input ${v.transport} になっていて、telnet を受け付けません。`, 'スイッチは telnet でログインする設定にしよう。'); };

  // 3. ルータ
  for (const [n, r] of Object.entries(spec.routers)) {
    const d = mapR[n]; if (!d) { add('fix', n, `${n} が見つかりません。`, `ホスト名を ${n} にしたか、${P.diagram} の構成図と見比べよう。`); continue; }
    const io = d.ios, who = n;
    if (io.hostname !== n) add('fix', who, io.hostname && io.hostname !== 'Router' ? `ホスト名が ${io.hostname} になっています（正しくは ${n}）。` : `ホスト名が設定されていません（Router のまま）。`, '表示名（Display Name）を変えても、ホスト名は変わらない。CLI で hostname を設定し、プロンプトに名前が出るか確かめよう。');
    for (const [ifn, v] of Object.entries(r.if)) { const e = NET.cidr(v), i = io.ifaces[ifn];
      if (!i || !i.ip) add('fix', who, `${ifn} に IP アドレスが設定されていません。`, `show ip interface brief で確かめよう。設定値は ${P.table} の表。`);
      else if (i.ip !== e.ip || i.mask !== e.mask) add('fix', who, `${ifn} のアドレスが ${i.ip} ${i.mask} になっていて、表と違います。`, `${P.table} の表と見比べよう。ケーブルをつないだポート（Fa0/0・Fa0/1）が構成図と同じかも確かめる。`);
      if (i && i.shutdown) add('fix', who, `${ifn} が shutdown のままです。`, 'ルータのインタフェースは最初は止まっている。no shutdown で有効にし、show ip interface brief で up / up になるか確かめよう。'); }
    for (const rt of r.routes) { const e = NET.cidr(rt.net);
      const got = io.routes.filter(x => x.dest === e.ip && x.mask === e.mask);
      if (!got.length) add('fix', who, `${rt.net} への静的ルート（ip route）がありません。`, `${n} は、直接つながっていない ${rt.net} を知らない。show ip route に S の行があるか確かめよう（${P.steps}）。`);
      else if (!got.some(x => x.via === rt.via)) { const via = got[0].via;
        const own = Object.values(io.ifaces).some(i => i.ip === via);
        add('fix', who, `${rt.net} への静的ルートの「次に渡すルータ」が ${via} になっています。`, own ? '自分のインタフェースのアドレスを書いていないか。相手ルータの、ルータ間ネットワーク側のアドレスを書こう。' : '相手ルータの、ルータ間ネットワーク側のアドレスになっているか、構成図で確かめよう。'); } }
    io.routes.filter(x => !r.routes.some(rt => NET.cidr(rt.net).ip === x.dest)).forEach(x => add('check', who, `要件にない静的ルート（ip route ${x.dest} ${x.mask} ${x.via}）があります。`, '試しに入れたものなら、no ip route … で消しておこう。'));
    checkEnable(d, who);
    if (spec.routerLogin === 'telnet') checkTelnetVty(d, who);
    else { const v = vty04(io);
      if (!io.domain) add('fix', who, 'ip domain-name が設定されていません。', `SSH の鍵を作る前に必要（${P.ssh}）。`);
      if (!(d.rsaBits > 0 || d.rsaKey)) add('fix', who, 'SSH 用の RSA 鍵が作られていません。', `crypto key generate rsa で、鍵の長さ 1024 を指定しよう（${P.ssh}）。show ip ssh で確かめられる。`);
      else if (d.rsaBits && d.rsaBits < 768) add('fix', who, `RSA 鍵の長さが ${d.rsaBits} です。`, 'SSH バージョン 2 には 768 以上が必要。1024 で作り直そう。');
      if (!io.users.length) add('fix', who, 'username（SSH のユーザ名）が設定されていません。', `username 学籍番号 secret … を設定しよう（${P.ssh}）。`);
      for (const u of io.users) {
        if (u.name === '2024z999') add('fix', who, 'ユーザ名が例の 2024z999 のままです。', '自分の学籍番号に置き換えよう。');
        else if (opts.sid && u.name.toLowerCase() !== opts.sid.toLowerCase()) add('fix', who, `ユーザ名が ${u.name} になっていて、入力した学籍番号と違います。`, '打ち間違いがないか確かめよう。');
        if (u.kind === 'password') add('check', who, `username ${u.name} が password で設定されています。`, 'secret で設定しよう（ハッシュ化される）。');
        else if (MD5C.check(u.value, spec.sshUserPassword) === false) add('fix', who, `username ${u.name} のパスワードが ${spec.sshUserPassword} ではないようです。`, '打ち間違いがないか確かめ、username … secret … を設定し直そう。'); }
      if (!v || v.login !== 'local') add('fix', who, 'line vty 0 4 が login local になっていません。', 'ユーザ名とパスワードでログインするには login local。');
      if (!v || !v.transport || !/^ssh$/.test(v.transport)) add('fix', who, v && v.transport ? `line vty が transport input ${v.transport} になっています。` : 'line vty に transport input ssh がありません。', 'SSH だけを受け付けるには transport input ssh。telnet も受け付けたままだと、PART 3 で見た危険が残る。');
      if (io.sshVer !== '2') add('info', who, 'ip ssh version 2 が設定されていません。', `資料（${P.ssh}）では version 2 を指定している。`); }
  }

  // 4. スイッチ
  for (const [n, s] of Object.entries(spec.switches)) {
    const d = mapS[n]; if (!d) { add('fix', n, `${n} が見つかりません。`, `ホスト名を ${n} にしたか、${P.diagram} の構成図と見比べよう。`); continue; }
    const io = d.ios, who = n, e = NET.cidr(s.ip), v1 = io.ifaces.Vlan1;
    if (io.hostname !== n) add('fix', who, io.hostname && io.hostname !== 'Switch' ? `ホスト名が ${io.hostname} になっています（正しくは ${n}）。` : 'ホスト名が設定されていません（Switch のまま）。', '表示名（Display Name）を変えても、ホスト名は変わらない。CLI で hostname を設定し、プロンプトに名前が出るか確かめよう。');
    if (!v1 || !v1.ip) add('fix', who, 'interface vlan 1 に IP アドレスが設定されていません。', `スイッチを管理するためのアドレス。設定値は ${P.table} の表。`);
    else { if (v1.ip !== e.ip || v1.mask !== e.mask) add('fix', who, `vlan 1 のアドレスが ${v1.ip} ${v1.mask} になっていて、表と違います。`, `${P.table} の表と見比べよう。`);
      if (v1.shutdown) add('fix', who, 'interface vlan 1 が shutdown のままです。', 'no shutdown で有効にしよう。'); }
    if (!io.dgw) add('fix', who, 'ip default-gateway が設定されていません。', '別のネットワークの PC へ返事を送れないので、ルータの向こうから telnet できない。');
    else if (v1 && v1.ip && !NET.same(io.dgw, v1.ip, NET.mask2len(v1.mask))) add('fix', who, `ip default-gateway（${io.dgw}）が、${n} と同じネットワークにありません。`, `デフォルトゲートウェイは「${n} と同じネットワークにある、ルータのインタフェース」。構成図で、${n} の側にあるルータのアドレスを確かめよう。`);
    else if (io.dgw !== s.gw) add('fix', who, `ip default-gateway が ${io.dgw} になっていて、表と違います。`, `${P.table} の表と見比べよう。`);
    Object.entries(io.ifaces).filter(([k, i]) => k !== 'Vlan1' && i.ip).forEach(([k]) => add('check', who, `${k} に IP アドレスが設定されています。`, 'スイッチの IP アドレスは interface vlan 1 に設定する。'));
    Object.entries(io.ifaces).filter(([k, i]) => i.vlan && i.vlan !== '1').forEach(([k, i]) => add('check', who, `${k} が vlan ${i.vlan} に入っています。`, 'この回では VLAN は使わない。'));
    checkEnable(d, who); checkTelnetVty(d, who);
  }

  // 5. PC
  const seenIP = {};
  for (const [n, p] of Object.entries(spec.pcs)) {
    const d = mapP[n], e = NET.cidr(p.ip);
    if (!d) { const near = pcs.filter(x => !Object.values(mapP).includes(x));
      const cand = near.find(x => x.name === n);
      if (cand) { const c = pcIP(cand);
        add('fix', n, c.ip ? `${n} の IP アドレスが ${c.ip} になっていて、表と違います。` : `${n} に IP アドレスが設定されていません。`, `Desktop → IP Configuration で、${P.table} の表のとおりに設定しよう。`); }
      else add('fix', n, `表の ${n}（${e.ip}）にあたる PC が見つかりません。`, `PC を置いたか、IP アドレスを ${P.table} の表のとおりに設定したか確かめよう。`);
      continue; }
    const c = pcIP(d), who = d.name === n ? n : `${n}（表示名 ${d.name}）`;
    if (d.name !== n) add('check', who, `表で ${n} のアドレスの PC が、表示名 ${d.name} になっています。`, '表示名とアドレスの組み合わせを構成図と見比べよう（提出のスクリーンショットで使う PC を間違えやすい）。');
    if (!c.ip) { add('fix', who, 'IP アドレスが設定されていません。', `Desktop → IP Configuration で、${P.table} の表のとおりに設定しよう。`); continue; }
    if (c.ip !== e.ip) add('fix', who, `IP アドレスが ${c.ip} になっていて、表と違います。`, `${P.table} の表と見比べよう。`);
    if (c.dhcp) add('fix', who, 'DHCP になっています。', 'この回は Static で設定する。');
    if (c.mask !== e.mask) add('fix', who, `サブネットマスクが ${c.mask || '未設定'} になっています。`, `${P.table} の表と見比べよう。`);
    if (!c.gw || c.gw === '0.0.0.0') add('fix', who, 'デフォルトゲートウェイが設定されていません。', '別のネットワークへ送れない。');
    else if (c.gw === c.ip) add('fix', who, 'デフォルトゲートウェイに自分自身のアドレスを入れています。', `同じネットワークにある、ルータのインタフェースのアドレスにしよう（${P.table}）。`);
    else if (!NET.same(c.gw, c.ip, NET.mask2len(c.mask))) add('fix', who, `デフォルトゲートウェイ（${c.gw}）が、PC と同じネットワークにありません。`, '同じネットワークにある、ルータのインタフェースのアドレスにしよう。');
    else if (c.gw !== p.gw) add('fix', who, `デフォルトゲートウェイが ${c.gw} になっていて、表と違います。`, `${P.table} の表と見比べよう。`);
  }
  for (const d of pcs) { const c = pcIP(d); if (!c.ip) { if (!Object.values(mapP).includes(d) && !Object.keys(spec.pcs).includes(d.name)) add('fix', d.name, 'IP アドレスが設定されていません。', `${P.table} の表のとおりに設定しよう。`); continue; }
    (seenIP[c.ip] = seenIP[c.ip] || []).push(d.name); }
  Object.entries(seenIP).filter(([, v]) => v.length > 1).forEach(([ip, v]) => add('fix', v.join('・'), `同じ IP アドレス（${ip}）が複数の PC に設定されています。`, `${P.table} の表と見比べよう。`));

  // 6. 通信の見込み
  const sim = buildSim(devs, links, linkUp);
  const order = Object.keys(spec.pcs).map(n => mapP[n]).filter(Boolean);
  const pingRows = [];
  for (const a of order) for (const b of order) if (a !== b) pingRows.push({ a, b, ok: sim.ping(a, b) });
  const access = [];
  const targets = [...Object.keys(spec.routers).map(n => ({ n, d: mapR[n], how: spec.routerLogin })), ...Object.keys(spec.switches).map(n => ({ n, d: mapS[n], how: 'telnet' }))];
  for (const a of order) for (const t of targets) access.push({ a, t: t.n, how: t.how, ok: t.d ? sim.reach(a, t.d) : false });
  const fails = pingRows.filter(r => !r.ok);
  if (fails.length) add('fix', '通信', `PC どうしの ping が届かない組み合わせがあります（${fails.length} 組）。`, `下の「通信の見込み」で、どこから届かないかを見て、近いところから順に確かめよう（${P.trouble}）。`);
  const afails = access.filter(r => !r.ok);
  if (afails.length && !fails.length) add('fix', '通信', `ログインできない組み合わせがあります（${afails.map(r => `${pname(r.a, mapP)}→${r.t}`).slice(0, 6).join('、')}${afails.length > 6 ? ' など' : ''}）。`, '届かない相手のデフォルトゲートウェイや、ログインの設定を確かめよう。');

  // ファイル名・学籍番号
  if (opts.fileName && opts.sid) { const re = new RegExp('^' + opts.sid.replace(/[^0-9a-z]/gi, '') + '_\\d{6}\\.pkt$', 'i');
    if (!re.test(opts.fileName)) add('check', 'ファイル名', `ファイル名が「${opts.fileName}」になっています。`, `「学籍番号_授業日6桁.pkt」（例：${opts.sid}_${specKey === '3' ? '261015' : '261019'}.pkt）にして提出しよう。`); }

  // 一覧表
  const summary = {
    routers: Object.keys(spec.routers).map(n => ({ n, d: mapR[n] })), switches: Object.keys(spec.switches).map(n => ({ n, d: mapS[n] })),
    pcs: Object.keys(spec.pcs).map(n => ({ n, d: mapP[n], c: mapP[n] ? pcIP(mapP[n]) : null })),
  };
  // 7. どの確認まで進んだか
  const stages = (spec.stages || []).map(st => {
    const res = st.need.map(([t, a, lab]) => stageCheck(t, a, lab, { spec, routers, switches, mapR, mapS, mapP, pcIP, sim, items, pingRows, access, opts, vty04 }));
    let miss = res.filter(r => !r.ok).map(r => r.label);
    if (miss.length > 1) miss = miss.filter(l => !l.startsWith('「確かめること」'));
    return { name: st.name, page: st.page, ok: res.every(r => r.ok), missing: miss };
  });
  return { version, items, pingRows, access, summary, spec, mapP, stages };
}
function stageCheck(t, a, lab, c) {
  const { spec, mapR, mapS, mapP, pcIP, sim } = c;
  const ok = (v, l) => ({ ok: !!v, label: lab || l });
  const secretOK = d => !!(d && d.ios.secret && MD5C.check(d.ios.secret, spec.enable) !== false);
  const vty = d => (d && c.vty04(d.ios)) || {};
  const telnetOK = d => { const v = vty(d); return v.login === 'line' && v.password === spec.vtyPassword; };
  const sshOK = d => { if (!d) return false; const io = d.ios, v = vty(d);
    return !!io.domain && (d.rsaBits > 0 || d.rsaKey) && io.users.length > 0 && !io.users.some(u => u.name === '2024z999') &&
      (!c.opts.sid || io.users.some(u => u.name.toLowerCase() === c.opts.sid.toLowerCase())) && v.login === 'local' && /^ssh$/.test(v.transport || ''); };
  const dev = n => mapR[n] || mapS[n];
  switch (t) {
    case 'pc': { const d = mapP[a], e = NET.cidr(spec.pcs[a].ip), x = d ? pcIP(d) : {}; return ok(d && x.ip === e.ip && x.mask === e.mask && x.gw === spec.pcs[a].gw, `${a} のアドレス・マスク・デフォルトGW`); }
    case 'count': return ok((a === 'Switch' ? c.switches : c.routers).length > 0, a);
    case 'rhost': return ok(mapR[a] && mapR[a].ios.hostname === a, `${a} のホスト名`);
    case 'rif': { const d = mapR[a]; return ok(d && Object.entries(spec.routers[a].if).every(([k, v]) => { const i = d.ios.ifaces[k], e = NET.cidr(v); return i && i.ip === e.ip && i.mask === e.mask && !i.shutdown; }), `${a} の ${Object.keys(spec.routers[a].if).map(k => k.replace('FastEthernet', 'Fa')).join('・')}（アドレスと no shutdown）`); }
    case 'routes': { const d = mapR[a]; return ok(d && spec.routers[a].routes.every(rt => { const e = NET.cidr(rt.net); return d.ios.routes.some(x => x.dest === e.ip && x.mask === e.mask && x.via === rt.via); }), `${a} の静的ルート（ip route）`); }
    case 'secret': return ok(secretOK(dev(a)), `${a} の特権パスワード（enable secret）`);
    case 'vty': return ok(telnetOK(dev(a)), `${a} の telnet 用パスワード（line vty の password・login）`);
    case 'vtyorssh': return ok(telnetOK(dev(a)) || vty(dev(a)).login === 'local', `${a} の line vty（password・login）`);
    case 'ssh': return ok(sshOK(dev(a)), `${a} の SSH（ip domain-name・RSA 鍵・username・login local・transport input ssh）`);
    case 'sw': { const d = mapS[a], s = spec.switches[a], e = NET.cidr(s.ip), v = d && d.ios.ifaces.Vlan1; return ok(d && d.ios.hostname === a && v && v.ip === e.ip && v.mask === e.mask && !v.shutdown && d.ios.dgw === s.gw, `${a} のホスト名・vlan 1・ip default-gateway`); }
    case 'ping': { const [x, y] = a.split('>'); return ok(mapP[x] && mapP[y] && sim.ping(mapP[x], mapP[y]), `${x} → ${y} の ping`); }
    case 'reach': { const [x, y] = a.split('>'); const how = mapR[y] ? spec.routerLogin : 'telnet'; return ok(mapP[x] && dev(y) && sim.reach(mapP[x], dev(y)), `${x} → ${y} の ${how === 'ssh' ? 'SSH' : 'telnet'}`); }
    case 'allping': return ok(Object.keys(spec.pcs).every(n => mapP[n]) && c.pingRows.every(r => r.ok), 'すべての PC どうしの ping');
    case 'allreach': return ok(Object.keys(spec.pcs).every(n => mapP[n]) && c.access.every(r => r.ok), 'どの PC からもルータ・スイッチにログインできる');
    case 'nofix': return ok(!c.items.some(i => i.level === 'fix'), '「確かめること」の要修正をなくす');
  }
  return ok(false, t);
}
function pname(d, mapP) { const n = Object.keys(mapP).find(k => mapP[k] === d); return n || d.name; }

// ---- 届くかどうかの簡易シミュレーション（L2 セグメント＋静的ルート） ----
function buildSim(devs, links, linkUp) {
  const parent = new Map(); devs.forEach(d => parent.set(d, d));
  const f = x => { while (parent.get(x) !== x) x = parent.get(x); return x; };
  const swPortUp = (d, port) => { if (d.kind !== 'Switch') return true; const i = d.ios.ifaces[port]; return !(i && i.shutdown); };
  const up = links.filter(l => linkUp.has(l) && swPortUp(l.a, l.ap) && swPortUp(l.b, l.bp));
  up.filter(l => l.a.kind === 'Switch' && l.b.kind === 'Switch').forEach(l => parent.set(f(l.a), f(l.b)));
  const segs = new Map(); const segOf = new Map(); // endpoint key -> seg id
  const addEp = (seg, dev, port) => { if (!segs.has(seg)) segs.set(seg, []); segs.get(seg).push({ dev, port }); };
  up.forEach((l, i) => {
    const sa = l.a.kind === 'Switch', sb = l.b.kind === 'Switch';
    if (sa && !sb) addEp(f(l.a), l.b, l.bp); else if (sb && !sa) addEp(f(l.b), l.a, l.ap);
    else if (!sa && !sb) { const k = 'd' + i; addEp(k, l.a, l.ap); addEp(k, l.b, l.bp); } });
  devs.filter(d => d.kind === 'Switch').forEach(d => addEp(f(d), d, 'Vlan1'));
  const addr = (dev, port) => {
    if (dev.kind === 'Pc') { const p = dev.ports.find(q => q.ip) || {}; return p.ip ? { ip: p.ip, len: NET.mask2len(p.mask) } : null; }
    const i = dev.ios && dev.ios.ifaces[port]; if (!i || !i.ip || i.shutdown) return null; return { ip: i.ip, len: NET.mask2len(i.mask) }; };
  for (const [k, eps] of segs) eps.forEach(e => { e.a = addr(e.dev, e.port); segOf.set(e.dev.name + '|' + e.port + '|' + e.dev.ref, k); });
  const findInSeg = (seg, ip) => (segs.get(seg) || []).find(e => e.a && e.a.ip === ip);
  const segsOfDev = dev => [...segs.entries()].filter(([, eps]) => eps.some(e => e.dev === dev)).map(([k]) => k);
  const hostParams = dev => { if (dev.kind === 'Pc') { const p = dev.ports.find(q => q.ip) || {}; return { ip: p.ip, len: NET.mask2len(p.mask), gw: p.gw || dev.gateway }; }
    const v = dev.ios.ifaces.Vlan1; return v && v.ip && !v.shutdown ? { ip: v.ip, len: NET.mask2len(v.mask), gw: dev.ios.dgw } : null; };
  function routerForward(r, dst, depth) {
    if (depth > 8) return null;
    for (const [pn, i] of Object.entries(r.ios.ifaces)) if (i.ip === dst && !i.shutdown) return r;
    const conn = [];
    for (const k of segsOfDev(r)) for (const e of segs.get(k)) if (e.dev === r && e.a) conn.push({ seg: k, a: e.a });
    for (const c of conn) if (NET.same(dst, c.a.ip, c.a.len)) { const t = findInSeg(c.seg, dst); return t ? t.dev : null; }
    let best = null;
    for (const rt of r.ios.routes) { const len = NET.mask2len(rt.mask); if (len == null) continue;
      if (NET.same(dst, rt.dest, len) && (!best || len > best.len)) best = { len, via: rt.via }; }
    if (!best) return null;
    for (const c of conn) if (NET.same(best.via, c.a.ip, c.a.len)) { const nh = findInSeg(c.seg, best.via); return nh && nh.dev.kind === 'Router' ? routerForward(nh.dev, dst, depth + 1) : null; }
    return null; }
  function deliver(src, dst) {
    if (!dst) return null;
    if (src.kind === 'Router') return routerForward(src, dst, 0);
    const h = hostParams(src); if (!h || !h.ip || h.len == null) return null;
    const segK = segsOfDev(src).find(k => segs.get(k).some(e => e.dev === src && e.a && e.a.ip === h.ip)); if (segK === undefined) return null;
    if (NET.same(dst, h.ip, h.len)) { const t = findInSeg(segK, dst); if (t) return t.dev;
      // プロキシ ARP：ルータが自分の別の側にある宛先の代わりに応答する（Cisco の既定動作）
      for (const e of segs.get(segK)) if (e.dev.kind === 'Router' && e.a && !NET.same(dst, e.a.ip, e.a.len)) { const r = routerForward(e.dev, dst, 0); if (r) return r; }
      return null; }
    if (!h.gw) return null; const g = findInSeg(segK, h.gw); if (!g || g.dev.kind !== 'Router') return null;
    return routerForward(g.dev, dst, 0); }
  const ipOf = d => { if (d.kind === 'Router') return Object.values(d.ios.ifaces).filter(i => i.ip && !i.shutdown).map(i => i.ip); const h = hostParams(d); return h && h.ip ? [h.ip] : []; };
  const twoWay = (a, b) => { const A = ipOf(a); if (!A.length) return false; return ipOf(b).some(bip => deliver(a, bip) === b && A.some(aip => deliver(b, aip) === a)); };
  return { ping: twoWay, reach: twoWay };
}
if (typeof module !== 'undefined') module.exports = { SPECS, diagnose, readNetwork, parseIOS };
