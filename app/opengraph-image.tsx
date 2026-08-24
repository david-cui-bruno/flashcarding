import { ImageResponse } from "next/og";

export const alt = "Dory — Remember what you read";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0e7ec2",
        color: "white",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 1000,
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 62,
              height: 62,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 17,
              background: "white",
              color: "#0e7ec2",
              fontSize: 34,
            }}
          >
            D
          </div>
          Dory
        </div>
        <div style={{ marginTop: 48, fontSize: 78, fontWeight: 700, letterSpacing: -4 }}>
          Remember what you read.
        </div>
        <div style={{ marginTop: 26, fontSize: 30, color: "rgba(255,255,255,0.78)" }}>
          Grounded AI flashcards + modern spaced repetition
        </div>
      </div>
    </div>,
    size,
  );
}
