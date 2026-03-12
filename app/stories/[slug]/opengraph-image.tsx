import { ImageResponse } from "next/og";
import { supabase } from "../../../lib/supabase";

export const alt = "Daily Good News story preview";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data } = await supabase
    .from("stories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            background: "#0f172a",
            color: "white",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
          }}
        >
          Story not found
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f172a",
          color: "white",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
        }}
      >
        <div
          style={{
            fontSize: 30,
            marginBottom: 20,
            display: "flex",
          }}
        >
          Daily Good News 🌤️
        </div>

        <div
          style={{
            fontSize: 60,
            fontWeight: 700,
            lineHeight: 1.2,
            display: "flex",
          }}
        >
          {data.title}
        </div>
      </div>
    ),
    { ...size }
  );
}