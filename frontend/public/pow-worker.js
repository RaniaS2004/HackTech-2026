self.onmessage = async (event) => {
  const { prefix, difficulty } = event.data || {};
  const startedAt = Date.now();
  let nonce = 0;
  const zeros = "0".repeat(difficulty || 4);

  while (true) {
    const encoded = new TextEncoder().encode(`${prefix}${nonce}`);
    const buffer = await crypto.subtle.digest("SHA-256", encoded);
    const hash = Array.from(new Uint8Array(buffer))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");

    if (hash.startsWith(zeros)) {
      self.postMessage({
        nonce,
        hash,
        elapsed_ms: Date.now() - startedAt,
      });
      return;
    }

    nonce += 1;
  }
};

