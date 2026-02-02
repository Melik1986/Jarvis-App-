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
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { RagService } from "./rag.service";
import { DocumentMetadata, RagSettingsRequest } from "./rag.types";
import { RateLimitGuard } from "../../guards/rate-limit.guard";
import { AuthGuard } from "../auth/auth.guard";

interface ExtendedRequest extends Request {
  ephemeralCredentials?: {
    ragSettings?: RagSettingsRequest;
  };
}

@ApiTags("rag")
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
  @UseGuards(AuthGuard, RateLimitGuard)
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body("name") name?: string,
    @Body("ragSettings") ragSettings?: RagSettingsRequest,
    @Req() req?: ExtendedRequest,
  ): Promise<DocumentMetadata> {
    if (!file) {
      throw new HttpException("No file provided", HttpStatus.BAD_REQUEST);
    }

    const fileName = name || file.originalname;
    // Use ragSettings from body or ephemeralCredentials
    const settings =
      ragSettings || req?.ephemeralCredentials?.ragSettings || undefined;
    return this.ragService.uploadDocument(
      file.buffer,
      fileName,
      file.mimetype,
      settings,
    );
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
  @UseGuards(AuthGuard, RateLimitGuard)
  async search(
    @Body("query") query: string,
    @Body("limit") limit?: number,
    @Body("ragSettings") ragSettings?: RagSettingsRequest,
    @Req() req?: ExtendedRequest,
  ) {
    if (!query) {
      throw new HttpException("Query is required", HttpStatus.BAD_REQUEST);
    }
    // Use ragSettings from body or ephemeralCredentials
    const settings =
      ragSettings || req?.ephemeralCredentials?.ragSettings || undefined;
    return this.ragService.search(query, limit || 5, settings);
  }

  @Post("seed-demo")
  @UseGuards(AuthGuard, RateLimitGuard)
  async seedDemo(
    @Body("ragSettings") ragSettings?: RagSettingsRequest,
    @Req() req?: ExtendedRequest,
  ) {
    // Use ragSettings from body or ephemeralCredentials
    const settings =
      ragSettings || req?.ephemeralCredentials?.ragSettings || undefined;
    return this.ragService.seedDemoData(settings);
  }
}
