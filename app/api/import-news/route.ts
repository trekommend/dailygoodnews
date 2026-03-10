import { NextResponse } from "next/server";
import { exec } from "child_process";

export async function GET() {
  return new Promise((resolve) => {
    exec("node scripts/importNews.js", (error, stdout, stderr) => {
      if (error) {
        resolve(
          NextResponse.json({ error: stderr }, { status: 500 })
        );
      } else {
        resolve(
          NextResponse.json({ success: true, output: stdout })
        );
      }
    });
  });
}