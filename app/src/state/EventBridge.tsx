import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerPushToken } from '@/api/client';
import { bridgeSocket } from '@/api/ws';
import type { SessionSummary } from '@/api/types';
import { registerForPushNotifications } from '@/lib/notifications';
import { useAuth } from '@/state/auth';
import { useChat } from '@/state/chat';
import { useSettings } from '@/state/settings';

export function EventBridge() {
  const queryClient = useQueryClient();
  const hydrated = useAuth((state) => state.hydrated);
  const baseUrl = useAuth((state) => state.baseUrl);
  const token = useAuth((state) => state.token);
  const notifications = useSettings((state) => state.notifications);

  useEffect(() => {
    if (!hydrated) return;
    if (!baseUrl || !token) {
      bridgeSocket.disconnect();
      return;
    }
    bridgeSocket.connect(baseUrl, token);
    void queryClient.invalidateQueries({ queryKey: ['sessions'] });
  }, [baseUrl, hydrated, queryClient, token]);

  useEffect(() => {
    const unsubscribe = bridgeSocket.addListener((event) => {
      useChat.getState().applyEvent(event);

      if (event.type === 'session.updated') {
        queryClient.setQueryData<SessionSummary[]>(['sessions'], (current) => {
          if (!current) return current;
          const next = current.some((session) => session.id === event.session.id)
            ? current.map((session) =>
                session.id === event.session.id ? { ...session, ...event.session } : session,
              )
            : [event.session, ...current];
          return next
            .slice()
            .sort((a, b) => b.lastActivity - a.lastActivity);
        });
        queryClient.setQueryData(['session', event.session.id], event.session);
        return;
      }

      if (event.type === 'status') {
        queryClient.setQueryData<SessionSummary[]>(['sessions'], (current) => {
          if (!current) return current;
          return current.map((session) =>
            session.id === event.sessionId
              ? {
                  ...session,
                  status: event.status,
                  ...(event.busyOrigin ? { busyOrigin: event.busyOrigin } : { busyOrigin: undefined }),
                  lastActivity: Date.now(),
                }
              : session,
          );
        });
        queryClient.setQueryData<SessionSummary>(['session', event.sessionId], (current) =>
          current
            ? {
                ...current,
                status: event.status,
                ...(event.busyOrigin ? { busyOrigin: event.busyOrigin } : { busyOrigin: undefined }),
                lastActivity: Date.now(),
              }
            : current,
        );
        return;
      }

      if (event.type === 'message.created' && event.message.role === 'user') {
        const chat = useChat.getState();
        const waiting =
          chat.sessionId === event.sessionId &&
          (chat.questions.length > 0 || chat.approvals.length > 0);
        queryClient.setQueryData<SessionSummary[]>(['sessions'], (current) => {
          if (!current) return current;
          return current
            .map((session) =>
              session.id === event.sessionId
                ? {
                    ...session,
                    lastActivity: Date.now(),
                    status: waiting ? chat.status : ('running' as const),
                  }
                : session,
            )
            .sort((a, b) => b.lastActivity - a.lastActivity);
        });
      }
    });
    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    if (!notifications || !baseUrl || !token) return;
    let active = true;
    void registerForPushNotifications().then(async (result) => {
      if (!active || !result.ok) return;
      try {
        await registerPushToken(
          result.token,
          Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
        );
      } catch {
        // notifications are optional; never block the app
      }
    });
    return () => {
      active = false;
    };
  }, [baseUrl, notifications, token]);

  return null;
}
