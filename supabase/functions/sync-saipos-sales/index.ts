import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SAIPOS_BASE = "https://data.saipos.io/v1/search_sales";
const PAGE_LIMIT = 1000;
const MAX_DAYS_PER_QUERY = 14;

interface SaiposSale {
  id_sale_type: number;
  total_amount: number;
  canceled: string;
  shift_date: string;
  table_order?: { total_service_charge_amount?: number };
}

interface DayTotals {
  faturamento_salao: number;
  pedidos_salao: number;
  faturamento_tele: number;
  pedidos_tele: number;
  faturamento_total: number;
  pedidos_totais: number;
  total_sales: number;
}

function getYesterdayBRT(): string {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  brt.setDate(brt.getDate() - 1);
  return brt.toISOString().slice(0, 10);
}

function splitIntoBlocks(start: string, end: string): Array<{ start: string; end: string }> {
  const blocks: Array<{ start: string; end: string }> = [];
  let current = new Date(start + "T00:00:00Z");
  const endDate = new Date(end + "T00:00:00Z");

  while (current <= endDate) {
    const blockEnd = new Date(current);
    blockEnd.setDate(blockEnd.getDate() + MAX_DAYS_PER_QUERY - 1);
    if (blockEnd > endDate) blockEnd.setTime(endDate.getTime());

    blocks.push({
      start: current.toISOString().slice(0, 10),
      end: blockEnd.toISOString().slice(0, 10),
    });

    current = new Date(blockEnd);
    current.setDate(current.getDate() + 1);
  }
  return blocks;
}

