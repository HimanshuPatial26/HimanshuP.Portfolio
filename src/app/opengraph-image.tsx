import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Share preview for links to the site (LinkedIn, WhatsApp, Slack, X).
export const alt = "Himanshu Patial, AI & Growth Product Manager";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// the hero's husk, captured from the live scene on a transparent canvas; read once at module
// scope so the image stays static (generated at build time)
const orbSrc = `data:image/png;base64,${await readFile(join(process.cwd(), "public/posters/husk.png"), "base64")}`;

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          // the site's black with its electric-blue horizon
          background: "linear-gradient(to top, rgba(1,70,249,0.42) 0%, rgba(1,70,249,0.15) 22%, rgba(0,0,0,0) 55%), #000000",
          color: "#f4f4f4",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
        <img src={orbSrc} alt="" width={1120} height={630} style={{ position: "absolute", right: -260, top: -40 }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", width: "100%" }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "#a3a3a3", textTransform: "uppercase" }}>Portfolio</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 112, fontWeight: 400, lineHeight: 0.95, letterSpacing: -2 }}>Himanshu</div>
            <div style={{ fontSize: 112, fontWeight: 400, lineHeight: 0.95, letterSpacing: -2 }}>Patial</div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 38 }}>
              <span style={{ color: "#3a6dff" }}>AI</span>
              <span style={{ margin: "0 12px", color: "#a3a3a3" }}>&amp;</span>
              <span style={{ color: "#c8ccd4" }}>Growth</span>
              <span style={{ marginLeft: 12, color: "#a3a3a3" }}>Product Manager</span>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#a3a3a3" }}>₹4M/month from AI-Convert · +30% agent productivity · Sharjah, UAE</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
