import type { WebSocket } from 'ws';
import type { AuthUser } from './sessions.js';

interface ConnectedClient {
  socket: WebSocket;
  user: AuthUser;
}

const clients = new Set<ConnectedClient>();

export function registerClient(socket: WebSocket, user: AuthUser): () => void {
  const client: ConnectedClient = { socket, user };
  clients.add(client);

  return () => {
    clients.delete(client);
  };
}

export function broadcastToAll(event: string, payload: unknown): void {
  const msg = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.socket.readyState === client.socket.OPEN) {
      client.socket.send(msg);
    }
  }
}

export function broadcastToAdmins(event: string, payload: unknown): void {
  const msg = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.user.role === 'admin' && client.socket.readyState === client.socket.OPEN) {
      client.socket.send(msg);
    }
  }
}

export function broadcastToTeams(event: string, payload: unknown): void {
  const msg = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.user.role === 'team' && client.socket.readyState === client.socket.OPEN) {
      client.socket.send(msg);
    }
  }
}

export function sendToTeam(teamId: string, event: string, payload: unknown): void {
  const msg = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.user.team?.id === teamId && client.socket.readyState === client.socket.OPEN) {
      client.socket.send(msg);
    }
  }
}
