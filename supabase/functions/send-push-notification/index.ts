import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  facility_id: string;
  title: string;
  body: string;
  exclude_user_id?: string;
  target_user_id?: string;
  target_access_level?: string | string[];
  target_roles?: string[];
  exclude_roles?: string[];
  data?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: PushPayload = await req.json();
    const {
      facility_id,
      title,
      body,
      exclude_user_id,
      target_user_id,
      target_access_level,
      target_roles,
      exclude_roles,
      data,
    } = payload;

    if (!facility_id) {
      throw new Error("facility_id is required");
    }

    const mode = target_user_id
      ? "targeted"
      : target_access_level
        ? "role"
        : target_roles || exclude_roles
          ? "role-filter"
          : "broadcast";

    console.log(
      `Push [${mode}]: "${title}" to facility ${facility_id}`,
      target_user_id ? `user=${target_user_id}` : "",
      target_access_level ? `access_level=${target_access_level}` : "",
      target_roles ? `target_roles=${target_roles}` : "",
      exclude_roles ? `exclude_roles=${exclude_roles}` : ""
    );

    const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID");
    const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID");
    const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID");
    const APNS_KEY = Deno.env.get("APNS_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID || !APNS_KEY) {
      throw new Error("Missing APNs configuration");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch device tokens based on mode
    let tokens: { token: string; user_id: string }[] | null = null;
    let tokensError: unknown = null;

    if (target_user_id) {
      // Targeted: send to a specific user's devices
      const result = await supabase
        .from("device_tokens")
        .select("token, user_id")
        .eq("user_id", target_user_id);
      tokens = result.data;
      tokensError = result.error;
    } else if (target_access_level) {
      // Role-based: send to all users with matching access_level(s) in the facility
      const accessLevels = Array.isArray(target_access_level)
        ? target_access_level
        : [target_access_level];
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id")
        .eq("facility_id", facility_id)
        .in("access_level", accessLevels)
        .eq("is_active", true);

      if (usersError) {
        throw usersError;
      }

      if (users && users.length > 0) {
        const userIds = users.map((u: { id: string }) => u.id);
        const result = await supabase
          .from("device_tokens")
          .select("token, user_id")
          .in("user_id", userIds);
        tokens = result.data;
        tokensError = result.error;
      } else {
        tokens = [];
      }
    } else if (target_roles || exclude_roles) {
      // Role-filter: target or exclude users by role name (via user_roles table)
      // First get role IDs matching the filter
      let roleIds: string[] = [];

      if (target_roles && target_roles.length > 0) {
        const { data: roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("id")
          .in("name", target_roles);
        if (rolesError) throw rolesError;
        roleIds = (roles ?? []).map((r: { id: string }) => r.id);
      }

      let excludeRoleIds: string[] = [];
      if (exclude_roles && exclude_roles.length > 0) {
        const { data: roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("id")
          .in("name", exclude_roles);
        if (rolesError) throw rolesError;
        excludeRoleIds = (roles ?? []).map((r: { id: string }) => r.id);
      }

      // Query users with role filter
      let userQuery = supabase
        .from("users")
        .select("id")
        .eq("facility_id", facility_id)
        .eq("is_active", true);

      if (roleIds.length > 0) {
        userQuery = userQuery.in("role_id", roleIds);
      }

      const { data: users, error: usersError } = await userQuery;
      if (usersError) throw usersError;

      if (users && users.length > 0) {
        let userIds = users.map((u: { id: string }) => u.id);

        // Exclude users with excluded roles
        if (excludeRoleIds.length > 0 && !roleIds.length) {
          // When only exclude_roles is set, we need to remove users with those roles
          const { data: excludedUsers } = await supabase
            .from("users")
            .select("id")
            .eq("facility_id", facility_id)
            .eq("is_active", true)
            .in("role_id", excludeRoleIds);

          const excludedSet = new Set(
            (excludedUsers ?? []).map((u: { id: string }) => u.id)
          );
          userIds = userIds.filter((id: string) => !excludedSet.has(id));
        }

        // Also exclude the sender
        userIds = userIds.filter(
          (id: string) => id !== (exclude_user_id || "")
        );

        if (userIds.length > 0) {
          const result = await supabase
            .from("device_tokens")
            .select("token, user_id")
            .in("user_id", userIds);
          tokens = result.data;
          tokensError = result.error;
        } else {
          tokens = [];
        }
      } else {
        tokens = [];
      }
    } else {
      // Broadcast: send to all facility users except the sender
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id")
        .eq("facility_id", facility_id)
        .eq("is_active", true);

      if (usersError) {
        throw usersError;
      }

      if (users && users.length > 0) {
        const userIds = users
          .map((u: { id: string }) => u.id)
          .filter((id: string) => id !== (exclude_user_id || ""));
        const result = await supabase
          .from("device_tokens")
          .select("token, user_id")
          .in("user_id", userIds);
        tokens = result.data;
        tokensError = result.error;
      } else {
        tokens = [];
      }
    }

    if (tokensError) {
      console.error("Error fetching tokens:", tokensError);
      throw tokensError;
    }

    console.log("Found", tokens?.length || 0, "device tokens");

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          message: "No device tokens found",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build APNs JWT
    const privateKey = await jose.importPKCS8(APNS_KEY, "ES256");

    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: APNS_KEY_ID })
      .setIssuer(APNS_TEAM_ID)
      .setIssuedAt()
      .sign(privateKey);

    const apnsHost = "api.development.push.apple.com";
    let successCount = 0;
    let failCount = 0;

    for (const tokenRecord of tokens) {
      const deviceToken = tokenRecord.token;

      const apnsPayload: Record<string, unknown> = {
        aps: {
          alert: {
            title: title,
            body: body,
          },
          sound: "default",
          badge: 1,
        },
      };

      // Attach custom data payload for deep linking
      if (data) {
        for (const [key, value] of Object.entries(data)) {
          apnsPayload[key] = value;
        }
      }

      try {
        const response = await fetch(
          `https://${apnsHost}/3/device/${deviceToken}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${jwt}`,
              "apns-topic": APNS_BUNDLE_ID,
              "apns-push-type": "alert",
              "apns-priority": "10",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(apnsPayload),
          }
        );

        if (response.status === 200) {
          console.log("Push sent to", deviceToken.substring(0, 10));
          successCount++;
        } else {
          const errorBody = await response.text();
          console.error("Push failed:", response.status, errorBody);
          failCount++;

          // Clean up invalid tokens
          if (response.status === 410 || response.status === 400) {
            await supabase
              .from("device_tokens")
              .delete()
              .eq("token", deviceToken);
          }
        }
      } catch (pushError) {
        console.error("Push error:", pushError);
        failCount++;
      }
    }

    console.log("Push complete:", successCount, "sent,", failCount, "failed");

    return new Response(
      JSON.stringify({ success: true, sent: successCount, failed: failCount }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
