import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUserId } from '@/lib/api-auth';
import { getQuickBooksToken, describeQbFailure, quickbooksQuery } from '@/lib/quickbooks-auth';

// Read-only QuickBooks surface. Returns a billing summary per client so the
// Slate board can show what has been invoiced and what is still outstanding.
// Nothing here writes to QuickBooks — see quickbooks-auth for why that is
// enforced in code rather than by the OAuth scope.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const maxDuration = 30;

interface QbRef { value?: string; name?: string }
interface QbTxn {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number;
  Balance?: number;
  CustomerRef?: QbRef;
  EmailStatus?: string;
  TxnStatus?: string;
}

export interface BillingSummary {
  customerId: string;
  customerName: string;
  invoiced: number;
  outstanding: number;
  overdue: number;
  openCount: number;
  paidCount: number;
  estimateTotal: number;
  estimateCount: number;
  /** The handful of most recent invoices, newest first. */
  recent: {
    id: string;
    docNumber: string;
    date: string;
    dueDate?: string;
    total: number;
    balance: number;
    status: 'paid' | 'open' | 'overdue';
  }[];
}

function escapeForQuery(value: string): string {
  // QuickBooks query strings are single-quoted; the only escape is a doubled
  // quote. Without this a client called "O'Brien Productions" breaks the query.
  return value.replace(/'/g, "''");
}

async function recordStatus(userId: string, ok: boolean, error?: string) {
  try {
    await supabaseAdmin
      .from('quickbooks_tokens')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_ok: ok,
        last_sync_error: ok ? null : (error || 'Lookup failed').slice(0, 500),
      })
      .eq('id', userId);
  } catch { /* status is best-effort */ }
}

export async function POST(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { token, realmId, failure, detail } = await getQuickBooksToken(userId);
  if (!token || !realmId) {
    const message = describeQbFailure(failure || 'not_connected', detail);
    if (failure && failure !== 'not_connected') await recordStatus(userId, false, message);
    return NextResponse.json({ connected: false, message, summaries: {} });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'summary';

    // Every QuickBooks customer, so names can be matched locally rather than
    // issuing one query per client.
    if (action === 'customers') {
      const customers = await quickbooksQuery<{ Id: string; DisplayName: string }>(
        token,
        realmId,
        'SELECT Id, DisplayName FROM Customer WHERE Active = true MAXRESULTS 1000',
      );
      await recordStatus(userId, true);
      return NextResponse.json({
        connected: true,
        customers: customers.map(c => ({ id: c.Id, name: c.DisplayName })),
      });
    }

    // Billing summary keyed by client id, for the clients the caller asks about.
    if (action === 'summary') {
      const clientIds: string[] = Array.isArray(body.clientIds) ? body.clientIds.slice(0, 200) : [];
      if (clientIds.length === 0) {
        return NextResponse.json({ connected: true, summaries: {} });
      }

      const { data: clients } = await supabaseAdmin
        .from('clients')
        .select('id, name, quickbooks_customer_id')
        .in('id', clientIds);

      if (!clients || clients.length === 0) {
        return NextResponse.json({ connected: true, summaries: {} });
      }

      // Pull the customer list once and match on display name for any client
      // that has not been explicitly linked yet.
      const customers = await quickbooksQuery<{ Id: string; DisplayName: string }>(
        token,
        realmId,
        'SELECT Id, DisplayName FROM Customer WHERE Active = true MAXRESULTS 1000',
      );
      const byName = new Map(customers.map(c => [c.DisplayName.trim().toLowerCase(), c]));

      const resolved: { clientId: string; customerId: string; customerName: string }[] = [];
      const newlyLinked: { id: string; quickbooks_customer_id: string }[] = [];

      for (const client of clients) {
        let customerId = client.quickbooks_customer_id as string | null;
        let customerName = '';

        if (customerId) {
          customerName = customers.find(c => c.Id === customerId)?.DisplayName || '';
        } else {
          const match = byName.get((client.name || '').trim().toLowerCase());
          if (match) {
            customerId = match.Id;
            customerName = match.DisplayName;
            // Cache the match so later lookups skip the name comparison and
            // survive a client being renamed on either side.
            newlyLinked.push({ id: client.id, quickbooks_customer_id: match.Id });
          }
        }

        if (customerId) resolved.push({ clientId: client.id, customerId, customerName });
      }

      if (newlyLinked.length > 0) {
        for (const link of newlyLinked) {
          await supabaseAdmin
            .from('clients')
            .update({ quickbooks_customer_id: link.quickbooks_customer_id })
            .eq('id', link.id);
        }
      }

      if (resolved.length === 0) {
        await recordStatus(userId, true);
        return NextResponse.json({ connected: true, summaries: {} });
      }

      // One query for invoices and one for estimates across every matched
      // customer, rather than a round trip per client.
      const idList = Array.from(new Set(resolved.map(r => `'${escapeForQuery(r.customerId)}'`))).join(',');
      const [invoices, estimates] = await Promise.all([
        quickbooksQuery<QbTxn>(
          token,
          realmId,
          `SELECT Id, DocNumber, TxnDate, DueDate, TotalAmt, Balance, CustomerRef FROM Invoice WHERE CustomerRef IN (${idList}) ORDERBY TxnDate DESC MAXRESULTS 500`,
        ),
        quickbooksQuery<QbTxn>(
          token,
          realmId,
          `SELECT Id, DocNumber, TxnDate, TotalAmt, CustomerRef, TxnStatus FROM Estimate WHERE CustomerRef IN (${idList}) ORDERBY TxnDate DESC MAXRESULTS 500`,
        ),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const summaries: Record<string, BillingSummary> = {};

      for (const r of resolved) {
        summaries[r.clientId] = {
          customerId: r.customerId,
          customerName: r.customerName,
          invoiced: 0,
          outstanding: 0,
          overdue: 0,
          openCount: 0,
          paidCount: 0,
          estimateTotal: 0,
          estimateCount: 0,
          recent: [],
        };
      }
      const byCustomer = new Map(resolved.map(r => [r.customerId, r.clientId]));

      for (const inv of invoices) {
        const clientId = byCustomer.get(inv.CustomerRef?.value || '');
        if (!clientId) continue;
        const s = summaries[clientId];
        const total = Number(inv.TotalAmt || 0);
        const balance = Number(inv.Balance || 0);

        s.invoiced += total;
        s.outstanding += balance;

        const isOverdue = balance > 0 && !!inv.DueDate && inv.DueDate < today;
        if (isOverdue) s.overdue += balance;
        if (balance > 0) s.openCount += 1;
        else s.paidCount += 1;

        if (s.recent.length < 5) {
          s.recent.push({
            id: inv.Id || '',
            docNumber: inv.DocNumber || '—',
            date: inv.TxnDate || '',
            dueDate: inv.DueDate,
            total,
            balance,
            status: balance <= 0 ? 'paid' : isOverdue ? 'overdue' : 'open',
          });
        }
      }

      for (const est of estimates) {
        const clientId = byCustomer.get(est.CustomerRef?.value || '');
        if (!clientId) continue;
        // Accepted/closed estimates have become invoices; counting them too
        // would double the pipeline figure.
        if (est.TxnStatus && est.TxnStatus.toLowerCase() === 'closed') continue;
        summaries[clientId].estimateTotal += Number(est.TotalAmt || 0);
        summaries[clientId].estimateCount += 1;
      }

      await recordStatus(userId, true);
      return NextResponse.json({ connected: true, summaries });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('QuickBooks lookup error:', err.message);
    await recordStatus(userId, false, err?.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
