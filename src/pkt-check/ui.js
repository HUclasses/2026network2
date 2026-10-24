// ---- 画面 ----
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const keys = Object.keys(SPECS);
  const lesson = window.PKT_LESSON;
  const sid = $('#sid'); sid.value = store.get('pktcheck.sid') || '';
  let last = null;
  { const p = SPECS[lesson].pages; $('#lesson-note').innerHTML = `<span class="nw">${esc(SPECS[lesson].label)}。</span><wbr>資料の ` + (p.diagram === p.table ? `<span class="nw">${p.table}（構成図とアドレスの表）。</span>` : `<span class="nw">${p.diagram}（構成図）</span>と<wbr> <span class="nw">${p.table}（アドレスの表）。</span>`); }
  const hasVlan = Object.values(SPECS[lesson].pcs).some(p => p.vlan);
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
    const rng = ks => { const out = []; let st = null, pv = null; for (const k of ks) { if (st === null) st = pv = k; else if (k === pv + 1) pv = k; else { out.push(st === pv ? `Fa0/${st}` : `Fa0/${st}〜${pv}`); st = pv = k; } } if (st !== null) out.push(st === pv ? `Fa0/${st}` : `Fa0/${st}〜${pv}`); return out.join('、'); };
    for (const { n, d } of r.summary.switches) {
      if (!d) { rows.push({ role: 'スイッチ', n, host: '—', addr: '<span class="ng">見つからない</span>', gw: '', login: '' }); continue; }
      const io = d.ios, v1 = io.ifaces.Vlan1 || {}, v = io.vty['0 4'] || io.vty['0 15'] || {};
      if (spec.switches[n].vlans) {
        const nums = Object.keys(d.vlans || { 1: 'default' }).filter(k => !['1002', '1003', '1004', '1005'].includes(k)).sort((a, b) => a - b);
        const ports = num => { const ks = []; for (let k = 1; k <= 24; k++) { const i = io.ifaces[`FastEthernet0/${k}`] || {}; if ((i.vlan || '1') === num && i.mode !== 'trunk') ks.push(k); } return rng(ks) || 'なし'; };
        const list = nums.map(num => `VLAN <span class="mono">${esc(num)}</span> <span class="mono">${esc((d.vlans || {})[num] || '')}</span>：${ports(num)}`).join('<br>');
        rows.push({ role: 'スイッチ', n, host: io.hostname || '—', addr: list, gw: '', login: v.login ? 'telnet' : '—' }); continue; }
      rows.push({ role: 'スイッチ', n, host: io.hostname || '—', addr: 'vlan1 ' + (v1.ip ? addr(v1.ip, NET.mask2len(v1.mask)) : '<span class="ng">未設定</span>'), gw: io.dgw ? addr(io.dgw, NET.mask2len(v1.mask)) : '<span class="ng">未設定</span>', login: v.login ? 'telnet' : '—' });
    }
    for (const { n, d, c } of r.summary.pcs) {
      if (!d) { rows.push({ role: 'PC', n, host: '—', addr: '<span class="ng">見つからない</span>', gw: '', login: '' }); continue; }
      const pv = r.summary.pcs.find(x => x.n === n), noGw = spec.pcs[n].gw === '';
      const where = hasVlan ? `<br><span class="sub">${pv.port ? esc(pv.port.replace('FastEthernet', 'Fa')) + '・VLAN ' + esc(pv.vlan) : 'スイッチにつながっていない'}</span>` : '';
      rows.push({ role: 'PC', n, host: d.name === n ? n : `${d.name}（表示名）`, addr: addr(c.ip, NET.mask2len(c.mask)) + where, gw: c.gw && c.gw !== '0.0.0.0' ? addr(c.gw, NET.mask2len(c.mask)) : (noGw ? '空欄' : '<span class="ng">未設定</span>'), login: '' });
    }
    const pcNames = Object.keys(spec.pcs).filter(n => r.mapP[n]);
    const ping = {}, exp = {}; r.pingRows.forEach(x => { const k = pname(x.a, r.mapP) + '>' + pname(x.b, r.mapP); ping[k] = x.ok; exp[k] = x.exp; });
    const acc = {}; r.access.forEach(x => { acc[pname(x.a, r.mapP) + '>' + x.t] = x.ok; });
    const targets = [...Object.keys(spec.routers).map(n => ({ n, how: spec.routerLogin })), ...Object.keys(spec.switches).filter(n => spec.switches[n].ip).map(n => ({ n, how: 'telnet' }))];
    return { name, version: r.version, items: r.items, rows, pcNames, ping, exp, acc, targets, spec, stages: r.stages };
  }

  function render(v, demo) {
    const fix = v.items.filter(i => i.level === 'fix'), chk = v.items.filter(i => i.level === 'check'), info = v.items.filter(i => i.level === 'info');
    const verdict = fix.length ? `<span class="verdict ng">直すところが ${fix.length} 件</span>` : `<span class="verdict ok">要件を満たしています</span>`;
    const label = { fix: '要修正', check: '確認', info: '参考' };
    const how = h => h ? `<p class="how"><b>確かめ方</b>${esc(h.where)}${h.cmd ? ` で <code>${esc(h.cmd)}</code>` : ''}。${esc(h.look)}</p>` : '';
    const trace = tr => tr && tr.hops.length ? `<div class="trace"><b>${esc(tr.from)} の Command Prompt で、近い順に ping してみると（見込み）</b><ol>${tr.hops.map((x, k) => `<li class="${x.ok ? 'ok' : 'ng'}"><code>C:\\&gt; ping ${esc(x.ip)}</code><span>${x.who ? esc(x.who) + ' ' : ''}${x.ok ? '○ 届く' : '× 届かない'}</span></li>`).join('')}</ol>${tr.hops.some(x => !x.ok) ? `<p>最初に × になった所の手前までは届いている。そこから先の機器と、返事の帰り道（相手のデフォルトゲートウェイ）を確かめよう。</p>` : ''}</div>` : '';
    const li = i => `<li class="item"><span class="badge ${i.level}">${label[i.level]}</span><p><span class="who">${esc(i.who)}</span>${esc(i.text)}</p>${i.hint ? `<p class="hint"><b>ヒント</b>${esc(i.hint)}</p>` : ''}${how(i.how)}${trace(i.trace)}</li>`;
    const list = v.items.length ? `<ul class="items">${[...fix, ...chk, ...info].map(li).join('')}</ul>` : `<div class="allgood"><b>指摘はありません。</b> 実際に各 PC から ping${v.targets.length ? '・' + (v.spec.routerLogin === 'ssh' ? 'ssh・' : '') + 'telnet' : ''} を試して、提出用のスクリーンショット（${v.spec.shot.text || v.spec.shot.from + ' → ' + v.spec.shot.to}）を撮ろう。</div>`;
    const cnt = `${chk.length ? `確認 ${chk.length} 件` : ''}${chk.length && info.length ? '・' : ''}${info.length ? `参考 ${info.length} 件` : ''}`;
    const devTable = `<div class="tablebox"><table><thead><tr><th>機器</th><th>ホスト名</th><th>${hasVlan ? 'アドレス・VLAN' : 'アドレス'}</th><th>デフォルトGW</th><th>ログイン</th></tr></thead><tbody>${v.rows.map(r => `<tr><td>${esc(r.role)} <b>${esc(r.n)}</b></td><td class="mono">${esc(r.host)}</td><td>${r.addr}</td><td>${r.gw || '－'}</td><td>${r.login || '－'}</td></tr>`).join('')}</tbody></table></div>`;
    const mark = ok => ok === undefined ? '－' : ok ? '<span class="ok" aria-label="届く">○</span>' : '<span class="ng" aria-label="届かない">×</span>';
    const pingT = `<div class="tablebox"><table class="mx"><thead><tr><th>送信元 ＼ 宛先</th>${v.pcNames.map(n => `<th>${n}</th>`).join('')}</tr></thead><tbody>${v.pcNames.map(a => `<tr><th scope="row">${a}</th>${v.pcNames.map(b => { const k = a + '>' + b, bad = v.exp && v.exp[k] !== undefined && v.exp[k] !== v.ping[k]; return `<td${bad ? ' style="background:var(--vermilion-tint)" title="想定と違う"' : ''}>${a === b ? '－' : mark(v.ping[k])}${bad ? '<span class="ng">!</span>' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
    const accT = `<div class="tablebox"><table class="mx"><thead><tr><th>PC ＼ 機器</th>${v.targets.map(t => `<th>${t.n}<br><span class="sub">${t.how}</span></th>`).join('')}</tr></thead><tbody>${v.pcNames.map(a => `<tr><th scope="row">${a}</th>${v.targets.map(t => `<td>${mark(v.acc[a + '>' + t.n])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    $('#out').innerHTML = `
      <div style="display:grid;gap:var(--s6)">
        <div class="status">${demo ? '<span class="example-tag">表示例</span>' : ''}${verdict}${cnt ? `<span>${cnt}</span>` : ''}<span class="file">${esc(v.name)}${v.version ? `（Packet Tracer ${esc(v.version.split('.').slice(0, 3).join('.'))}）` : ''}</span>${demo ? '' : '<button class="btn" id="again" type="button">別のファイルを読み込む</button>'}</div>${v.notice ? `<div class="notice">${esc(v.notice)}</div>` : ''}
        ${progress(v)}
        <section><h2>確かめること</h2>${list}</section>
        <section><h2>ファイルの中身</h2><p class="sub">アドレスは、ネットワーク部を薄く、ホスト部を緑で示しています。表（${v.spec.pages.table}）と見比べよう。</p>${devTable}</section>
        <section><h2>通信の見込み</h2>${v.targets.length ? `<div class="grid2"><div style="display:grid;gap:var(--s2);min-width:0"><p class="sub">PC どうしの ping（行きと帰りの両方が届くか）</p>${pingT}</div><div style="display:grid;gap:var(--s2);min-width:0"><p class="sub">PC からルータ・スイッチへのログイン</p>${accT}</div></div>`
          : `<div style="display:grid;gap:var(--s2);min-width:0"><p class="sub">PC どうしの ping（行きと帰りの両方が届くか）。${hasVlan ? '同じ VLAN どうしは○、違う VLAN どうしは×になるのが正しい。想定と違うマスは色を付け、「!」を付けています。' : ''}</p>${pingT}</div>`}</section>
      </div>`;
    const again = $('#again'); if (again) again.addEventListener('click', () => file.click());
  }

  function progress(v) {
    if (!v.stages || !v.stages.length) return '';
    const next = v.stages.find(s => !s.ok);
    const cells = v.stages.map(s => `<li class="step ${s.ok ? 'done' : (s === next ? 'next' : '')}"><span class="sname">${esc(s.name)}</span><span class="sstate">${s.ok ? 'できている' : `あと ${s.missing.length} つ`}</span><span class="spage">資料 ${esc(s.page)}</span></li>`).join('');
    const body = next ? `<div class="nextbox"><p class="nexthead"><b>次は${esc(next.name)}</b>（資料 ${esc(next.page)}）。ファイルにまだ入っていないもの：</p><ul>${next.missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>`
      : `<div class="allgood"><b>確認①〜③と実習の内容が、すべてファイルに入っています。</b></div>`;
    return `<section><h2>どこまでできたか</h2><p class="sub">ファイルの中身から判断しています。確認①〜③の manaba への提出は、別に必要です。</p><ol class="steps">${cells}</ol>${body}</section>`;
  }

  function renderDemo() {
    if (lesson !== '4') { $('#out').innerHTML = '<div class="notice">pkt ファイルを読み込むと、直すところとヒント、ファイルの中身、通信の見込みがここに表示されます。</div>'; return; }
    const spec = SPECS['4'];
    const A = (ip) => addr(ip, 24);
    render({
      name: '2024z999_261019.pkt', version: '9.0.1.0858', spec,
      items: [
        { level: 'fix', who: 'SW2', text: 'ip default-gateway（10.4.1.1）が、SW2 と同じネットワークにありません。', hint: 'デフォルトゲートウェイは「SW2 と同じネットワークにある、ルータのインタフェース」。構成図で、SW2 の側にあるルータのアドレスを確かめよう。', how: { where: 'SW2 の CLI（特権モード）', cmd: 'show running-config', look: 'ip default-gateway の行' } },
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
      stages: [{ name: '確認①', page: 'p.15', ok: true, missing: [] }, { name: '確認②', page: 'p.19', ok: true, missing: [] }, { name: '確認③', page: 'p.28', ok: true, missing: [] },
               { name: '実習', page: 'p.32〜35', ok: false, missing: ['SW2 のホスト名・vlan 1・ip default-gateway', 'どの PC からもルータ・スイッチにログインできる'] }],
    }, true);
  }
  renderDemo();
})();
