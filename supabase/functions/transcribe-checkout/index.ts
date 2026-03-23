import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { checkoutId, audioPath } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Download audio from storage
    const { data: audioData, error: dlErr } = await supabase.storage
      .from("checkout-audios")
      .download(audioPath);

    if (dlErr || !audioData) {
      throw new Error("Failed to download audio: " + dlErr?.message);
    }

    // Convert to base64 in chunks to reduce memory pressure
    const arrayBuffer = await audioData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Manual base64 encoding to avoid importing extra modules
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let base64 = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i];
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      base64 += chars[b0 >> 2];
      base64 += chars[((b0 & 3) << 4) | (b1 >> 4)];
      base64 += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : "=";
      base64 += i + 2 < bytes.length ? chars[b2 & 63] : "=";
    }

    console.log(`Audio size: ${bytes.length} bytes, base64 length: ${base64.length}`);

    // Use gemini-2.5-flash-lite for lower resource usage
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content:
                "Você é um transcritor de áudios em português brasileiro. Transcreva o áudio de forma fiel e completa. Não resuma, não edite. Apenas transcreva o que foi dito, separando em parágrafos quando houver pausas.",
            },
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: {
                    data: base64,
                    format: "webm",
                  },
                },
                {
                  type: "text",
                  text: "Transcreva este áudio completamente em português.",
                },
              ],
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      await supabase
        .from("checkouts")
        .update({ transcription_status: "erro" })
        .eq("id", checkoutId);

      return new Response(
        JSON.stringify({ error: "Transcription failed", details: errText }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiData = await aiResponse.json();
    const transcription = aiData.choices?.[0]?.message?.content || "";

    await supabase
      .from("checkouts")
      .update({
        transcription,
        transcription_status: "concluida",
      })
      .eq("id", checkoutId);

    return new Response(JSON.stringify({ success: true, transcription }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-checkout error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
