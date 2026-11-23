import { createMembersHandler } from './handler.ts';

Deno.serve(createMembersHandler({
  url: Deno.env.get('SUPABASE_URL') ?? '',
  publicKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  secretKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  siteUrl: Deno.env.get('AUTH_SITE_URL') ?? '',
  origins: (Deno.env.get('AUTH_ALLOWED_ORIGINS') ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
}));