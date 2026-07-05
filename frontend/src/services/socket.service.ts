import { io, type Socket } from 'socket.io-client';
import { WS_URL } from '@/lib/constants';
import { WS_EVENTS } from '@/types/websocket';
import { useAuthStore } from '@/store/authStore';

/**
 * WebSocket连接管理服务
 * 负责Socket.IO连接建立、家庭房间管理、事件订阅
 */

let socket: Socket | null = null;

/**
 * 获取Socket.IO实例（单例）
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * 连接WebSocket
 * 登录后自动调用，携带JWT Token认证
 */
export function connectSocket(): Socket {
  if (socket?.connected) {
    return socket;
  }

  const { accessToken } = useAuthStore.getState();

  socket = io(WS_URL, {
    transports: ['websocket', 'polling'],
    auth: { token: accessToken },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('[WebSocket] 连接成功');
  });

  socket.on('disconnect', (reason) => {
    console.log('[WebSocket] 断开连接:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[WebSocket] 连接错误:', error.message);
  });

  return socket;
}

/**
 * 断开WebSocket连接
 * 登出时调用
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/**
 * 加入家庭房间
 * 登录后或切换家庭时自动调用
 */
export function joinFamilyRoom(familyId: string): void {
  if (socket?.connected) {
    socket.emit(WS_EVENTS.FAMILY_JOIN, { familyId });
  }
}

/**
 * 离开家庭房间
 * 切换家庭或登出时调用
 */
export function leaveFamilyRoom(familyId: string): void {
  if (socket?.connected) {
    socket.emit(WS_EVENTS.FAMILY_LEAVE, { familyId });
  }
}

/**
 * 通用事件订阅
 * @param event 事件名称
 * @param handler 回调函数
 */
export function on<T = any>(event: string, handler: (data: T) => void): void {
  if (socket) {
    socket.on(event, handler);
  }
}

/**
 * 取消事件订阅
 */
export function off(event: string, handler?: (...args: any[]) => void): void {
  if (socket) {
    socket.off(event, handler);
  }
}
