import { NextResponse } from 'next/server';
import { getValidGoogleToken } from '@/lib/google-auth';
import { getAuthedUserId } from '@/lib/api-auth';

// Realistic mock email threads for fallbacks or demonstration
const MOCK_THREADS = [
  {
    id: 'mock_thread_1',
    subject: 'Broadway B-Roll Reveal V2 - Review & Approval',
    snippet: 'Looks incredible Matt! This is approved. Can we get the final delivery files by tomorrow morning?',
    lastMessageDate: '2 hours ago',
    unread: true,
    label: 'Client',
    labelColor: 'accent',
    messages: [
      {
        id: 'mock_msg_1_1',
        from: 'Claude Films <claudefilms@gmail.com>',
        to: 'Matt <matt@zipline.media>',
        date: 'June 21, 2026, 4:12 PM',
        snippet: 'Hi team, here is the V2 edit of the Broadway B-Roll Reveal. The opening night shots are stunning...',
        body: `<p>Hi team,</p>
               <p>Here is the V2 edit of the <strong>Broadway B-Roll Reveal</strong>. The opening night shots look absolutely stunning! The coloring is spot on.</p>
               <p>However, the transition at 0:42 feels a bit abrupt. Can we extend the B-roll by 5 frames to let it breathe? Let me know if that's possible.</p>
               <p>Best,<br>Claude</p>`
      },
      {
        id: 'mock_msg_1_2',
        from: 'Matt <matt@zipline.media>',
        to: 'Claude Films <claudefilms@gmail.com>',
        date: 'June 21, 2026, 6:30 PM',
        snippet: "Hey Claude, thanks for the feedback! I've updated the transition at 0:42 and uploaded the new edit...",
        body: `<p>Hey Claude,</p>
               <p>Thanks for the quick feedback! I went ahead and extended that B-roll shot at 0:42 by 6 frames so the audio cue matches the cut better. The updated master has been rendered and uploaded to the review link.</p>
               <p>Let me know how this version feels.</p>
               <p>Best,<br>Matt</p>`
      },
      {
        id: 'mock_msg_1_3',
        from: 'Claude Films <claudefilms@gmail.com>',
        to: 'Matt <matt@zipline.media>',
        date: 'June 21, 2026, 9:45 PM',
        snippet: 'Looks incredible Matt! This is approved. Can we get the final delivery files by tomorrow morning?',
        body: `<p>Looks incredible Matt! This version is 100% approved. Much better flow on that opening cut.</p>
               <p>Can we get the final ProRes and H.264 delivery files by tomorrow morning? We have the media press release going out at noon.</p>
               <p>Thanks again for the fast turnaround!</p>`
      }
    ]
  },
  {
    id: 'mock_thread_2',
    subject: 'Opening Night Audio Stems & Mastering Sync',
    snippet: 'Hey Matt, I\'ve finished the master mix for the opening night reveals. Audio stems zip is on Google Drive.',
    lastMessageDate: 'Yesterday',
    unread: false,
    label: 'Crew',
    labelColor: 'purple-500',
    messages: [
      {
        id: 'mock_msg_2_1',
        from: 'Luis Pimentel <luispimentelsounds@gmail.com>',
        to: 'Matt <matt@zipline.media>',
        date: 'June 20, 2026, 2:15 PM',
        snippet: "Hey Matt, I've finished the master mix for the opening night reveals. Some of the TVC audio stems...",
        body: `<p>Hey Matt,</p>
               <p>I've finished the master stereo mix and surround stems for the opening night reveals.</p>
               <p>Some of the TVC audio stems had slight clipping around the 1:15 mark, so I ran them through RX and cleaned up the high end. It sounds super clean now. I've uploaded the full high-res Stems zip to the Google Drive project folder.</p>
               <p>Let me know if we need any adjustments for the theatrical release.</p>
               <p>Cheers,<br>Luis</p>`
      }
    ]
  },
  {
    id: 'mock_thread_3',
    subject: 'Broadway Cast Album - Tuesday Session Details',
    snippet: 'Hi Matt, confirming the studio booking for Tuesday\'s cast recordings. We have 14 singers scheduled.',
    lastMessageDate: 'June 19',
    unread: false,
    label: 'Client',
    labelColor: 'accent',
    messages: [
      {
        id: 'mock_msg_3_1',
        from: 'Chad Henderson <chadhendersonmusic@gmail.com>',
        to: 'Matt <matt@zipline.media>',
        date: 'June 19, 2026, 11:05 AM',
        snippet: "Hi Matt, confirming the studio booking for Tuesday's cast recordings. We have 14 singers scheduled...",
        body: `<p>Hi Matt,</p>
               <p>Confirming the studio booking for Tuesday's cast recordings. We have 14 singers scheduled between 10 AM and 6 PM. We should be running two rooms simultaneously.</p>
               <p>Could you double-check if we have the Neumann U87s and Sennheiser 416s packed in the gear manifest? Also, we'll need the teleprompter rigs set up for the lyrics feed.</p>
               <p>Best,<br>Chad</p>`
      }
    ]
  },
  {
    id: 'mock_thread_4',
    subject: 'Rentals manifest verification - TVC Shoot',
    snippet: 'Hey, looking over the gear builder manifest for the TVC shoot. We are short one Arri Alexa Mini LF body.',
    lastMessageDate: 'June 18',
    unread: true,
    label: 'Gear',
    labelColor: 'yellow-500',
    messages: [
      {
        id: 'mock_msg_4_1',
        from: 'Tom Fama <tomfama96@gmail.com>',
        to: 'Matt <matt@zipline.media>',
        date: 'June 18, 2026, 9:20 AM',
        snippet: "Hey, looking over the gear builder manifest for the TVC shoot. We are short one Arri Alexa Mini LF body...",
        body: `<p>Hey,</p>
               <p>I was looking over the gear builder manifest for the TVC shoot next weekend.</p>
               <p>It looks like we are short one <strong>Arri Alexa Mini LF</strong> body. Did we arrange a sub-rental for this from PRG, or are we hoping to pull it from house inventory? We have three active sets shooting simultaneously on Saturday.</p>
               <p>Please let me know so I can confirm the pick-up schedule.</p>
               <p>Thanks,<br>Tom</p>`
      }
    ]
  },
  {
    id: 'mock_thread_5',
    subject: 'Social Clips for website homepage',
    snippet: 'Hey Matt, I picked out six high-performing social clips to place above the client ticker on the homepage.',
    lastMessageDate: 'June 17',
    unread: false,
    label: 'Marketing',
    labelColor: 'green-500',
    messages: [
      {
        id: 'mock_msg_5_1',
        from: 'Rob McEnaney <robmcenaney@gmail.com>',
        to: 'Matt <matt@zipline.media>',
        date: 'June 17, 2026, 3:40 PM',
        snippet: "Hey Matt, I picked out six high-performing social clips to place above the client ticker on the homepage...",
        body: `<p>Hey Matt,</p>
               <p>I picked out six high-performing social clips to place above the client ticker on the homepage. They showcase the Broadway Opening Nights and Cast Recording playlists best.</p>
               <p>Let's link up tomorrow to get them integrated. They are all organized in the Broadway B-Roll playlist. Let me know what time works.</p>
               <p>Best,<br>Rob</p>`
      }
    ]
  }
];

