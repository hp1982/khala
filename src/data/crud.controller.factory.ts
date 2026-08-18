import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Type,
  UseGuards,
} from '@nestjs/common';
import { DataAccessGuard } from '../common/data-access.guard';
import { CurrentAdmin } from '../common/current-admin.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { BaseCrudService, PrismaModelKey } from './base-crud.service';

export interface CrudControllerOptions {
  route: string;
  modelKey: PrismaModelKey;
}

export function createCrudController({
  route,
  modelKey,
}: CrudControllerOptions): Type<any> {
  @Controller(route)
  @UseGuards(DataAccessGuard)
  class CrudController {
    protected readonly service: BaseCrudService;

    constructor(protected readonly prisma: PrismaService) {
      this.service = new BaseCrudService(prisma, modelKey);
    }

    @Post()
    create(@Body() dto: any, @CurrentAdmin() admin: Express.Request['admin']) {
      return this.service.create(dto, admin?.id);
    }

    @Get()
    findAll() {
      return this.service.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
      return this.service.findOne(id);
    }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
      return this.service.update(id, dto);
    }

    @Delete(':id')
    @Roles(1)
    @UseGuards(RolesGuard)
    remove(@Param('id', ParseIntPipe) id: number) {
      return this.service.remove(id);
    }
  }

  return CrudController;
}