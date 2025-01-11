import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Redirect,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from "@nestjs/platform-express";
import { Express } from "express";
import { diskStorage } from "multer";

import { unlink } from "node:fs/promises";

import { DatabaseService } from "./database.service";

const PAGE_PREFIX = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>アップローダ</title>
</head>
<body>
<h1>アップローダ</h1>
<form method="POST" action="/upload" enctype="multipart/form-data">
<p>
<input type="file" name="file" required>
<input type="submit" value="アップロード" style="margin-left: 1em;">
</p>
</form>
<hr>
<ul>
`;

const PAGE_SUFFIX=`</ul>
</body>
</html>
`;

@Controller()
export class AppController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Post("upload")
  @Redirect("/", 303)
  @UseInterceptors(FileInterceptor("file", { storage: diskStorage({}) }))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("no file sent");
    const fileName = new TextDecoder().decode(
      new Uint8Array(Array.from(file.originalname).map((c) => c.charCodeAt(0)))
    );
    try {
      await this.databaseService.putFile(fileName, file.mimetype, file.path);
    } finally {
      await unlink(file.path);
    }
  }

  @Get("file/:id")
  async getFile(@Param("id") id: string) {
    const idNumber = parseInt(id, 10);
    if (isNaN(idNumber)) throw new BadRequestException("invalid id");
    const file = await this.databaseService.getFile(idNumber);
    if (!file) throw new NotFoundException("nonexistent id");
    return new StreamableFile(file.dataStream, {
      type: file.type,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    });
  }

  @Get()
  async getIndex(): Promise<string> {
    return (
      PAGE_PREFIX +
      (await this.databaseService.listFile()).map((entry) => {
        const name = entry.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<li><a href="/file/${entry.id}">${name}</a></li>\n`;
      }).join("") +
      PAGE_SUFFIX
    );
  }
}
