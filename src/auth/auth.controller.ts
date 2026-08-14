import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ip: ip ?? req.socket.remoteAddress,
    });
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Headers('authorization') authorization?: string) {
    return this.authService.logout(this.extractToken(authorization));
  }

  @Get('profile')
  profile(@Headers('authorization') authorization?: string) {
    return this.authService.profile(this.extractToken(authorization));
  }

  private extractToken(authorization?: string): string | undefined {
    if (!authorization) return undefined;
    const [scheme, token] = authorization.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? token : undefined;
  }
}