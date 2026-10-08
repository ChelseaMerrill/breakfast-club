"use client";

// Last resort when the root layout itself fails. It replaces the whole document, so it can't
// use globals.css or the app's fonts — styles are inline, in the design's colors.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#FFF4D6",
          color: "#3B2314",
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          padding: 16,
        }}
      >
        <title>Breakfast Club — something went wrong</title>
        <div
          style={{
            maxWidth: 420,
            background: "#FFFDF6",
            border: "3px solid #3B2314",
            borderRadius: 18,
            boxShadow: "4px 4px 0 #3B2314",
            padding: 24,
          }}
        >
          <h1 style={{ marginTop: 0, textTransform: "uppercase" }}>🥞 Something went wrong</h1>
          <p>Breakfast Club couldn&apos;t load. Give it a moment and try again.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              background: "#FFC629",
              border: "3px solid #3B2314",
              borderRadius: 999,
              padding: "10px 24px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#7A5C48" }}>Reference: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
