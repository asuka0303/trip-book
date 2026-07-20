# みんなの旅しおり

グループ旅行の準備をまとめるウェブアプリです。

## 機能

- **グループ管理** — グループ名と合言葉でグループを作成・参加。グループ単位でデータが分離されます
- **旅行管理** — 旅行名・行き先・日程・集合場所・集合時間・大事なメモを登録
- **行き先** — 旅行ごとに訪問場所・住所・Google マップ URL・日時・メモを管理
- **スクショ・メモ** — 予約画面のスクショや備忘メモを画像付きで保存。画像は Supabase Storage に保存

## 技術構成

| 項目 | 内容 |
|------|------|
| フロントエンド | HTML / CSS / Vanilla JS（バンドルなし） |
| バックエンド | [Supabase](https://supabase.com)（DB + Storage） |
| ホスティング | Cloudflare Pages |
| 認証 | 独自グループ ID + 合言葉（Supabase RPC） |

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/asuka0303/trip-book.git
cd trip-book
```

### 2. Supabase の設定

`config.js` を編集して自分のプロジェクト情報を入れます。

```js
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_...";
const SUPABASE_STORAGE_BUCKET = "trip-book-documents";
```

### 3. Supabase Storage のバケット作成

Supabase ダッシュボードの **SQL Editor** で実行します。

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-book-documents',
  'trip-book-documents',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "trip-book-documents public access"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'trip-book-documents')
WITH CHECK (bucket_id = 'trip-book-documents');
```

### 4. デプロイ

Cloudflare Pages と GitHub を連携すると、`main` ブランチへの push で自動デプロイされます。

## ファイル構成

```
trip-book/
├── index.html   # マークアップ
├── style.css    # スタイル
├── app.js       # アプリロジック
└── config.js    # Supabase 接続情報（要設定）
```
