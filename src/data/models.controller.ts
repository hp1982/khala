import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DataAccessGuard } from '../common/data-access.guard';
import { ModelsService, PagedModelsQuery } from './models.service';

@Controller('models')
@UseGuards(DataAccessGuard)
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get('paged')
  paged(@Query() query: PagedModelsQuery) {
    return this.modelsService.paged(query);
  }
}