// Gmail's standard inbox tabs. The values are Gmail search operators used
// with threads.list's `q` param — identical to how Gmail's own tab bar works.
const GMAIL_CATEGORIES: Record<string, string> = {
  primary: 'category:primary',
  social: 'category:social',
  promotions: 'category:promotions',
  updates: 'category:updates',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  const threadId = searchParams.get('threadId');
  const category = searchParams.get('category');
  const q = searchParams.get('q');
  const pageToken = searchParams.get('pageToken');

  // Identity comes from the caller's verified session, never a query param, so
  // a signed-in user can only ever read their own mailbox.
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 1. Fetch valid Google token
  const token = await getValidGoogleToken(userId);

  // If there is no valid token, fall back to mock data
  if (!token) {
    return handleMockActions(action, threadId);
  }

  try {
    if (action === 'list') {
      // 2. Fetch list of recent email threads. A user search (`q`) spans the
      // whole mailbox exactly like Gmail's search bar; otherwise the category
      // tab (Primary / Social / Promotions / Updates) scopes the view.
      const categoryQuery = category ? GMAIL_CATEGORIES[category] : undefined;
      const searchQ = q?.trim() ? q.trim() : categoryQuery;
      const resList = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=25` +
          (searchQ ? `&q=${encodeURIComponent(searchQ)}` : '') +
          (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''),
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!resList.ok) {
        throw new Error(`Gmail API list returned status ${resList.status}`);
      }

      const listData = await resList.json();
      const threads = listData.threads || [];

      // The connected account's own address, so the client can tell "me"
      // apart from everyone else (message alignment, reply targets).
      let accountEmail: string | null = null;
      try {
        const profRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (profRes.ok) accountEmail = (await profRes.json()).emailAddress || null;
      } catch { /* cosmetic only */ }

      // Fetch details for each thread in parallel
      const threadDetails = await Promise.all(
        threads.map(async (t: any) => {
          try {
            const resDetail = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}`,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
            if (!resDetail.ok) return null;
            const detailData = await resDetail.json();
            const messages = detailData.messages || [];
            if (messages.length === 0) return null;

            const firstMsg = messages[0];
            const lastMsg = messages[messages.length - 1];

            // Extract headers
            const getHeader = (msg: any, name: string) => {
              const header = msg.payload?.headers?.find(
                (h: any) => h.name.toLowerCase() === name.toLowerCase()
              );
              return header ? header.value : '';
            };

            const subject = getHeader(firstMsg, 'Subject') || '(No Subject)';
            const from = getHeader(lastMsg, 'From') || 'Unknown';
            const snippet = lastMsg.snippet || '';

            // Gmail-style dates: time of day for today's mail, short date otherwise
            const dateStr = getHeader(lastMsg, 'Date');
            let formattedDate = 'Recent';
            if (dateStr) {
              const d = new Date(dateStr);
              if (!isNaN(d.getTime())) {
                formattedDate = d.toDateString() === new Date().toDateString()
                  ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                  : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              }
            }

            // Determine if unread (contains UNREAD label)
            const isUnread = messages.some((m: any) => m.labelIds?.includes('UNREAD'));
            const starred = messages.some((m: any) => m.labelIds?.includes('STARRED'));
            const hasAttachments = messages.some((m: any) => collectAttachments(m).length > 0);

            // Label mapping (Client, Crew, Billing) based on content or headers
            let label = 'General';
            let labelColor = 'accent';

            const lowerSubject = subject.toLowerCase();
            const lowerFrom = from.toLowerCase();
            if (lowerSubject.includes('invoice') || lowerSubject.includes('bill') || lowerSubject.includes('payment')) {
              label = 'Billing';
              labelColor = 'yellow-500';
            } else if (lowerSubject.includes('edit') || lowerSubject.includes('reveal') || lowerSubject.includes('review') || lowerSubject.includes('approve')) {
              label = 'Review';
              labelColor = 'purple-500';
            } else if (lowerSubject.includes('manifest') || lowerSubject.includes('gear') || lowerSubject.includes('rental')) {
              label = 'Gear';
              labelColor = 'green-500';
            } else if (lowerFrom.includes('.media') || lowerFrom.includes('zipline')) {
              label = 'Internal';
              labelColor = 'white/20';
            }

            return {
              id: t.id,
              subject,
              snippet,
              from: parseFromName(from),
              lastMessageDate: formattedDate,
              unread: isUnread,
              starred,
              hasAttachments,
              label,
              labelColor
            };
          } catch (e) {
            console.error(`Error fetching thread detail for ${t.id}:`, e);
            return null;
          }
        })
      );

      const filteredThreads = threadDetails.filter(Boolean);
      return NextResponse.json({
        threads: filteredThreads,
        nextPageToken: listData.nextPageToken || null,
        accountEmail,
        isLive: true
      });
    }

    if (action === 'thread') {
      if (!threadId) {
        return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
      }

      // Fetch specific thread and mark thread messages as read (remove UNREAD label)
      const resDetail = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!resDetail.ok) {
        throw new Error(`Gmail API fetch thread returned status ${resDetail.status}`);
      }

      const detailData = await resDetail.json();
      const apiMessages = detailData.messages || [];

      // Format messages for client
      const formattedMessages = apiMessages.map((msg: any) => {
        const getHeader = (name: string) => {
          const header = msg.payload?.headers?.find(
            (h: any) => h.name.toLowerCase() === name.toLowerCase()
          );
          return header ? header.value : '';
        };

        // Extract HTML body if available, else text body
        let bodyHtml = '';
        const parts = msg.payload?.parts;
        
        const extractBody = (partList: any[]): string => {
          for (const part of partList) {
            if (part.mimeType === 'text/html' && part.body?.data) {
              return Buffer.from(part.body.data, 'base64').toString('utf8');
            }
            if (part.parts) {
              const body = extractBody(part.parts);
              if (body) return body;
            }
          }
          // Fallback to text/plain
          for (const part of partList) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              const plainText = Buffer.from(part.body.data, 'base64').toString('utf8');
              return `<p>${plainText.replace(/\n/g, '<br>')}</p>`;
            }
          }
          return '';
        };

        if (parts) {
          bodyHtml = extractBody(parts);
        } else if (msg.payload?.body?.data) {
          const dataStr = Buffer.from(msg.payload.body.data, 'base64').toString('utf8');
          if (msg.payload.mimeType === 'text/html') {
            bodyHtml = dataStr;
          } else {
            bodyHtml = `<p>${dataStr.replace(/\n/g, '<br>')}</p>`;
          }
        }

        if (!bodyHtml) {
          bodyHtml = `<p>${msg.snippet || ''}</p>`;
        }

        const dateStr = getHeader('Date');
        let formattedDate = 'Recent';
        if (dateStr) {
          const d = new Date(dateStr);
          formattedDate = isNaN(d.getTime())
            ? dateStr
            : d.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
        }

        return {
          id: msg.id,
          from: getHeader('From') || 'Unknown',
          to: getHeader('To') || 'Unknown',
          date: formattedDate,
          snippet: msg.snippet || '',
          body: bodyHtml,
          attachments: collectAttachments(msg)
        };
      });

      // Asynchronously remove unread label from messages in thread
      const unreadMsgIds = apiMessages
        .filter((m: any) => m.labelIds?.includes('UNREAD'))
        .map((m: any) => m.id);

      if (unreadMsgIds.length > 0) {
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ids: unreadMsgIds,
            removeLabelIds: ['UNREAD']
          })
        }).catch(err => console.error('Failed to clear unread flag on messages:', err));
      }

      return NextResponse.json({
        id: threadId,
        subject: formattedMessages[0] ? getHeaderValue(apiMessages[0], 'Subject') || '(No Subject)' : '(No Subject)',
        messages: formattedMessages,
        isLive: true
      });
    }

    if (action === 'attachment') {
      // Stream one attachment down to the browser. The id pair comes from the
      // thread payload we produced, and Gmail scopes it to this account's
      // token, so there's nothing extra to authorize here.
      const messageId = searchParams.get('messageId');
      const attachmentId = searchParams.get('attachmentId');
      const filename = (searchParams.get('filename') || 'attachment').replace(/[\r\n"\\]/g, '_');
      const mime = searchParams.get('mime') || 'application/octet-stream';
      if (!messageId || !attachmentId) {
        return NextResponse.json({ error: 'messageId and attachmentId are required' }, { status: 400 });
      }

      const attRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!attRes.ok) {
        throw new Error(`Gmail attachment fetch returned status ${attRes.status}`);
      }
      const attData = await attRes.json();
      const buf = Buffer.from(attData.data || '', 'base64url');
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, max-age=300',
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Gmail API Endpoint Error:', err.message);
    // If live API calls fail, fallback to mock data so layout remains fully operational
    return handleMockActions(action, threadId);
  }
}