async function fetchSalesPage(
  token: string,
  dateStart: string,
  dateEnd: string,
  offset: number
): Promise<{ sales: SaiposSale[]; debug?: { status: number; body: string; url: string; tokenPrefix: string } }> {
  const params = new URLSearchParams({
    p_date_column_filter: "shift_date",
    p_filter_date_start: `${dateStart}T00:00:00`,
    p_filter_date_end: `${dateEnd}T23:59:59`,
    p_limit: String(PAGE_LIMIT),
    p_offset: String(offset),
  });

  const directUrl = `${SAIPOS_BASE}?${params}`;
  const proxyBase = Deno.env.get("SAIPOS_PROXY_URL");
  const url = proxyBase
    ? `${proxyBase}${encodeURIComponent(directUrl)}`
    : directUrl;

  console.log(`[DEBUG] URL: ${url}`);
  console.log(`[DEBUG] Proxy: ${proxyBase ? 'YES' : 'NO'}`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[DEBUG] Status: ${res.status}, Body: ${body}`);
    const tokenPrefix = token.substring(0, 20);
    return { sales: [], debug: { status: res.status, body, url, tokenPrefix } };
  }

  const data = await res.json();
  return { sales: data };
}

async function fetchAllSales(
  token: string,
  dateStart: string,
  dateEnd: string
): Promise<{ sales: SaiposSale[]; debug?: { status: number; body: string; url: string; tokenPrefix: string } }> {
  const all: SaiposSale[] = [];
  let offset = 0;

  while (true) {
    const result = await fetchSalesPage(token, dateStart, dateEnd, offset);
    if (result.debug) {
      return { sales: all, debug: result.debug };
    }
    all.push(...result.sales);
    if (result.sales.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }

  return { sales: all };
}

function aggregateByDay(sales: SaiposSale[]): Map<string, DayTotals> {
  const map = new Map<string, DayTotals>();

  for (const sale of sales) {
    if (sale.canceled !== "N") continue;

    const day = sale.shift_date?.slice(0, 10);
    if (!day) continue;

    let t = map.get(day);
    if (!t) {
      t = { faturamento_salao: 0, pedidos_salao: 0, faturamento_tele: 0, pedidos_tele: 0, faturamento_total: 0, pedidos_totais: 0, total_sales: 0 };
      map.set(day, t);
    }

    t.total_sales++;
    const baseAmount = Number(sale.total_amount) || 0;
    const serviceCharge = sale.id_sale_type === 3
      ? Number(sale.table_order?.total_service_charge_amount || 0)
      : 0;
    const amount = baseAmount + serviceCharge;

    if (sale.id_sale_type === 3) {
      t.faturamento_salao += amount;
      t.pedidos_salao++;
    } else if ([1, 2, 4].includes(sale.id_sale_type)) {
      t.faturamento_tele += amount;
      t.pedidos_tele++;
    }
  }

  for (const t of map.values()) {
    t.faturamento_total = t.faturamento_salao + t.faturamento_tele;
    t.pedidos_totais = t.pedidos_salao + t.pedidos_tele;
  }

  return map;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "yesterday";

    // Mode: save-token
    if (mode === "save-token") {
      const saiposToken = Deno.env.get("SAIPOS_API_TOKEN");
      if (!saiposToken) throw new Error("SAIPOS_API_TOKEN not configured");
      const { error } = await supabase.from("app_settings").upsert(
        { key: "SAIPOS_API_TOKEN", value: saiposToken },
        { onConflict: "key" }
      );
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, message: "Token saved to app_settings" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const saiposToken = Deno.env.get("SAIPOS_API_TOKEN");
    if (!saiposToken) throw new Error("SAIPOS_API_TOKEN not configured");

    // Mode: sample — fetch raw sales for inspection
    if (mode === "sample") {
      const sampleDate = body.date || getYesterdayBRT();
      const params = new URLSearchParams({
        p_date_column_filter: "shift_date",
        p_filter_date_start: `${sampleDate}T00:00:00`,
        p_filter_date_end: `${sampleDate}T23:59:59`,
        p_limit: "20",
        p_offset: "0",
      });

      const directUrl = `${SAIPOS_BASE}?${params}`;
      const proxyBase = Deno.env.get("SAIPOS_PROXY_URL");
      const url = proxyBase
        ? `${proxyBase}${encodeURIComponent(directUrl)}`
        : directUrl;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${saiposToken}` },
      });

      if (!res.ok) {
        const errBody = await res.text();
        return new Response(
          JSON.stringify({ success: false, status: res.status, body: errBody }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const allSales = await res.json();
      // Filter to type 3 (Salão) only, return first 5 with full JSON
      const type3Sales = allSales.filter((s: any) => s.id_sale_type === 3).slice(0, 5);

      return new Response(
        JSON.stringify({
          success: true,
          mode: "sample",
          date: sampleDate,
          total_fetched: allSales.length,
          type3_count: type3Sales.length,
          type3_samples: type3Sales,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normal sync modes: yesterday / backfill
    let datesToSync: Array<{ start: string; end: string }>;

    if (mode === "backfill") {
      if (!body.start_date || !body.end_date) {
        throw new Error("backfill requires start_date and end_date");
      }
      datesToSync = splitIntoBlocks(body.start_date, body.end_date);
    } else {
      const yesterday = getYesterdayBRT();
      datesToSync = [{ start: yesterday, end: yesterday }];
    }

    const results: Array<{ date: string; total_sales: number; faturamento_total: number; pedidos_totais: number; status: string }> = [];

    for (const block of datesToSync) {
      console.log(`Fetching Saipos: ${block.start} → ${block.end}`);

      const fetchResult = await fetchAllSales(saiposToken, block.start, block.end);

      if (fetchResult.debug) {
        return new Response(
          JSON.stringify({ success: false, mode, error: "Saipos API error", debug: fetchResult.debug }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sales = fetchResult.sales;
      console.log(`Got ${sales.length} raw sales for block ${block.start}→${block.end}`);
      const byDay = aggregateByDay(sales);

      const startD = new Date(block.start + "T00:00:00Z");
      const endD = new Date(block.end + "T00:00:00Z");

      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        const dayStr = d.toISOString().slice(0, 10);
        const t = byDay.get(dayStr) || {
          faturamento_salao: 0, pedidos_salao: 0,
          faturamento_tele: 0, pedidos_tele: 0,
          faturamento_total: 0, pedidos_totais: 0, total_sales: 0,
        };

        const { error: upsertErr } = await supabase
          .from("daily_sales")
          .upsert(
            {
              date: dayStr,
              faturamento_total: t.faturamento_total,
              pedidos_totais: t.pedidos_totais,
              faturamento_salao: t.faturamento_salao,
              pedidos_salao: t.pedidos_salao,
              faturamento_tele: t.faturamento_tele,
              pedidos_tele: t.pedidos_tele,
            },
            { onConflict: "date" }
          );

        const syncStatus = upsertErr ? "error" : "success";

        await supabase.from("saipos_sync_log").insert({
          sync_date: dayStr,
          mode,
          total_sales: t.total_sales,
          faturamento_total: t.faturamento_total,
          pedidos_totais: t.pedidos_totais,
          status: syncStatus,
          error_message: upsertErr?.message || null,
        });

        results.push({
          date: dayStr,
          total_sales: t.total_sales,
          faturamento_total: t.faturamento_total,
          pedidos_totais: t.pedidos_totais,
          status: syncStatus,
        });

        console.log(`${dayStr}: ${t.total_sales} sales, R$${t.faturamento_total.toFixed(2)} — ${syncStatus}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, mode, days_processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sync-saipos-sales error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
