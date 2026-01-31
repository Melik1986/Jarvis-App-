import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { RagService } from "./rag.service";
import { DocumentMetadata, RagSettingsRequest } from "./rag.types";

@Controller("documents")
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Get()
  async listDocuments(): Promise<DocumentMetadata[]> {
    return this.ragService.listDocuments();
  }

  @Get("providers")
  getProviders() {
    return {
      providers: this.ragService.getProviders(),
      current: this.ragService.getCurrentProvider(),
    };
  }

  @Put("providers")
  setProvider(@Body() settings: RagSettingsRequest) {
    this.ragService.setProvider(settings);
    return {
      success: true,
      current: this.ragService.getCurrentProvider(),
    };
  }

  @Get(":id")
  async getDocument(@Param("id") id: string): Promise<DocumentMetadata | null> {
    const doc = await this.ragService.getDocument(id);
    if (!doc) {
      throw new HttpException("Document not found", HttpStatus.NOT_FOUND);
    }
    return doc;
  }

  @Get(":id/content")
  async getDocumentContent(@Param("id") id: string) {
    const content = await this.ragService.getDocumentContent(id);
    if (content === null) {
      throw new HttpException("Document not found", HttpStatus.NOT_FOUND);
    }
    return { id, content };
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body("name") name?: string,
  ): Promise<DocumentMetadata> {
    if (!file) {
      throw new HttpException("No file provided", HttpStatus.BAD_REQUEST);
    }

    const fileName = name || file.originalname;
    return this.ragService.uploadDocument(file.buffer, fileName, file.mimetype);
  }

  @Post("upload-url")
  async uploadFromUrl(
    @Body("url") url: string,
    @Body("name") name: string,
  ): Promise<DocumentMetadata> {
    if (!url || !name) {
      throw new HttpException(
        "URL and name are required",
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.ragService.uploadFromUrl(url, name);
  }

  @Delete(":id")
  async deleteDocument(@Param("id") id: string): Promise<{ success: boolean }> {
    const deleted = await this.ragService.deleteDocument(id);
    if (!deleted) {
      throw new HttpException("Document not found", HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  @Post(":id/reindex")
  async reindexDocument(@Param("id") id: string): Promise<DocumentMetadata> {
    const doc = await this.ragService.reindexDocument(id);
    if (!doc) {
      throw new HttpException("Document not found", HttpStatus.NOT_FOUND);
    }
    return doc;
  }

  @Post("search")
  async search(@Body("query") query: string, @Body("limit") limit?: number) {
    if (!query) {
      throw new HttpException("Query is required", HttpStatus.BAD_REQUEST);
    }
    return this.ragService.search(query, limit || 5);
  }

  @Post("seed-demo")
  async seedDemo() {
    return this.ragService.seedDemoData();
  }
}
