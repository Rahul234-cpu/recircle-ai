import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(token) {
  if (socket) socket.disconnect();
  const url = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || window.location.origin;
  socket = io(url, { auth: { token }, transports: ['websocket', 'polling'], reconnectionAttempts: 10 });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
}
