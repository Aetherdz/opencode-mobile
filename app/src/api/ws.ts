import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';
import type { ClientWsEvent, ServerWsEvent } from './types';

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'offline';

interface ConnectionStore {
  state: ConnectionState;
  latency: number | null;
  lastError: string | null;
}

export const useConnection = create<ConnectionStore>(() => ({
  state: 'idle',
  latency: null,
  lastError: null,
}));

type Listener = (event: ServerWsEvent) => void;

class BridgeSocket {
  private socket: WebSocket | null = null;
  private baseUrl = '';
  private token = '';
  private readonly subscriptions = new Set<string>();
  private readonly listeners = new Set<Listener>();
  private readonly lastEventIds = new Map<string, string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private attempt = 0;
  private closedByUser = false;
  private appState: AppStateStatus = 'active';
  private appStateBound = false;

  connect(baseUrl: string, token: string): void {
    const normalized = baseUrl.replace(/\/+$/, '').replace(/^http/i, 'ws');
    if (this.socket && this.baseUrl === normalized && this.token === token) {
      if (this.socket.readyState === WebSocket.OPEN) return;
    }
    this.baseUrl = normalized;
    this.token = token;
    this.closedByUser = false;
    this.bindAppState();
    this.open();
  }

  private bindAppState(): void {
    if (this.appStateBound) return;
    this.appStateBound = true;
    AppState.addEventListener('change', (next) => {
      const previous = this.appState;
      this.appState = next;
      if (next === 'active' && previous !== 'active' && !this.closedByUser) {
        this.open();
      }
      if (next !== 'active' && this.socket) {
        this.clearTimers();
        try {
          this.socket.close();
        } catch {
          // ignore
        }
        this.socket = null;
        useConnection.setState({ state: 'idle' });
      }
    });
  }

  reconnect(): void {
    this.closedByUser = false;
    this.attempt = 0;
    this.clearTimers();
    this.open();
  }

  disconnect(): void {
    this.closedByUser = true;
    this.clearTimers();
    this.attempt = 0;
    if (this.socket) {
      try {
        this.socket.close(1000, 'client disconnect');
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.subscriptions.clear();
    this.lastEventIds.clear();
    useConnection.setState({ state: 'idle', latency: null, lastError: null });
  }

  subscribe(sessionId: string): void {
    if (this.subscriptions.has(sessionId)) return;
    this.subscriptions.add(sessionId);
    this.send({
      type: 'subscribe',
      sessionId,
      ...(this.lastEventIds.get(sessionId)
        ? { lastEventId: this.lastEventIds.get(sessionId) as string }
        : {}),
    });
  }

  unsubscribe(sessionId: string): void {
    this.subscriptions.delete(sessionId);
    this.send({ type: 'unsubscribe', sessionId });
  }

  send(event: ClientWsEvent): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    try {
      this.socket.send(JSON.stringify(event));
      return true;
    } catch {
      return false;
    }
  }

  addListener(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private open(): void {
    if (!this.baseUrl || !this.token) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.clearTimers();
    const url = `${this.baseUrl}/ws?token=${encodeURIComponent(this.token)}`;
    useConnection.setState({
      state: this.attempt === 0 ? 'connecting' : 'reconnecting',
      lastError: null,
    });
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.attempt = 0;
      useConnection.setState({ state: 'open', lastError: null });
      for (const sessionId of this.subscriptions) {
        const lastEventId = this.lastEventIds.get(sessionId);
        this.send({
          type: 'subscribe',
          sessionId,
          ...(lastEventId ? { lastEventId } : {}),
        });
      }
      this.pingTimer = setInterval(() => {
        this.send({ type: 'ping' });
      }, 20_000);
    };

    socket.onmessage = (message) => {
      let event: ServerWsEvent;
      try {
        event = JSON.parse(String(message.data)) as ServerWsEvent;
      } catch {
        return;
      }
      if (event.type === 'pong') {
        useConnection.setState({ latency: Math.max(0, Date.now() - event.t) });
        return;
      }
      const record = event as ServerWsEvent & { eventId?: string };
      if (record.eventId && 'sessionId' in record && typeof record.sessionId === 'string') {
        this.lastEventIds.set(record.sessionId, record.eventId);
      }
      for (const listener of this.listeners) listener(event);
    };

    socket.onerror = () => {
      useConnection.setState({ lastError: 'WebSocket error' });
    };

    socket.onclose = () => {
      this.socket = null;
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      if (this.closedByUser) return;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) return;
    if (this.appState !== 'active') {
      useConnection.setState({ state: 'idle' });
      return;
    }
    const delay = Math.min(1000 * 2 ** this.attempt, 15_000);
    this.attempt += 1;
    useConnection.setState({ state: 'reconnecting' });
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

export const bridgeSocket = new BridgeSocket();
