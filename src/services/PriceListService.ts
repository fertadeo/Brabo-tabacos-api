import { PriceList } from '../entities/PriceList';
import { PriceListRepository } from '../repositories/PriceListRepository';

export class PriceListService {
  private repo = new PriceListRepository();

  async getAll(activeOnly = true): Promise<PriceList[]> {
    return this.repo.findAll(activeOnly);
  }
}
