/**
 * Declaraciones de tipos para multer y extensión de Express.Request.
 * El paquete multer debe estar instalado (npm install multer).
 */
import { Request } from 'express';

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
      }
    }
    interface Request {
      file?: Express.Multer.File;
      files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
    }
  }
}

declare module 'multer' {
  import { RequestHandler } from 'express';

  interface StorageEngine {
    _handleFile(req: Request, file: Express.Multer.File, callback: (error?: Error | null, info?: Partial<Express.Multer.File>) => void): void;
    _removeFile(req: Request, file: Express.Multer.File, callback: (error: Error | null) => void): void;
  }

  interface Options {
    dest?: string;
    storage?: StorageEngine;
    fileFilter?: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile?: boolean) => void) => void;
    limits?: { fileSize?: number };
  }

  interface MulterInstance {
    single(name: string): RequestHandler;
    array(name: string, maxCount?: number): RequestHandler;
    fields(fields: Array<{ name: string; maxCount?: number }>): RequestHandler;
  }

  interface Multer {
    (options?: Options): MulterInstance;
    memoryStorage(): StorageEngine;
    diskStorage(options: { destination?: string; filename?: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => void }): StorageEngine;
    single(name: string): RequestHandler;
    array(name: string, maxCount?: number): RequestHandler;
    fields(fields: Array<{ name: string; maxCount?: number }>): RequestHandler;
  }

  const multer: Multer;
  export default multer;
}
