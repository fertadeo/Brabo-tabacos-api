import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { PurchaseDocumentService } from '../services/purchase-documents/PurchaseDocumentService';
import { ApiResponse } from '../types';

export class PurchaseDocumentController {
  private service = new PurchaseDocumentService();

  public async parseDocument(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'Debe adjuntar un archivo PDF',
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse);
        return;
      }

      const userId = (req as Request & { user?: { id?: number } }).user?.id;
      const result = await this.service.parseUploadedDocument(req.file, userId);

      res.status(200).json({
        success: true,
        message: 'Documento analizado correctamente',
        data: result,
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    } catch (error) {
      console.error('Parse purchase document error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al analizar el documento',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    }
  }

  public async rematchDocument(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: errors.array().map((e) => e.msg).join(', '),
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse);
        return;
      }

      const { file_token, supplier_id } = req.body;
      const items = await this.service.rematchItems(file_token, Number(supplier_id));

      res.status(200).json({
        success: true,
        message: 'Productos re-vinculados correctamente',
        data: { items },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    } catch (error) {
      console.error('Rematch purchase document error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al vincular productos',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    }
  }

  public async confirmDocument(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: errors.array().map((e) => e.msg).join(', '),
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse);
        return;
      }

      const userId = (req as Request & { user?: { id?: number } }).user?.id;
      const result = await this.service.confirmDocument(req.body, userId);

      res.status(201).json({
        success: true,
        message: 'Remito registrado y stock actualizado según confirmación',
        data: result,
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    } catch (error) {
      console.error('Confirm purchase document error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al confirmar el documento',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    }
  }

  public async downloadSourcePdf(req: Request, res: Response): Promise<void> {
    try {
      const purchaseId = Number(req.params.id);
      if (!Number.isFinite(purchaseId) || purchaseId < 1) {
        res.status(400).json({
          success: false,
          message: 'ID de compra inválido',
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse);
        return;
      }

      const file = await this.service.getSourcePdfForPurchase(purchaseId);
      if (!file) {
        res.status(404).json({
          success: false,
          message: 'No hay PDF vinculado a esta orden de compra',
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse);
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${file.filename.replace(/"/g, '')}"`);
      res.send(file.buffer);
    } catch (error) {
      console.error('Download purchase source PDF error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al descargar el PDF',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    }
  }
}
