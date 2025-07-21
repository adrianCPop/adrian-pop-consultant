import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactPayload {
  name: string;
  email: string;
  message: string;
  botField?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_COUNT = 3;
const ipCache = new Map<string, { count: number; timestamp: number }>();

function sanitize(value: string) {
  return value.replace(/[<>]/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let payload: ContactPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { name, email, message, botField = "" } = payload;

  if (!name || !email || !message) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing required fields" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (botField.trim() !== "") {
    return new Response(
      JSON.stringify({ success: false, error: "Spam detected" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!emailRegex.test(email)) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid email" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (message.trim().length < 10) {
    return new Response(
      JSON.stringify({ success: false, error: "Message too short" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "unknown";
  const now = Date.now();
  const entry = ipCache.get(ip);
  if (entry) {
    if (now - entry.timestamp > RATE_LIMIT_WINDOW) {
      ipCache.set(ip, { count: 1, timestamp: now });
    } else {
      if (entry.count >= RATE_LIMIT_COUNT) {
        return new Response(
          JSON.stringify({ success: false, error: "Too many requests" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      ipCache.set(ip, { count: entry.count + 1, timestamp: entry.timestamp });
    }
  } else {
    ipCache.set(ip, { count: 1, timestamp: now });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY not set");
    return new Response(
      JSON.stringify({ success: false, error: "Server misconfiguration" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const sanitizedName = sanitize(name);
  const sanitizedEmail = sanitize(email);
  const sanitizedMessage = sanitize(message);

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Contact Form <no-reply@adrianpop.tech>",
      to: "adrian.c.pop@gmail.com",
      subject: `New message from ${sanitizedName}`,
      html: `<p><strong>Name:</strong> ${sanitizedName}</p><p><strong>Email:</strong> ${sanitizedEmail}</p><p><strong>Message:</strong><br/>${sanitizedMessage}</p>`,
    }),
  });

  if (!emailRes.ok) {
    const text = await emailRes.text();
    console.error("Resend error", text);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ success: true, status: 200 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
