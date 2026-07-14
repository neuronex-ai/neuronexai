interface StartupFailureProps {
  error: unknown;
}

export function StartupFailure({ error }: StartupFailureProps) {
  const isEnvironmentConfigurationError =
    error instanceof Error && error.message.includes("Missing Supabase public environment variables");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#050505",
        color: "#f5f5f5",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(520px, 100%)",
          padding: "32px",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "24px",
          background: "rgba(255,255,255,0.04)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ fontSize: "13px", letterSpacing: "0.24em", opacity: 0.58 }}>NEURONEX</div>
        <h1 style={{ margin: "18px 0 10px", fontSize: "28px", lineHeight: 1.1 }}>
          Não foi possível iniciar o sistema.
        </h1>
        <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
          {isEnvironmentConfigurationError
            ? "A implantação foi concluída, mas a configuração pública do ambiente ainda não está disponível."
            : "O aplicativo encontrou uma falha durante a inicialização. Tente atualizar a página em alguns instantes."}
        </p>
        <p style={{ margin: "20px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.42)" }}>
          Código de referência: NX-BOOT-001
        </p>
      </section>
    </main>
  );
}
