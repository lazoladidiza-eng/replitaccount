// Email digest sender. Stubbed until nodemailer (or chosen provider) is added.

export interface DigestEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendDigest(_email: DigestEmail): Promise<void> {
  throw new Error("sendDigest not implemented yet");
}
