import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Create signed URL using REST API directly (no heavy SDK)
    const signRes = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/checkout-audios/${audioPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 3600 }),
      }
    );

    if (!signRes.ok) {
      throw new Error("Failed to create signed URL: " + await signRes.text());
    }

    const { signedURL } = await signRes.json();
    const fullAudioUrl = `${supabaseUrl}/storage/v1${signedURL}`;

    console.log(`Processing checkout ${checkoutId}`);

    // Send URL to Lovable AI for transcription
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
                    url: fullAudioUrl,
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

      await updateCheckoutStatus(supabaseUrl, serviceKey, checkoutId, "erro");

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

    // Update checkout with transcription
    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/checkouts?id=eq.${checkoutId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          transcription,
          transcription_status: "concluida",
        }),
      }
    );

    if (!updateRes.ok) {
      console.error("Update error:", await updateRes.text());
    }

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

async function updateCheckoutStatus(
  supabaseUrl: string,
  serviceKey: string,
  checkoutId: string,
  status: string
) {
  await fetch(`${supabaseUrl}/rest/v1/checkouts?id=eq.${checkoutId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ transcription_status: status }),
  });
}
