import { Controller, Get, Header } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Statik OpenAPI 3 belgesi — docs/developer/openapi.json
 * Çalışma dizininden monorepo köküne göreli arar.
 */
@Controller()
export class OpenApiController {
  private cached: Record<string, unknown> | null = null;

  @Get(['openapi.json', 'v1/openapi.json'])
  @Header('Cache-Control', 'public, max-age=300')
  openapi() {
    if (this.cached) return this.cached;
    const candidates = [
      join(process.cwd(), 'docs/developer/openapi.json'),
      join(process.cwd(), '../../docs/developer/openapi.json'),
      join(__dirname, '../../../../docs/developer/openapi.json'),
    ];
    for (const path of candidates) {
      try {
        this.cached = JSON.parse(readFileSync(path, 'utf8')) as Record<
          string,
          unknown
        >;
        return this.cached;
      } catch {
        /* try next */
      }
    }
    return this.fallbackSpec();
  }

  private fallbackSpec(): Record<string, unknown> {
    return {
      openapi: '3.0.3',
      info: {
        title: 'Dracord API',
        version: '1.0.0',
        description:
          'openapi.json dosyası bulunamadı — gömülü özet. Repo: docs/developer/openapi.json',
      },
      paths: {
        '/v1/health': {
          get: {
            summary: 'Platform health',
            responses: { '200': { description: 'OK' } },
          },
        },
        '/.well-known/dracord': {
          get: {
            summary: 'Endpoint discovery',
            responses: { '200': { description: 'OK' } },
          },
        },
        '/oauth2/token': {
          post: {
            summary: 'OAuth token (authorization_code | refresh_token)',
            responses: { '200': { description: 'Token' } },
          },
        },
        '/billing/gifts': {
          get: { summary: 'List gifts', responses: { '200': { description: 'OK' } } },
          post: { summary: 'Create gift', responses: { '200': { description: 'OK' } } },
        },
        '/billing/gifts/redeem': {
          post: {
            summary: 'Redeem gift code',
            responses: { '200': { description: 'OK' } },
          },
        },
        '/reports': {
          post: {
            summary: 'User content report',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };
  }
}
