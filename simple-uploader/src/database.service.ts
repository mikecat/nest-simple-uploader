import { Stream } from "node:stream";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { Database, OPEN_READWRITE, OPEN_CREATE, OPEN_FULLMUTEX } from "sqlite3";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";

interface FileEntry {
  name: string;
  id: number;
}

interface FileData {
  name: string;
  type: string;
  dataStream: any;
}

interface DBObject {
  close: () => Promise<void>;
  runSQL: (sql: string, params?: any) => Promise<any[]>;
}

@Injectable()
export class DatabaseService {
  private readonly dbFile = process.env.DB_FILE || "files.db";
  private readonly bucketName = process.env.BUCKET_NAME || "files";
  private readonly s3client = new S3Client({
    region: process.env.STORAGE_REGION || "us-west-2",
    endpoint: process.env.STORAGE_ENDPOINT || "http://localhost:8000",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.STORAGE_KEY || "accessKey1",
      secretAccessKey: process.env.STORAGE_SECRET || "verySecretKey1",
    },
  });

  private async openDB(): Promise<DBObject> {
    return new Promise((resolve, reject) => {
      const db = new Database(
        this.dbFile,
        OPEN_READWRITE | OPEN_CREATE | OPEN_FULLMUTEX,
        (err) => {
          if (err === null) resolve({
            close: async () => {
              return new Promise<void>((resolve, reject) => {
                db.close((err) => {
                  if (err === null) resolve();
                  else reject(err);
                });
              });
            },
            runSQL: async (sql: string, params?: any) => {
              return new Promise((resolve, reject) => {
                db.all(sql, params || [], (err, rows) => {
                  if (err === null) resolve(rows);
                  else reject(err);
                });
              });
            },
          });
          else reject(err);
        },
      );
    });
  }

  constructor() {
    this.openDB().then(async (db) => {
      try {
        await db.runSQL(`
          CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            storageId TEXT NOT NULL
          ) STRICT
        `);
      } finally {
        await db.close();
      }
    });
  }

  async putFile(name: string, type: string, path: string) {
    return await this.openDB().then(async (db) => {
      try {
        await db.runSQL("BEGIN TRANSACTION");
        const s3key = randomUUID();
        await db.runSQL(
          "INSERT INTO files (name, type, storageId) VALUES (?, ?, ?)",
          [name, type, s3key]
        );
        await this.s3client.send(new PutObjectCommand({
          Bucket: this.bucketName,
          Key: s3key,
          Body: createReadStream(path),
          ContentType: type,
          IfNoneMatch: "*",
        }));
        await db.runSQL("COMMIT TRANSACTION");
      } catch (e: any) {
        try {
          await db.runSQL("ROLLBACK TRANSACTION");
        } catch {}
        throw e;
      } finally {
        await db.close();
      }
    });
  }

  async getFile(id: number): Promise<FileData | null> {
    return await this.openDB().then(async (db) => {
      try {
        const [file] = await db.runSQL(
          "SELECT name, type, storageId FROM files WHERE id=?",
          [id]
        );
        if (!file) return null;
        const s3object = await this.s3client.send(new GetObjectCommand({
          Bucket: this.bucketName,
          Key: file.storageId,
        }));
        if (!s3object.Body) return null;
        return {
          name: file.name as string,
          type: file.type as string,
          dataStream: s3object.Body,
        };
      } finally {
        await db.close();
      }
    });
  }

  async listFile(): Promise<FileEntry[]> {
    return await this.openDB().then(async (db) => {
      try {
        return await db.runSQL(
          "SELECT name, id FROM files ORDER BY id ASC",
        ) as FileEntry[];
      } finally {
        await db.close();
      }
    });
  }
}
