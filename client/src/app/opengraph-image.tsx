import { ImageResponse } from "next/og";

export const alt = "Banger or Bot — the AI music showdown";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background:
          "radial-gradient(circle at 18% 20%, #2b3815 0%, #090a0d 45%), #090a0d",
        color: "#f7f7ef",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        height: "100%",
        justifyContent: "center",
        letterSpacing: "-0.04em",
        padding: "72px",
        textAlign: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          color: "#d6ff55",
          display: "flex",
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: "0.18em",
          marginBottom: 24,
        }}
      >
        AI MUSIC SHOWDOWN
      </div>
      <div style={{ display: "flex", fontSize: 104, fontWeight: 900 }}>
        Banger or Bot?
      </div>
      <div
        style={{
          color: "#c7c9c1",
          display: "flex",
          fontSize: 44,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          marginTop: 22,
        }}
      >
        Can you hear the difference?
      </div>
    </div>,
    size,
  );
}
