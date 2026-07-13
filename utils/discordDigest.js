// Discord Digest generator
// LSPD / DOJ Case Filing System
// Posts scheduled reports to Discord webhooks

const { getDatabase } = require('./db');

// Using native fetch for Node 18+
async function postToDiscord(webhookUrl, payload) {
  if (!webhookUrl) {
    console.log('Discord webhook URL not configured, skipping digest.');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`Discord API returned ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to post to Discord:', error);
  }
}

async function generateCaseDigest() {
  const db = getDatabase();
  const webhookUrl = process.env.DISCORD_WEBHOOK_CASES;

  if (!webhookUrl) return;

  // Get stats for the last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [newCases, filedCases, needingRevision] = await Promise.all([
    db.collection('filings').countDocuments({ created_at: { $gte: yesterday } }),
    db.collection('filings').countDocuments({ status: 'filed', updated_at: { $gte: yesterday } }),
    db.collection('filings').countDocuments({ status: 'needs_revision' })
  ]);

  const payload = {
    embeds: [{
      title: "📋 LSPD/DA Daily Filing Digest",
      color: 0x0d2c53, // DA Blue
      description: "Here is the summary of filing activity over the last 24 hours.",
      fields: [
        { name: "New Filings Submitted", value: newCases.toString(), inline: true },
        { name: "Filings Approved", value: filedCases.toString(), inline: true },
        { name: "Currently Needing Revision", value: needingRevision.toString(), inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  await postToDiscord(webhookUrl, payload);
  console.log('Filing digest sent to Discord.');
}

async function generateAccountDigest() {
  const db = getDatabase();
  const webhookUrl = process.env.DISCORD_WEBHOOK_ACCOUNTS;

  if (!webhookUrl) return;

  const [pendingLSPD, pendingDA] = await Promise.all([
    db.collection('users').countDocuments({ account_status: 'pending', department: 'LSPD' }),
    db.collection('users').countDocuments({ account_status: 'pending', department: 'DA' })
  ]);

  if (pendingLSPD === 0 && pendingDA === 0) {
    return; // Don't send if there's no pending accounts
  }

  const payload = {
    embeds: [{
      title: "⚠️ Pending Account Approvals",
      color: 0xf59e0b, // Warning Orange
      description: "There are new accounts waiting for administrator approval.",
      fields: [
        { name: "LSPD Pending", value: pendingLSPD.toString(), inline: true },
        { name: "DA Pending", value: pendingDA.toString(), inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  await postToDiscord(webhookUrl, payload);
  console.log('Account digest sent to Discord.');
}

module.exports = {
  generateCaseDigest,
  generateAccountDigest
};
