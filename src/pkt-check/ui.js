// ---- 画面 ----
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const keys = Object.keys(SPECS);
  const lesson = window.PKT_LESSON;
  const sid = $('#sid'); sid.value = store.get('pktcheck.sid') || '';
  let last = null;
  { const p = SPECS[lesson].pages; $('#lesson-note').innerHTML = `<span class="nw">${esc(SPECS[lesson].label)}。</span><wbr>資料の <span class="nw">${p.diagram}（構成図）</span>と<wbr> <span class="nw">${p.table}（アドレスの表）。</span>`; }
  if (SPECS[lesson].routerLogin === 'ssh') $('#sid-note').innerHTML = '入力すると、<wbr>SSH のユーザ名と<wbr>ファイル名も<wbr>確かめます。';
  sid.addEventListener('change', () => { store.set('pktcheck.sid', sid.value.trim()); if (last) run(last); });

  const drop = $('#drop'), file = $('#file');
  drop.addEventListener('click', () => file.click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) load(f); });
  file.addEventListener('change', () => { if (file.files[0]) load(file.files[0]); file.value = ''; });

  async function load(f) {
    $('#out').innerHTML = `<div class="status"><span class="verdict">読み取り中…</span><span class="file">${esc(f.name)}</span></div>`;
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const xml = await PKT.decrypt(buf);
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      if (doc.getElementsByTagName('parsererror').length || doc.documentElement.nodeName !== 'PACKETTRACER5') throw new Error('xml');
      last = { name: f.name, doc }; run(last);
    } catch (e) {
      last = null;
      $('#out').innerHTML = `<div class="err"><b>読み取れませんでした。</b> ${esc(f.name)} は、Packet Tracer で保存した .pkt ファイルではないか、古い形式のようです。Packet Tracer 9 で開き、File → Save As で保存し直してから読み込んでください。</div>`;
    }
  }

  function run({ name, doc }) {
    const id = sid.value.trim();
    // 別の回のファイルらしいとき（PC のアドレスの先頭 2 つで判定）
    const pre = ip => String(ip || '').split('.').slice(0, 2).join('.');
    const specPre = k => pre(NET.cidr(Object.values(SPECS[k].pcs)[0].ip).ip);
    const mine = readNetwork(doc).devs.filter(d => d.kind === 'Pc').map(d => pre((d.ports.find(q => q.ip) || {}).ip)).filter(x => x && x !== '.');
    let notice = '';
    if (mine.length && !mine.includes(specPre(lesson))) {
      const other = keys.find(k => k !== lesson && mine.includes(specPre(k)));
      notice = other ? `このファイルは${SPECS[other].label.split(' ')[0]}のもののようです（PC のアドレスが ${specPre(other)}.x.x）。このページは${SPECS[lesson].label.split(' ')[0]}用です。ファイルを確かめてください。`
                     : `PC のアドレスが、${SPECS[lesson].label.split(' ')[0]}の表（${SPECS[lesson].pages.table}）と違います。このページは${SPECS[lesson].label.split(' ')[0]}用です。`;
    }
    const r = diagnose(doc, lesson, { sid: /^\d{4}[a-z]\d{3}$/i.test(id) ? id : '', fileName: name });
    const v = toView(r, name); v.notice = notice; render(v);
  }

  function addr(ip, len) {
    if (!ip) return '<span class="ng">未設定</span>';
    if (len == null || len % 8) return `<span class="mono">${esc(ip)}${len != null ? '/' + len : ''}</span>`;
    const o = ip.split('.'), k = len / 8;
    return `<span class="mono addr"><span class="net">${esc(o.slice(0, k).join('.'))}.</span><span class="host">${esc(o.slice(k).join('.'))}</span><span class="net">/${len}</span></span>`;
  }
  const short = n => n.replace('FastEthernet', 'Fa').replace('GigabitEthernet', 'Gi');

  function toView(r, name, want) {
    const spec = r.spec, rows = [];
    for (const { n, d } of r.summary.routers) {
      if (!d) { rows.push({ role: 'ルータ', n, host: '—', addr: '<span class="ng">見つからない</span>', gw: '', login: '' }); continue; }
      const io = d.ios;
      const a = Object.keys(spec.routers[n].if).map(k => { const i = io.ifaces[k]; return `${short(k)} ${i && i.ip ? addr(i.ip, NET.mask2len(i.mask)) : '<span class="ng">未設定</span>'}${i && i.shutdown ? ' <span class="ng">shutdown</span>' : ''}`; }).join('<br>');
      const routes = io.routes.map(x => `${addr(x.dest, NET.mask2len(x.mask))} → <span class="mono">${esc(x.via)}</span>`).join('<br>');
      const v = io.vty['0 4'] || io.vty['0 15'] || {};
      const login = spec.routerLogin === 'ssh' ? (v.transport === 'ssh' && v.login === 'local' ? `SSH（${esc(io.users.map(u => u.name).join(', ') || 'ユーザなし')}）` : (v.login ? 'telnet' : '—')) : (v.login ? 'telnet' : '—');
      rows.push({ role: 'ルータ', n, host: io.hostname || '—', addr: a + (routes ? `<br><span class="sub">静的ルート</span><br>${routes}` : ''), gw: '', login });
    }
    for (const { n, d } of r.summary.switches) {
      if (!d) { rows.push({ role: 'スイッチ', n, host: '—', addr: '<span class="ng">見つからない</span>', gw: '', login: '' }); continue; }
      const io = d.ios, v1 = io.ifaces.Vlan1 || {}, v = io.vty['0 4'] || io.vty['0 15'] || {};
      rows.push({ role: 'スイッチ', n, host: io.hostname || '—', addr: 'vlan1 ' + (v1.ip ? addr(v1.ip, NET.mask2len(v1.mask)) : '<span class="ng">未設定</span>'), gw: io.dgw ? addr(io.dgw, NET.mask2len(v1.mask)) : '<span class="ng">未設定</span>', login: v.login ? 'telnet' : '—' });
    }
    for (const { n, d, c } of r.summary.pcs) {
      if (!d) { rows.push({ role: 'PC', n, host: '—', addr: '<span class="ng">見つからない</span>', gw: '', login: '' }); continue; }
      rows.push({ role: 'PC', n, host: d.name === n ? n : `${d.name}（表示名）`, addr: addr(c.ip, NET.mask2len(c.mask)), gw: c.gw ? addr(c.gw, NET.mask2len(c.mask)) : '<span class="ng">未設定</span>', login: '' });
    }
    const pcNames = Object.keys(spec.pcs).filter(n => r.mapP[n]);
    const ping = {}; r.pingRows.forEach(x => { ping[pname(x.a, r.mapP) + '>' + pname(x.b, r.mapP)] = x.ok; });
    const acc = {}; r.access.forEach(x => { acc[pname(x.a, r.mapP) + '>' + x.t] = x.ok; });
    const targets = [...Object.keys(spec.routers).map(n => ({ n, how: spec.routerLogin })), ...Object.keys(spec.switches).map(n => ({ n, how: 'telnet' }))];
    return { name, version: r.version, items: r.items, rows, pcNames, ping, acc, targets, spec };
  }

  function render(v, demo) {
    const fix = v.items.filter(i => i.level === 'fix'), chk = v.items.filter(i => i.level === 'check'), info = v.items.filter(i => i.level === 'info');
    const verdict = fix.length ? `<span class="verdict ng">直すところが ${fix.length} 件</span>` : `<span class="verdict ok">要件を満たしています</span>`;
    const label = { fix: '要修正', check: '確認', info: '参考' };
    const li = i => `<li class="item"><span class="badge ${i.level}">${label[i.level]}</span><p><span class="who">${esc(i.who)}</span>${esc(i.text)}</p>${i.hint ? `<p class="hint"><b>ヒント</b>${esc(i.hint)}</p>` : ''}</li>`;
    const list = v.items.length ? `<ul class="items">${[...fix, ...chk, ...info].map(li).join('')}</ul>` : `<div class="allgood"><b>指摘はありません。</b> 実際に各 PC から ping・${v.spec.routerLogin === 'ssh' ? 'ssh・' : ''}telnet を試して、提出用のスクリーンショット（${v.spec.shot.from} → ${v.spec.shot.to}）を撮ろう。</div>`;
    const cnt = `${chk.length ? `確認 ${chk.length} 件` : ''}${chk.length && info.length ? '・' : ''}${info.length ? `参考 ${info.length} 件` : ''}`;
    const devTable = `<div class="tablebox"><table><thead><tr><th>機器</th><th>ホスト名</th><th>アドレス</th><th>デフォルトGW</th><th>ログイン</th></tr></thead><tbody>${v.rows.map(r => `<tr><td>${esc(r.role)} <b>${esc(r.n)}</b></td><td class="mono">${esc(r.host)}</td><td>${r.addr}</td><td>${r.gw || '－'}</td><td>${r.login || '－'}</td></tr>`).join('')}</tbody></table></div>`;
    const mark = ok => ok === undefined ? '－' : ok ? '<span class="ok" aria-label="届く">○</span>' : '<span class="ng" aria-label="届かない">×</span>';
    const pingT = `<div class="tablebox"><table class="mx"><thead><tr><th>送信元 ＼ 宛先</th>${v.pcNames.map(n => `<th>${n}</th>`).join('')}</tr></thead><tbody>${v.pcNames.map(a => `<tr><th scope="row">${a}</th>${v.pcNames.map(b => `<td>${a === b ? '－' : mark(v.ping[a + '>' + b])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const accT = `<div class="tablebox"><table class="mx"><thead><tr><th>PC ＼ 機器</th>${v.targets.map(t => `<th>${t.n}<br><span class="sub">${t.how}</span></th>`).join('')}</tr></thead><tbody>${v.pcNames.map(a => `<tr><th scope="row">${a}</th>${v.targets.map(t => `<td>${mark(v.acc[a + '>' + t.n])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    $('#out').innerHTML = `
      <div style="display:grid;gap:var(--s6)">
        <div class="status">${demo ? '<span class="example-tag">表示例</span>' : ''}${verdict}${cnt ? `<span>${cnt}</span>` : ''}<span class="file">${esc(v.name)}${v.version ? `（Packet Tracer ${esc(v.version.split('.').slice(0, 3).join('.'))}）` : ''}</span>${demo ? '' : '<button class="btn" id="again" type="button">別のファイルを読み込む</button>'}</div>${v.notice ? `<div class="notice">${esc(v.notice)}</div>` : ''}
        <section><h2>確かめること</h2>${list}</section>
        <section><h2>ファイルの中身</h2><p class="sub">アドレスは、ネットワーク部を薄く、ホスト部を緑で示しています。表（${v.spec.pages.table}）と見比べよう。</p>${devTable}</section>
        <section><h2>通信の見込み</h2><div class="grid2"><div style="display:grid;gap:var(--s2);min-width:0"><p class="sub">PC どうしの ping（行きと帰りの両方が届くか）</p>${pingT}</div><div style="display:grid;gap:var(--s2);min-width:0"><p class="sub">PC からルータ・スイッチへのログイン</p>${accT}</div></div></section>
      </div>`;
    const again = $('#again'); if (again) again.addEventListener('click', () => file.click());
  }

  function renderDemo() {
    if (lesson !== '4') { $('#out').innerHTML = '<div class="notice">pkt ファイルを読み込むと、直すところとヒント、ファイルの中身、通信の見込みがここに表示されます。</div>'; return; }
    const spec = SPECS['4'];
    const A = (ip) => addr(ip, 24);
    render({
      name: '2024z999_261019.pkt', version: '9.0.1.0858', spec,
      items: [
        { level: 'fix', who: 'SW2', text: 'ip default-gateway（10.4.1.1）が、SW2 と同じネットワークにありません。', hint: 'デフォルトゲートウェイは「SW2 と同じネットワークにある、ルータのインタフェース」。構成図で、SW2 の側にあるルータのアドレスを確かめよう。' },
        { level: 'fix', who: '通信', text: 'ログインできない組み合わせがあります（PC0→SW2、PC1→SW2）。', hint: '届かない相手のデフォルトゲートウェイや、ログインの設定を確かめよう。' },
        { level: 'check', who: 'PC3（表示名 PC2）', text: '表で PC3 のアドレスの PC が、表示名 PC2 になっています。', hint: '表示名とアドレスの組み合わせを構成図と見比べよう（提出のスクリーンショットで使う PC を間違えやすい）。' },
      ],
      rows: [
        { role: 'ルータ', n: 'RT1', host: 'RT1', addr: `Fa0/0 ${A('10.4.1.1')}<br>Fa0/1 ${A('10.4.3.1')}<br><span class="sub">静的ルート</span><br>${A('10.4.2.0')} → <span class="mono">10.4.3.2</span>`, gw: '', login: 'SSH（2024z999）' },
        { role: 'ルータ', n: 'RT2', host: 'RT2', addr: `Fa0/0 ${A('10.4.3.2')}<br>Fa0/1 ${A('10.4.2.1')}<br><span class="sub">静的ルート</span><br>${A('10.4.1.0')} → <span class="mono">10.4.3.1</span>`, gw: '', login: 'SSH（2024z999）' },
        { role: 'スイッチ', n: 'SW1', host: 'SW1', addr: 'vlan1 ' + A('10.4.1.2'), gw: A('10.4.1.1'), login: 'telnet' },
        { role: 'スイッチ', n: 'SW2', host: 'SW2', addr: 'vlan1 ' + A('10.4.2.2'), gw: A('10.4.1.1'), login: 'telnet' },
        { role: 'PC', n: 'PC0', host: 'PC0', addr: A('10.4.1.11'), gw: A('10.4.1.1'), login: '' },
        { role: 'PC', n: 'PC1', host: 'PC1', addr: A('10.4.1.12'), gw: A('10.4.1.1'), login: '' },
        { role: 'PC', n: 'PC2', host: 'PC3（表示名）', addr: A('10.4.2.11'), gw: A('10.4.2.1'), login: '' },
        { role: 'PC', n: 'PC3', host: 'PC2（表示名）', addr: A('10.4.2.12'), gw: A('10.4.2.1'), login: '' },
      ],
      pcNames: ['PC0', 'PC1', 'PC2', 'PC3'],
      ping: Object.fromEntries(['PC0', 'PC1', 'PC2', 'PC3'].flatMap(a => ['PC0', 'PC1', 'PC2', 'PC3'].map(b => [a + '>' + b, true]))),
      acc: Object.fromEntries(['PC0', 'PC1', 'PC2', 'PC3'].flatMap(a => ['RT1', 'RT2', 'SW1', 'SW2'].map(t => [a + '>' + t, !(t === 'SW2' && (a === 'PC0' || a === 'PC1'))]))),
      targets: [{ n: 'RT1', how: 'ssh' }, { n: 'RT2', how: 'ssh' }, { n: 'SW1', how: 'telnet' }, { n: 'SW2', how: 'telnet' }],
    }, true);
  }
  renderDemo();
})();
