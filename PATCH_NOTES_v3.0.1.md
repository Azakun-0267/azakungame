# Ver3.0.1 CPU試合開始修正

## 修正
- CPUを入れても試合開始できない問題を修正
- CPU生成を defaultPlayer 失敗時でも動く安全版に変更
- startBattle をCPU込みで強制的に2人扱いにするよう修正
- CPUは常にready扱い
- startBattleイベントを object/string 両対応に修正
- クライアント側から startBattle を確実に送る補助スクリプトを追加

## 維持
- ログイン/セーブ/部屋参加は触っていません
- CPU Lv1〜9
- 横スマ/上B強化
- 技見た目安定版
