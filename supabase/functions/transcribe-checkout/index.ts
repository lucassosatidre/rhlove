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

    // Create a signed URL instead of downloading the file
    const { data: urlData, error: urlErr } = await supabase.storage
      .from("checkout-audios")
      .createSignedUrl(audioPath, 3600); // 1 hour

    if (urlErr || !urlData?.signedUrl) {
      throw new Error("Failed to create signed URL: " + urlErr?.message);
    }

    console.log(`Processing checkout ${checkoutId}, audio URL created`);

    // Use image_url type with the signed URL (Gemini supports media URLs)
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
                  type: "image_url",
                  image_url: {
                    url: urlData.signedUrl,
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

    // Try to mark as error if we have the checkoutId
    try {
      const { checkoutId } = await req.clone().json().catch(() => ({}));
      if (checkoutId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase
          .from("checkouts")
          .update({ transcription_status: "erro" })
          .eq("id", checkoutId);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
