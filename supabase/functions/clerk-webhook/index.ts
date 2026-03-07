import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { Webhook } from "svix";

const webhookSecret = Deno.env.get("CLERK_WEBHOOK_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing required env vars: CLERK_WEBHOOK_SECRET, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY");
    return new Response("Server misconfigured", { status: 500 });
  }

  // Verify Svix signature
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  const body = await req.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Invalid signature", { status: 401 });
  }

  // Service role client bypasses RLS
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { type, data } = event;

  switch (type) {
    case "user.created":
    case "user.updated": {
      const primaryEmail = data.email_addresses?.find(
        (e: EmailAddress) => e.id === data.primary_email_address_id,
      );

      if (!primaryEmail?.email_address) {
        console.error(`No primary email for user ${data.id}, skipping`);
        return new Response("Missing primary email", { status: 400 });
      }

      const { error } = await supabase.from("users").upsert(
        {
          id: data.id,
          email: primaryEmail.email_address,
          first_name: data.first_name,
          last_name: data.last_name,
          avatar_url: data.image_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      if (error) {
        console.error(`Failed to upsert user ${data.id}:`, error);
        return new Response("Database error", { status: 500 });
      }

      console.log(`User ${type === "user.created" ? "created" : "updated"}: ${data.id}`);
      break;
    }

    case "user.deleted": {
      const { error } = await supabase.from("users").delete().eq("id", data.id);

      if (error) {
        console.error(`Failed to delete user ${data.id}:`, error);
        return new Response("Database error", { status: 500 });
      }

      console.log(`User deleted: ${data.id}`);
      break;
    }

    default:
      console.log(`Unhandled event type: ${type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

// -- Types --

interface EmailAddress {
  id: string;
  email_address: string;
}

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    email_addresses?: EmailAddress[];
    primary_email_address_id?: string;
    deleted?: boolean;
  };
}
