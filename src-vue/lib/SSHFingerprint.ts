export class SSHFingerprint {
  public static createMD5(pubKeyLine: string): string {
    const blob = this.extractKeyBlob(pubKeyLine);
    return this.toColonHex(this.md5(blob));
  }
  private static extractKeyBlob(pub: string): Uint8Array {
    const parts = pub.trim().split(/\s+/);
    if (parts.length < 2) throw new Error('Invalid OpenSSH public key');
    const b64 = parts[1];
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  private static md5(bytes: Uint8Array): Uint8Array {
    // Minimal MD5 (no deps). For brevity, consider swapping in a tiny MD5 lib if you prefer.
    const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
    const toWords = (b: Uint8Array) => {
      const len = (((b.length + 8) >>> 6) + 1) << 4;
      const w = new Uint32Array(len);
      for (let i = 0; i < b.length; i++) w[i >> 2] |= b[i] << ((i % 4) * 8);
      w[b.length >> 2] |= 0x80 << ((b.length % 4) * 8);
      w[len - 2] = b.length * 8;
      return w;
    };
    let a = 0x67452301,
      b = 0xefcdab89,
      c = 0x98badcfe,
      d = 0x10325476;
    const X = toWords(bytes);
    const S = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
      20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6,
      10, 15, 21,
    ];
    const K = new Uint32Array(64);
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;

    for (let i = 0; i < X.length; i += 16) {
      const A = a,
        B = b,
        C = c,
        D = d;
      for (let j = 0; j < 64; j++) {
        let F: number, g: number;
        if (j < 16) {
          F = (b & c) | (~b & d);
          g = j;
        } else if (j < 32) {
          F = (d & b) | (~d & c);
          g = (5 * j + 1) % 16;
        } else if (j < 48) {
          F = b ^ c ^ d;
          g = (3 * j + 5) % 16;
        } else {
          F = c ^ (b | ~d);
          g = (7 * j) % 16;
        }
        const tmp = d;
        d = c;
        c = b;
        const sum = (a + F + K[j] + X[i + g]) >>> 0;
        b = (b + rotl(sum, S[j])) >>> 0;
        a = tmp;
      }
      a = (a + A) >>> 0;
      b = (b + B) >>> 0;
      c = (c + C) >>> 0;
      d = (d + D) >>> 0;
    }
    const out = new Uint8Array(16),
      W = [a, b, c, d];
    for (let i = 0; i < 4; i++) {
      out[i * 4 + 0] = W[i] & 0xff;
      out[i * 4 + 1] = (W[i] >>> 8) & 0xff;
      out[i * 4 + 2] = (W[i] >>> 16) & 0xff;
      out[i * 4 + 3] = (W[i] >>> 24) & 0xff;
    }
    return out;
  }

  private static toColonHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(':');
  }
}
