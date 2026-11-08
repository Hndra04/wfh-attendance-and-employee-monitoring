import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const trustedProxyHops = Number(process.env.TRUSTED_PROXY_HOPS ?? 0);

  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0) {
    throw new Error('TRUSTED_PROXY_HOPS must be a non-negative integer.');
  }

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5174',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.getHttpAdapter().getInstance().set('trust proxy', trustedProxyHops);

  const config = new DocumentBuilder()
    .setTitle('Monitoring API')
    .setDescription('HRD monitoring service API for the WFH attendance and employee monitoring system.')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('wfh_monitoring_refresh', { type: 'apiKey', in: 'cookie' })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT_MONITORING ?? 3002);
  await app.listen(port);
}

bootstrap();
