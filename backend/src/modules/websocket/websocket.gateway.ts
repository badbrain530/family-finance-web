import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { WebsocketService } from './websocket.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

/**
 * Socket.IO WebSocket 网关
 *
 * 实现家庭协同实时通信：
 * - 连接认证（JWT验证）
 * - 家庭房间管理（join/leave）
 * - 事件广播（交易变更/预算预警/通知/导入完成/月报就绪）
 * - 在线状态管理
 *
 * 事件列表：
 * 客户端→服务端：family:join, family:leave, typing:start
 * 服务端→客户端：transaction:created/updated/deleted, member:online/offline,
 *                budget:alert, notification:new, import:completed, report:ready
 */
@WebSocketGateway({
  namespace: '/',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WebsocketGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly websocketService: WebsocketService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Gateway初始化完成后，设置广播回调
   */
  afterInit(): void {
    // 设置广播回调：通过Socket.IO向家庭房间广播
    this.websocketService.setBroadcastCallback((familyId, event, data) => {
      const roomName = `family:${familyId}`;
      this.server.to(roomName).emit(event, data);
    });

    // 设置单播回调：向指定用户的所有连接发送
    this.websocketService.setSendToUserCallback((userId, event, data) => {
      // 通过用户房间发送（每个用户有一个 user:{userId} 的个人房间）
      const userRoom = `user:${userId}`;
      this.server.to(userRoom).emit(event, data);
    });

    this.logger.log('WebSocket Gateway 初始化完成');
  }

  /**
   * 客户端连接时处理
   * 1. 验证JWT
   * 2. 记录用户上线
   * 3. 自动加入用户个人房间
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // 从连接auth参数中获取token
      const authToken = client.handshake.auth?.token as string;
      if (!authToken) {
        this.logger.warn(`连接拒绝: 无token, socketId=${client.id}`);
        client.disconnect();
        return;
      }

      // 验证JWT
      const payload = this.jwtService.verify(authToken, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret'),
      });

      const userId = payload.sub;
      if (!userId) {
        this.logger.warn(`连接拒绝: 无效token, socketId=${client.id}`);
        client.disconnect();
        return;
      }

      // 将userId存储到socket上
      (client as any).userId = userId;
      (client as any).nickname = payload.nickname;

      // 加入用户个人房间（用于单播通知）
      client.join(`user:${userId}`);

      // 查询用户所属的家庭
      const familyMembers = await this.prisma.familyMember.findMany({
        where: { userId },
        select: { familyId: true },
      });
      const familyIds = familyMembers.map((m) => m.familyId);

      // 记录用户上线
      this.websocketService.userOnline(userId, client.id, familyIds);

      this.logger.log(`客户端连接: userId=${userId}, socketId=${client.id}`);
    } catch (error) {
      this.logger.warn(`连接认证失败: ${error instanceof Error ? error.message : '未知错误'}`);
      client.disconnect();
    }
  }

  /**
   * 客户端断开连接时处理
   * 记录用户下线，广播离线状态
   */
  handleDisconnect(client: Socket): void {
    const userId = (client as any).userId;
    if (userId) {
      this.websocketService.userOffline(client.id);
      this.logger.log(`客户端断开: userId=${userId}, socketId=${client.id}`);
    }
  }

  // ==================== 客户端→服务端事件 ====================

  /**
   * 加入家庭房间
   * 客户端登录后自动调用，加入所有所属家庭的房间
   */
  @SubscribeMessage('family:join')
  async handleFamilyJoin(
    @MessageBody() data: { familyId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean }> {
    const userId = (client as any).userId;
    if (!userId) {
      return { success: false };
    }

    // 验证用户是否为家庭成员
    const member = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: data.familyId, userId } },
    });

    if (!member) {
      this.logger.warn(`加入家庭房间失败: userId=${userId} 不是家庭 ${data.familyId} 的成员`);
      return { success: false };
    }

    const roomName = `family:${data.familyId}`;
    client.join(roomName);

    this.logger.log(`用户 ${userId} 加入家庭房间: ${roomName}`);
    return { success: true };
  }

  /**
   * 离开家庭房间
   */
  @SubscribeMessage('family:leave')
  handleFamilyLeave(
    @MessageBody() data: { familyId: string },
    @ConnectedSocket() client: Socket,
  ): { success: boolean } {
    const roomName = `family:${data.familyId}`;
    client.leave(roomName);

    const userId = (client as any).userId;
    this.logger.log(`用户 ${userId} 离开家庭房间: ${roomName}`);
    return { success: true };
  }

  /**
   * 正在输入事件（显示"XX正在记账"）
   */
  @SubscribeMessage('typing:start')
  handleTypingStart(
    @MessageBody() data: { ledgerId: string; familyId?: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const userId = (client as any).userId;
    const nickname = (client as any).nickname;

    // 广播给同房间的其他用户
    if (data.familyId) {
      const roomName = `family:${data.familyId}`;
      client.to(roomName).emit('typing:start', {
        userId,
        nickname,
        ledgerId: data.ledgerId,
      });
    }
  }

  /**
   * 获取家庭在线成员
   */
  @SubscribeMessage('family:online-members')
  handleGetOnlineMembers(
    @MessageBody() data: { familyId: string },
  ): { members: string[] } {
    return {
      members: this.websocketService.getOnlineMembers(data.familyId),
    };
  }
}
