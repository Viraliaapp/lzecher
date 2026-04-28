const { Resend } = require("resend");

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error("RESEND_API_KEY not set");
  process.exit(1);
}

console.log("RESEND_API_KEY present:", apiKey.slice(0, 8) + "...");

const resend = new Resend(apiKey);

async function main() {
  try {
    // List domains first
    console.log("\n--- Checking verified domains ---");
    const { data: domains, error: domErr } = await resend.domains.list();
    if (domErr) {
      console.log("Domain list error:", domErr);
    } else {
      console.log("Domains:", JSON.stringify(domains, null, 2));
    }

    // Send test email
    console.log("\n--- Sending test email ---");
    const { data, error } = await resend.emails.send({
      from: "Lzecher <onboarding@resend.dev>",
      to: "solomon2145tag@gmail.com",
      subject: "Lzecher Test Email",
      html: "<h1>Test</h1><p>If you see this, Resend is working!</p>",
    });

    if (error) {
      console.error("Send error:", JSON.stringify(error));
    } else {
      console.log("Send success! ID:", data?.id);
    }
  } catch (err) {
    console.error("Exception:", err.message);
  }
}

main();
