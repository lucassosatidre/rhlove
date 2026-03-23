const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { checkoutId, audioPath } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Download audio directly using the service key
    const dlRes = await fetch(
      `${supabaseUrl}/storage/v1/object/checkout-audios/${audioPath}`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      }
    );

    if (!dlRes.ok) {
      const errBody = await dlRes.text();
      throw new Error("Download failed: " + errBody);
    }

    // Convert to base64
    const arrayBuffer = await dlRes.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Use btoa with binary string
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    console.log(`Audio: ${bytes.length} bytes for checkout ${checkoutId}`);

    // Send to AI for transcription
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
                "Você é um transcritor de áudios em português brasileiro. Transcreva o áudio de forma fiel e completa.",
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

    let transcription = "";
    let newStatus = "erro";

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      transcription = aiData.choices?.[0]?.message?.content || "";
      newStatus = transcription ? "concluida" : "erro";
    } else {
      console.error("AI error:", aiResponse.status, await aiResponse.text());
    }

    // Update checkout
    await fetch(
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
          transcription: transcription || null,
          transcription_status: newStatus,
        }),
      }
    );

    return new Response(
      JSON.stringify({ success: newStatus === "concluida", transcription }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
