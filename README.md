# webhook-spark ⚡

**Send minimalist homelab alerts with ASCII sparklines to Discord/Slack**

## ✨ Features

- 📊 **Beautiful ASCII sparklines** – Turn boring number arrays into visual trends
- 🔌 **Webhook support** – Discord and Slack out of the box
- 🚀 **Zero dependencies** – Uses only Node.js/Bun built-ins
- 📦 **Tiny footprint** – Less than 10KB minified
- 🛡️ **TypeScript first** – Full type safety and autocomplete
- 🎨 **Customizable** – Multiple character sets and styling options

## 📦 Installation

```bash
# Using Bun (recommended)
bun add webhook-spark

# Using npm
npm install webhook-spark

# Using yarn
yarn add webhook-spark
```

## 🚀 Quick Start

```typescript
// REMOVED external import: import { generateSparkline, sendWebhook } from 'webhook-spark';

// Create a sparkline from your metrics
const cpuUsage = [10, 25, 60, 85, 90, 45, 30];
const sparkline = generateSparkline(cpuUsage);

// Send to Discord
await sendWebhook({
  url: 'https://discord.com/api/webhooks/your-webhook-id',
  provider: 'discord',
  content: `CPU usage: ${sparkline}`,
  username: 'Server Monitor'
});

console.log(`📈 Sparkline sent: ${sparkline}`);
// Output: 📈 Sparkline sent: ▁▂▅▇██▃▂
```

## 📖 API Reference

### Sparkline Generation

```typescript
// REMOVED external import: import { generateSparkline, generateSparklineWithOutliers } from 'webhook-spark';

// Basic sparkline
const sparkline = generateSparkline([1, 2, 3, 4, 5]);
// Returns: ▁▂▃▄▅

// With custom options
const custom = generateSparkline([10, 50, 90], {
  characterSet: '·∙●○◉◎',
  minValue: 0,
  maxValue: 100
});

// Handle outliers
const withOutliers = generateSparklineWithOutliers(
  [1, 1000, 2, 3, 4],
  { threshold: 2 } // Values > 2 standard deviations marked
);
```

### Webhook Delivery

```typescript
// REMOVED external import: import { sendWebhook } from 'webhook-spark';

// Discord example
await sendWebhook({
  url: 'DISCORD_WEBHOOK_URL',
  provider: 'discord',
  content: 'Server alert!',
  embeds: [{
    title: 'CPU Usage',
    description: generateSparkline([10, 25, 60, 85]),
    color: 0xff0000,
    timestamp: new Date().toISOString()
  }]
});

// Slack example
await sendWebhook({
  url: 'SLACK_WEBHOOK_URL',
  provider: 'slack',
  content: 'Daily metrics',
  blocks: [{
    type: 'section',
    text: { type: 'mrkdwn', text: `*Memory usage:* ${generateSparkline([30, 45, 60])}` }
  }]
});
```

### Type Utilities

```typescript
// REMOVED external import: import { isNumericArray, isWebhookConfig } from 'webhook-spark';

// Type guards for validation
if (isNumericArray(data)) {
  // data is now typed as readonly number[]
  const sparkline = generateSparkline(data);
}

const config = { url: '...', provider: 'discord' };
if (isWebhookConfig(config)) {
  // config is valid WebhookConfig
  await sendWebhook(config);
}
```

## 🧪 Examples

### Homelab CPU Monitor

```typescript
// REMOVED external import: import { generateSparkline, sendWebhook } from 'webhook-spark';
import os from 'os';

// Simulate collecting CPU metrics
const cpuMetrics = [45, 60, 75, 85, 90, 80, 65];
const sparkline = generateSparkline(cpuMetrics);

// Send alert if high usage
if (cpuMetrics[cpuMetrics.length - 1] > 80) {
  await sendWebhook({
    url: process.env.DISCORD_WEBHOOK!,
    provider: 'discord',
    content: `🚨 High CPU usage detected!`,
    embeds: [{
      title: 'CPU Trend',
      description: `\`${sparkline}\``,
      fields: [
        { name: 'Current', value: `${cpuMetrics[cpuMetrics.length - 1]}%`, inline: true },
        { name: 'Peak', value: `${Math.max(...cpuMetrics)}%`, inline: true }
      ],
      color: 0xff5500
    }]
  });
}
```

### Daily Health Report

```typescript
// REMOVED external import: import { generateSparkline, generateASCIIArt } from 'webhook-spark';

// Create a dashboard-like report
const report = `
📊 **Daily System Report**
━━━━━━━━━━━━━━━━━━━━
CPU:    ${generateSparkline([10, 25, 40, 60, 45, 30])}
Memory: ${generateSparkline([50, 55, 60, 65, 70, 68])}
Disk:   ${generateSparkline([85, 86, 87, 88, 89, 90])}

${generateASCIIArt('HEALTHY', { font: 'block' })}
`;

await sendWebhook({
  url: process.env.SLACK_WEBHOOK!,
  provider: 'slack',
  content: report
});
```

## 🔧 Configuration

```json
{
  "defaultWebhook": "https://discord.com/api/webhooks/your-id",
  "defaultProvider": "discord",
  "dataDir": "~/.webhook-spark/data",
  "maxEntries": 1000
}
```

## 🤝 Contributing

Found a bug? Have an idea for a new feature? Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b cool-new-feature`)
3. Commit your changes (`git commit -am 'Add cool feature'`)
4. Push to the branch (`git push origin cool-new-feature`)
5. Open a Pull Request

## 📄 License

MIT © AdametherzLab

---

Made with ⚡ by homelab enthusiasts for homelab enthusiasts. Keep your servers happy and your alerts beautiful!