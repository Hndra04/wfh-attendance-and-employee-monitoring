import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthRequestUser, AuthResult } from './auth.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_COOKIE = 'wfh_absensi_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/auth';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in as an employee' })
  @ApiResponse({ status: 200, description: 'Returns an access token and sets a refresh cookie.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(
    @Body() credentials: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      credentials.email,
      credentials.password,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );

    this.setRefreshCookie(response, result.refreshToken);
    return this.withoutRefreshToken(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Rotate the refresh token' })
  @ApiResponse({ status: 200, description: 'Returns a new access token and rotates the cookie.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token.' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refresh(this.readRefreshCookie(request));
    this.setRefreshCookie(response, result.refreshToken);
    return this.withoutRefreshToken(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(this.readRefreshCookie(request));
    this.clearRefreshCookie(response);
    return { status: 'ok' };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get the current employee' })
  async getCurrentUser(@Req() request: AuthRequestUser) {
    return request.user;
  }

  @Patch('me/password')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change the current user password' })
  @ApiResponse({ status: 204, description: 'Password changed; refresh sessions are revoked.' })
  async changePassword(
    @Req() request: AuthRequestUser,
    @Body() passwords: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.changePassword(
      request.user.id,
      passwords.currentPassword,
      passwords.newPassword,
    );
    this.clearRefreshCookie(response);
  }

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    });
  }

  private readRefreshCookie(request: Request): string | undefined {
    const cookie = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${REFRESH_COOKIE}=`));

    return cookie?.slice(REFRESH_COOKIE.length + 1);
  }

  private withoutRefreshToken(result: AuthResult) {
    const { refreshToken: _refreshToken, ...response } = result;
    return response;
  }
}
