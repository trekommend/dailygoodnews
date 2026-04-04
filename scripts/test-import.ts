import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  console.log("cwd:", process.cwd());
  console.log(
    "NEXT_PUBLIC_SUPABASE_URL loaded:",
    !!process.env.NEXT_PUBLIC_SUPABASE_URL
  );

  const { supabase } = await import("../lib/supabase");

  console.log("Supabase client loaded:", !!supabase);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});