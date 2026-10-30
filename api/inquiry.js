const ALLOWED = {
  publisher_represented: ["Yes", "No", "Not Sure"],
  open_to_publishing: ["Yes", "No"],
  compositions_12mo: ["0", "1-5", "6-10", "10+"],
};

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const row = (label, value) =>
  `<tr><td style="padding:8px 12px;border:1px solid #eee;font-weight:600;vertical-align:top">${esc(label)}</td><td style="padding:8px 12px;border:1px solid #eee">${esc(value)}</td></tr>`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "Email is not configured" });
  }

  const body = req.body || {};
  if (body._honey) {
    return res.status(200).json({ ok: true });
  }

  const full_name = String(body.full_name || "").trim().slice(0, 200);
  const artist_name = String(body.artist_name || "").trim().slice(0, 200);
  const email = String(body.email || "").trim().slice(0, 320);
  const publisher_represented = body.publisher_represented;
  const open_to_publishing = body.open_to_publishing;
  const compositions_12mo = body.compositions_12mo;

  if (!full_name || !artist_name || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email" });
  }
  if (!ALLOWED.publisher_represented.includes(publisher_represented)) {
    return res.status(400).json({ error: "Invalid answer" });
  }
  if (!ALLOWED.open_to_publishing.includes(open_to_publishing)) {
    return res.status(400).json({ error: "Invalid answer" });
  }
  if (!ALLOWED.compositions_12mo.includes(compositions_12mo)) {
    return res.status(400).json({ error: "Invalid answer" });
  }

  const from = process.env.RESEND_FROM || "WAYU Publishing <hello@wayupublishing.com>";
  const to = process.env.INQUIRY_TO || "hello@wayupublishing.com";

  const html = `
    <p>New inquiry from the WAYU Publishing site.</p>
    <table style="border-collapse:collapse;font-family:Inter,system-ui,sans-serif;font-size:15px">
      ${row("Full name", full_name)}
      ${row("Artist name", artist_name)}
      ${row("Email", email)}
      ${row("Currently represented?", publisher_represented)}
      ${row("Open to new publishing options?", open_to_publishing)}
      ${row("Compositions (past 12 months)", compositions_12mo)}
    </table>
  `;

  try {
    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `WAYU Publishing — inquiry from ${artist_name}`,
        html,
      }),
    });

    if (!send.ok) {
      const detail = await send.text();
      console.error("Resend error:", send.status, detail);
      return res.status(502).json({ error: "Could not send email" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not send email" });
  }
}
