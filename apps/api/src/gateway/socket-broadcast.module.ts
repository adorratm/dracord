import { Global, Module } from '@nestjs/common';
import { SocketBroadcastService } from './socket-broadcast.service';

/** ChatGateway’den bağımsız; dairesel Nest/webpack import’larını önler. */
@Global()
@Module({
  providers: [SocketBroadcastService],
  exports: [SocketBroadcastService],
})
export class SocketBroadcastModule {}