// Thread-level actions: archive, trash, star, read state. Mirrors Gmail's own
// toolbar — all are label operations under the hood (gmail.modify scope).
const THREAD_OPS: Record<string, { add?: string[]; remove?: string[]; trash?: boolean }> = {
  archive: { remove: ['INBOX'] },
  trash: { trash: true },
  markRead: { remove: ['UNREAD'] },
  markUnread: { add: ['UNREAD'] },
  star: { add: ['STARRED'] },
  unstar: { remove: ['STARRED'] },
};

export async function PATCH(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { threadId, op } = await request.json();
    const spec = op ? THREAD_OPS[op] : undefined;
    if (!threadId || !spec) {
      return NextResponse.json({ error: 'A threadId and a valid op are required' }, { status: 400 });
    }

    const token = await getValidGoogleToken(userId);
    if (!token) {
      // Sandbox mode: report success so the optimistic UI stays coherent.
      return NextResponse.json({ success: true, isMock: true });
    }

    const url = spec.trash
      ? `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/trash`
      : `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: spec.trash
        ? undefined
        : JSON.stringify({ addLabelIds: spec.add || [], removeLabelIds: spec.remove || [] }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gmail ${op} returned status ${res.status}: ${errText}`);
    }

    return NextResponse.json({ success: true, isLive: true });
  } catch (err: any) {
    console.error('Gmail thread action failed:', err.message);
    return NextResponse.json({ error: err.message || 'Thread action failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const bodyParams = await request.json();
    const { to, subject, body, threadId } = bodyParams;

    if (!to || !body) {
      return NextResponse.json({ error: 'Recipient (to) and body content are required' }, { status: 400 });
    }

    // 1. Get valid Google token
    const token = await getValidGoogleToken(userId);

    // If no token, simulate sending on mock thread
    if (!token) {
      console.log('Sending email via Mock System to:', to);
      return NextResponse.json({ success: true, message: 'Message sent successfully (Mock State)', isMock: true });
    }

    // 2. Build RFC 2822 email payload
    const emailParts = [
      `To: ${to}`,
      `Subject: ${subject || 'Reply from Studio OS'}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body
    ];

    const rawEmail = emailParts.join('\r\n');
    const encodedEmail = Buffer.from(rawEmail)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 3. Send email via Google Gmail API
    const postBody: any = { raw: encodedEmail };
    if (threadId) {
      postBody.threadId = threadId;
    }

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postBody)
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      throw new Error(`Gmail API send returned status ${sendRes.status}: ${errText}`);
    }

    const sendData = await sendRes.json();
    return NextResponse.json({ success: true, messageId: sendData.id, threadId: sendData.threadId, isLive: true });
  } catch (err: any) {
    console.error('Failed to send mail through Gmail API:', err.message);
    return NextResponse.json({ error: err.message || 'Failed to send mail' }, { status: 500 });
  }
}

// ----------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------

function getHeaderValue(msg: any, name: string): string {
  const header = msg.payload?.headers?.find(
    (h: any) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header ? header.value : '';
}

// "Jane Doe <jane@x.com>" → "Jane Doe"; bare addresses pass through.
function parseFromName(from: string): string {
  const name = from.replace(/<[^>]*>/g, '').replace(/["']/g, '').trim();
  return name || from.match(/<([^>]+)>/)?.[1] || from;
}

interface AttachmentMeta {
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

// Walk a message's MIME tree collecting real attachments (parts with a
// filename and a server-side attachment body).
function collectAttachments(msg: any): AttachmentMeta[] {
  const out: AttachmentMeta[] = [];
  const walk = (parts: any[]) => {
    for (const part of parts || []) {
      if (part.filename && part.body?.attachmentId) {
        out.push({
          messageId: msg.id,
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
        });
      }
      if (part.parts) walk(part.parts);
    }
  };
  if (msg.payload?.parts) walk(msg.payload.parts);
  return out;
}

function handleMockActions(action: string, threadId: string | null) {
  if (action === 'list') {
    // Return mock threads
    const summaryList = MOCK_THREADS.map(t => ({
      id: t.id,
      subject: t.subject,
      snippet: t.snippet,
      lastMessageDate: t.lastMessageDate,
      unread: t.unread,
      label: t.label,
      labelColor: t.labelColor
    }));
    return NextResponse.json({ threads: summaryList, isLive: false });
  }

  if (action === 'thread') {
    const thread = MOCK_THREADS.find(t => t.id === threadId);
    if (!thread) {
      return NextResponse.json({ error: 'Mock thread not found' }, { status: 404 });
    }
    // Simulate marking as read
    thread.unread = false;
    return NextResponse.json({
      id: thread.id,
      subject: thread.subject,
      messages: thread.messages,
      isLive: false
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
