import { NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runImporter } = require("../../../lib/runImporter");

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const logs: string[] = await runImporter();

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Importer failed",
      },
      { status: 500 }
    );
  }
}