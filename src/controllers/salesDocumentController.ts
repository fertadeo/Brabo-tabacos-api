import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { SalesDocumentService } from '../services/sales-documents/SalesDocumentService';
import { ApiResponse } from '../types';

export class SalesDocumentController {
  private service = new SalesDocumentService();

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
      const preferredClientId = req.body?.client_id
        ? Number(req.body.client_id)
        : undefined;
      const preferredLinkSaleId = req.body?.link_sale_id
        ? Number(req.body.link_sale_id)
        : undefined;

      const result = await this.service.parseUploadedDocument(
        req.file,
        userId,
        Number.isFinite(preferredClientId) ? preferredClientId : undefined,
        Number.isFinite(preferredLinkSaleId) ? preferredLinkSaleId : undefined
      );

      res.status(200).json({
        success: true,
        message: 'Factura analizada correctamente',
        data: result,
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    } catch (error) {
      console.error('Parse sales document error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al analizar la factura',
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

      const { file_token, client_id, link_sale_id } = req.body;
      const result = await this.service.rematchItems(
        file_token,
        client_id != null ? Number(client_id) : undefined,
        link_sale_id != null ? Number(link_sale_id) : undefined
      );

      res.status(200).json({
        success: true,
        message: 'Ítems re-vinculados correctamente',
        data: result,
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    } catch (error) {
      console.error('Rematch sales document error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al vincular ítems',
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
        message: 'Factura importada y registrada en el sistema',
        data: result,
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    } catch (error) {
      console.error('Confirm sales document error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al confirmar la factura',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    }
  }

  public async updateLinkedDocument(req: Request, res: Response): Promise<void> {
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
      const result = await this.service.updateLinkedDocument(req.body, userId);

      res.status(200).json({
        success: true,
        message: 'Vinculación de factura externa actualizada',
        data: result,
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    } catch (error) {
      console.error('Update sales document link error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar la vinculación',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    }
  }

  public async unlinkExternalInvoice(req: Request, res: Response): Promise<void> {
    try {
      const saleId = Number(req.params.id);
      if (!Number.isFinite(saleId) || saleId < 1) {
        res.status(400).json({
          success: false,
          message: 'ID de venta inválido',
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse);
        return;
      }

      const result = await this.service.unlinkExternalInvoice(saleId);

      res.status(200).json({
        success: true,
        message: 'Vinculación de factura externa removida',
        data: result,
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    } catch (error) {
      console.error('Unlink sales external invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al quitar la vinculación',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    }
  }

  public async downloadSourcePdf(req: Request, res: Response): Promise<void> {
    try {
      const saleId = Number(req.params.id);
      if (!Number.isFinite(saleId) || saleId < 1) {
        res.status(400).json({
          success: false,
          message: 'ID de venta inválido',
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse);
        return;
      }

      const file = await this.service.getSourcePdfForSale(saleId);
      if (!file) {
        res.status(404).json({
          success: false,
          message: 'No hay PDF externo vinculado a esta venta',
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse);
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${file.filename.replace(/"/g, '')}"`);
      res.send(file.buffer);
    } catch (error) {
      console.error('Download sales source PDF error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al descargar el PDF',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
    }
  }
}
