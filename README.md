# 2026 情報通信ネットワークⅡ

北陸大学「情報通信ネットワークⅡ」（2026年度後期）の学生向けページ。

## pkt セルフチェック

提出前に、自分の Packet Tracer ファイル（.pkt）を読み込んで、設定が要件どおりかを確かめるページ。ファイルはブラウザの中だけで読み取り、どこにも送信しない。

- 第3回: `pkt-check/03/`
- 第4回: `pkt-check/04/`
- 第5回: `pkt-check/05/`（VLAN。SPECS の pcs に port・vlan、switches に vlans を書くと、ポートの VLAN と「同じ VLAN どうしだけ届く」を確かめる）

### 新しい回を足すには

1. `src/pkt-check/analyze.js` の `SPECS` に、その回の構成（ルータ・スイッチ・PC のアドレス、静的ルート、ログイン方法、資料のページ）を足す。
2. `python3 src/pkt-check/build.py .` を実行すると、`pkt-check/NN/index.html` とトップページが作り直される。
