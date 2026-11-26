import { Module } from '@nestjs/common';
import { RecapController } from './recap.controller';
import { RecapService } from './recap.service';

@Module({ controllers: [RecapController], providers: [RecapService] })
export class RecapModule {}
