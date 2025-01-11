nest-simple-uploader
====================

S3 互換ストレージを用いた、NestJS によるファイルアップローダのデモ。

## 使い方

### S3 互換ストレージ

`cloudserver` ディレクトリで、S3 互換ストレージの [Zenko CloudServer](https://github.com/scality/cloudserver) を立ち上げる。

最初に、データを保存する用のディレクトリを作成する。

```
docker compose run --rm storage-init
```

その後、Zenko CloudServer を起動する。

```
docker compose up -d
```

### ファイルアップローダ

`simple-uploader` ディレクトリで、ファイルアップローダを立ち上げる。

環境に応じて環境変数を設定する。  
初期値としてローカルの Zenko CloudServer 用の設定を入れているので、これを用いる場合は設定しなくてもよい。

|環境変数|意味|初期値|
|---|---|---|
|`DB_FILE`|SQLite のデータベースファイル|`files.db`|
|`BUCKET_NAME`|S3 互換ストレージのバケット名|`files`|
|`STORAGE_REGION`|S3 互換ストレージのリージョン|`us-west-2`|
|`STORAGE_ENDPOINT`|S3 互換ストレージのエンドポイント|`http://localhost:8000`|
|`STORAGE_KEY`|S3 互換ストレージのアクセスキー|`accessKey1`|
|`STORAGE_SECRET`|S3 互換ストレージのアクセス用シークレット|`verySecretKey1`|

用いるバケットが S3 互換ストレージに無い場合は、作成する。

ファイルアップローダを実行する。

```
npm run start
```

初期設定では、`http://localhost:3000/` でファイルアップローダにアクセスできるはずである。

## ライセンス

私 (みけCAT) に権利がある部分については、[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.ja) とする。

Nest CLI により生成したコードが含まれており、これらのコードには [MIT ライセンス](https://github.com/nestjs/nest/blob/master/LICENSE)が適用される可能性がある。
