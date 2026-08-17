import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthGuard } from '../common/admin-auth.guard';
import { CurrentAdmin } from '../common/current-admin.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminRegisterDto } from './dto/admin-register.dto';
import { AdminUpdateDto } from './dto/admin-update.dto';

@Controller('admin')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('register')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(1)
  register(@Body() dto: AdminRegisterDto) {
    return this.adminAuthService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return this.adminAuthService.login(dto, {
      userAgent: req.headers['user-agent'],
      ip: ip ?? req.socket.remoteAddress,
    });
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  logout(@Headers('authorization') authorization?: string) {
    return this.adminAuthService.logout(this.extractToken(authorization));
  }

  @Get('profile')
  @UseGuards(AdminAuthGuard)
  profile(@Headers('authorization') authorization?: string) {
    return this.adminAuthService.profile(this.extractToken(authorization));
  }

  @Get()
  @UseGuards(AdminAuthGuard)
  findAll() {
    return this.adminAuthService.findAll();
  }

  @Get(':id')
  @UseGuards(AdminAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminAuthService.findOne(id);
  }

  @Put(':id')
  @UseGuards(AdminAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateDto,
    @CurrentAdmin() admin: Express.Request['admin'],
  ) {
    return this.adminAuthService.update(id, dto, admin);
  }

  @Delete(':id')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(1)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminAuthService.remove(id);
  }

  private extractToken(authorization?: string): string | undefined {
    if (!authorization) return undefined;
    const [scheme, token] = authorization.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? token : undefined;
  }
}