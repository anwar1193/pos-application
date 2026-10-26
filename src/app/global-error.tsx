"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          alignItems: "center",
          background: "#F6F3EC",
          color: "#1D2A24",
          display: "flex",
          fontFamily: "system-ui, sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "420px" }}>
          <h1 style={{ fontSize: "22px", margin: 0 }}>Aplikasi gagal dimuat</h1>
          <p style={{ color: "#5A665F", fontSize: "14px", lineHeight: 1.6 }}>
            Terjadi kesalahan tak terduga. Muat ulang halaman untuk mencoba lagi.
          </p>
          {error.digest ? (
            <p style={{ color: "#8A938D", fontSize: "11px" }}>Kode: {error.digest}</p>
          ) : null}
          <button
            onClick={reset}
            style={{
              background: "#1F4D3A",
              border: 0,
              borderRadius: "8px",
              color: "#fff",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
              marginTop: "16px",
              padding: "10px 18px",
            }}
            type="button"
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
