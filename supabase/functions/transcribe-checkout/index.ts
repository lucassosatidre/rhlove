import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

    const arrayBuffer = await audioData.arrayBuffer();
    const base64 = base64Encode(new Uint8Array(arrayBuffer));

    // Send to Lovable AI (Gemini) for transcription
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Você é um transcritor profissional de áudios em português brasileiro. Transcreva o áudio fornecido de forma fiel e completa, preservando todo o conteúdo falado. Não resuma, não edite, não adicione comentários. Apenas transcreva o que foi dito, separando em parágrafos naturais quando houver pausas. Preserve nomes próprios, gírias e expressões regionais.",
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
