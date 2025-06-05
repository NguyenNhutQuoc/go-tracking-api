// src/presentation/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import {
  AuthService,
  JwtPayload,
} from '../../core/application/services/auth.service';

// Extend Express Request interface to include 'user'
import { Request } from 'express';
declare module 'express' {
  interface Request {
    user?: any;
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
  ) {
    super();
  }

  getRequest(context: ExecutionContext): Request {
    const ctx = GqlExecutionContext.create(context);
    const graphqlContext = ctx.getContext<{ req: Request }>();
    const request = graphqlContext.req;
    return request;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access token not found');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const user = await this.authService.validateJwtPayload(payload);

      // Attach user to request for use in resolvers
      request.user = user;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authorization = request.headers?.authorization;
    if (!authorization) return undefined;

    const [type, token] = authorization.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
