import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Phone OTP sign-in via Twilio SMS.
 *
 * Flow:
 *   1. sendPhoneOtp: generates 6-digit code, stores SHA-256(code+phone) in phone_otps, sends via Twilio.
 *   2. verifyPhoneOtp: validates the code, ensures a Supabase user exists for this phone (creating one if needed),
 *      generates a magiclink token_hash, and returns it to the client which calls
 *      `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` to establish a session.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{6,14}$/u, "Phone must be in E.164 format (e.g. +8613800000000)");

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

function syntheticEmail(phone: string): string {
  // Digits-only, so it's a valid local-part.
  const digits = phone.replace(/\D+/gu, "");
  return `phone_${digits}@phone.local`;
}

const SendInput = z.object({ phone: PhoneSchema });
export const sendPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SendInput.parse(data))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    const lovableKey = process.env.LOVABLE_API_KEY;
    const twilioKey = process.env.TWILIO_API_KEY;
    const twilioFrom = process.env.TWILIO_FROM_NUMBER;
    if (!lovableKey || !twilioKey) {
      throw new Error("SMS service is not configured. Please connect Twilio.");
    }
    if (!twilioFrom) {
      throw new Error("Twilio sender number is not configured. Please set TWILIO_FROM_NUMBER.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rate limit: at most 1 send per 30s per phone.
    const sb = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            order: (
              k: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{ data: Array<{ created_at: string }> | null }>;
            };
          };
        };
        insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
    };
    const recent = await sb
      .from("phone_otps")
      .select("created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1);
    const last = recent.data?.[0]?.created_at;
    if (last && Date.now() - new Date(last).getTime() < 30_000) {
      throw new Error("请稍候再试 · Please wait 30 seconds before requesting another code.");
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expires = new Date(Date.now() + 5 * 60_000).toISOString();
    const ins = await sb.from("phone_otps").insert({
      phone,
      code_hash: hashCode(phone, code),
      expires_at: expires,
    });
    if (ins.error) throw new Error(ins.error.message);

    const body = new URLSearchParams({
      To: phone,
      From: twilioFrom,
      Body: `【天机图书馆】验证码 ${code}，5 分钟内有效。Your verification code is ${code}.`,
    });

    const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      // Log only the status; the Twilio error body echoes the phone number,
      // which we deliberately keep out of logs.
      console.error(`Twilio send failed [${res.status}]`);
      throw new Error(`短信发送失败：${res.status}`);
    }
    return { ok: true as const };
  });

const VerifyInput = z.object({
  phone: PhoneSchema,
  code: z.string().regex(/^\d{6}$/u, "验证码为 6 位数字"),
});
export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => VerifyInput.parse(data))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const sb = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            is?: (k: string, v: null) => {
              order: (k: string, o: { ascending: boolean }) => {
                limit: (n: number) => Promise<{
                  data: Array<{ id: string; code_hash: string; expires_at: string; attempts: number }> | null;
                }>;
              };
            };
            maybeSingle?: () => Promise<{ data: { id: string; phone: string | null } | null }>;
            eq?: (k: string, v: string) => Promise<{ data: Array<{ user_id: string }> | null }>;
          };
        };
        update: (v: Record<string, unknown>) => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };

    // Look up newest unused code for this phone.
    const otpRes = await (sb
      .from("phone_otps")
      .select("id, code_hash, expires_at, attempts")
      .eq("phone", phone) as unknown as {
      is: (k: string, v: null) => {
        order: (k: string, o: { ascending: boolean }) => {
          limit: (
            n: number,
          ) => Promise<{
            data: Array<{ id: string; code_hash: string; expires_at: string; attempts: number }> | null;
          }>;
        };
      };
    })
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const otp = otpRes.data?.[0];
    if (!otp) throw new Error("验证码不存在，请先获取。");
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      throw new Error("验证码已过期，请重新获取。");
    }
    if (otp.attempts >= 5) {
      throw new Error("尝试次数过多，请重新获取验证码。");
    }

    const expected = Buffer.from(otp.code_hash, "hex");
    const provided = Buffer.from(hashCode(phone, data.code), "hex");
    const ok = expected.length === provided.length && timingSafeEqual(expected, provided);
    if (!ok) {
      await sb.from("phone_otps").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
      throw new Error("验证码错误。");
    }

    await sb
      .from("phone_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otp.id);

    // Find or create the user by phone.
    const email = syntheticEmail(phone);
    // Try existing profile by phone.
    const existing = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { id: string } | null }> };
        };
      };
    })
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    let userId = existing.data?.id ?? null;
    let userEmail = email;

    if (!userId) {
      // Attempt to create a new user.
      const created = await supabaseAdmin.auth.admin.createUser({
        email,
        phone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { phone, name: `用户${phone.slice(-4)}` },
      });
      if (created.error) {
        // If already exists (email collision), look up via listUsers.
        const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const match = list.data.users.find(
          (u) => u.email === email || u.phone === phone.replace(/^\+/u, ""),
        );
        if (!match) throw new Error(created.error.message);
        userId = match.id;
        userEmail = match.email ?? email;
      } else {
        userId = created.data.user!.id;
        userEmail = created.data.user!.email ?? email;
      }

      // Ensure profile.phone is set (in case profile was created via trigger without phone).
      await (supabaseAdmin as unknown as {
        from: (t: string) => {
          update: (v: Record<string, unknown>) => {
            eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      })
        .from("profiles")
        .update({ phone })
        .eq("id", userId);
    } else {
      // Fetch email for existing user.
      const info = await supabaseAdmin.auth.admin.getUserById(userId);
      userEmail = info.data.user?.email ?? email;
    }

    // Generate a magiclink token_hash for the client to consume.
    const link = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userEmail,
    });
    if (link.error) throw new Error(link.error.message);
    const tokenHash = link.data.properties?.hashed_token;
    if (!tokenHash) throw new Error("Failed to mint sign-in token.");

    return { tokenHash, email: userEmail } as const;
  });
