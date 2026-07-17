import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side web push. VAPID keys identify this server to browser push
 * services (FCM, Mozilla autopush, APNs web push). Generate a pair once with
 * `npx web-push generate-vapid-keys` and set:
 *
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — public key (safe to expose; the browser
 *                                    needs it to subscribe)
 *   VAPID_PRIVATE_KEY             — private key (server only)
 *   VAPID_SUBJECT                 — optional mailto: contact for push services
 *
 * See docs/PUSH_SETUP.md for the full walkthrough.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path opened when the notification is tapped. */
  url?: string;
  /** Collapse key — a new push with the same tag replaces the old one. */
  tag?: string;
}

export interface PushSendOptions {
  /** Seconds the push service should retry delivery to an offline device. */
  ttl?: number;
  /** 'high' wakes phones for time-sensitive alerts like call reminders. */
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  user_email: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:notifications@zipline.media';

let configured = false;
if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (err) {
    console.error('Invalid VAPID configuration — web push disabled:', err);
  }
}

export function isPushConfigured(): boolean {
  return configured;
}

export function getVapidPublicKey(): string {
  return publicKey;
}

/**
 * Send one payload to a set of stored subscriptions. Endpoints the push
 * service reports as gone (404/410 — browser data cleared, permission
 * revoked, subscription rotated) are pruned from the table so dead devices
 * don't accumulate. Other failures are logged and skipped; one bad device
 * never blocks the rest.
 */
export async function sendToSubscriptions(
  admin: SupabaseClient,
  subs: PushSubscriptionRow[],
  payload: PushPayload,
  options: PushSendOptions = {}
): Promise<{ sent: number; failed: number; pruned: number }> {
  if (!configured || subs.length === 0) return { sent: 0, failed: 0, pruned: 0 };

  const body = JSON.stringify(payload);
  const gone: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          {
            TTL: options.ttl ?? 4 * 60 * 60,
            urgency: options.urgency || 'normal',
          }
        );
        sent++;
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          gone.push(s.id);
        } else {
          failed++;
          console.error(`Push to ${s.user_email || s.user_id} failed:`, code || (err as Error)?.message);
        }
      }
    })
  );

  if (gone.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', gone);
  }
  return { sent, failed, pruned: gone.length };
}

/** Send to every device registered by the given auth users. */
export async function sendToUsers(
  admin: SupabaseClient,
  userIds: string[],
  payload: PushPayload,
  options?: PushSendOptions
): Promise<{ sent: number; failed: number; pruned: number }> {
  if (!configured || userIds.length === 0) return { sent: 0, failed: 0, pruned: 0 };
  const { data } = await admin
    .from('push_subscriptions')
    .select('id, user_id, user_email, endpoint, p256dh, auth')
    .in('user_id', userIds);
  return sendToSubscriptions(admin, (data as PushSubscriptionRow[]) || [], payload, options);
}
