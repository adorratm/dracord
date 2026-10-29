import { ConfigService } from '@nestjs/config';

export function isPlatformApiEnabled(config: ConfigService): boolean {
  return config.get<string>('PLATFORM_API') === 'true';
}

export function isPlatformOauthEnabled(config: ConfigService): boolean {
  return (
    config.get<string>('PLATFORM_OAUTH') === 'true' ||
    isPlatformApiEnabled(config)
  );
}

export function isNitroPaymentsEnabled(config: ConfigService): boolean {
  return config.get<string>('NITRO_PAYMENTS') === 'true';
}

export function isAutoModEnabled(config: ConfigService): boolean {
  // Varsayılan: açık (zararsız kelime filtresi). Kapamak: AUTO_MOD=false
  return config.get<string>('AUTO_MOD') !== 'false';
}
