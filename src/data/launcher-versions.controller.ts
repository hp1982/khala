import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DataAccessGuard } from '../common/data-access.guard';
import { LauncherVersionsFilterQuery, LauncherVersionsService } from './launcher-versions.service';

@Controller('launcher-versions')
@UseGuards(DataAccessGuard)
export class LauncherVersionsController {
  constructor(private readonly launcherVersionsService: LauncherVersionsService) {}

  @Get('filter')
  filter(@Query() query: LauncherVersionsFilterQuery) {
    return this.launcherVersionsService.filter(query);
  }
}