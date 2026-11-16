import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iPhone home-screen icon, generated at build time. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 25% 15%, #2a3a80 0%, #0a1230 70%)",
        }}
      >
        <svg width="104" height="104" viewBox="0 0 24 24">
          <path
            fill="#b6ff00"
            d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0Z"
          />
        </svg>
      </div>
    ),
    size,
  );
}
