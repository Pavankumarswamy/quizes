import { createAPIFileRoute } from "@tanstack/react-start/api";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

/**
 * POST /api/nvidia
 *
 * Server-side proxy for the NVIDIA NIM API.
 * Forwards chat completion requests from the browser to NVIDIA,
 * injecting the secret API key server-side.
 *
 * This avoids CORS issues (NVIDIA blocks direct browser fetches)
 * and keeps the API key out of the client bundle.
 */
export const APIRoute = createAPIFileRoute("/api/nvidia")({
  POST: async ({ request }) => {
    try {
      // Read the API key from server-side env (never sent to browser)
      const apiKey =
        process.env["NVIDIA_API_KEY"] ??
        import.meta.env["NVIDIA_API_KEY"] ??
        "";

      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "NVIDIA_API_KEY not configured on server." }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      // Forward the request body as-is to NVIDIA
      const body = await request.json();

      const nvidiaResponse = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      const responseText = await nvidiaResponse.text();

      return new Response(responseText, {
        status: nvidiaResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Proxy error";
      console.error("[/api/nvidia] proxy error:", message);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
