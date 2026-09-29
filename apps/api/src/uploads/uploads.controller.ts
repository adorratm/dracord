import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('presign')
  presign(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { filename: string; contentType: string; folder?: string },
  ) {
    return this.uploads.createPresignedUpload(user.sub, body);
  }
}
