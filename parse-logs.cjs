const fs = require('fs');
const content = fs.readFileSync('supabase-logs-fxkjblrlogjumybceozk.csv.csv', 'utf8');

// Use regex with dotall mode (s flag) to match multi-line quoted strings
// Format: message,type,function_id,id,level,timestamp
const regex = /(".*?"|[^,\n]+),(Boot|Log|Shutdown),([a-f0-9-]+),([a-f0-9-]+),(log|info|error|warning),(\d{16})/gs;

const entries = [];
let match;

while ((match = regex.exec(content)) !== null) {
  const rawMessage = match[1];
  const message = rawMessage.replace(/^"|"$/g, '').replace(/\n/g, ' ').trim();
  const type = match[2];
  const timestamp = parseInt(match[6]);

  const date = new Date(timestamp / 1000);
  entries.push({
    message: message.substring(0, 65),
    type,
    datetime: date.toLocaleString('en-GB', {
      timeZone: 'UTC',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) + ' UTC'
  });
}

console.log('='.repeat(100));
console.log('SUPABASE LOGS - classify-product function');
console.log('='.repeat(100));
console.log('');
console.log('DATETIME (UTC)           | TYPE     | MESSAGE');
console.log('-'.repeat(100));

entries.forEach(e => {
  const typeEmoji = e.type === 'Boot' ? '🟢' : e.type === 'Shutdown' ? '🔴' : '📝';
  console.log(e.datetime.padEnd(25) + '| ' + (typeEmoji + ' ' + e.type).padEnd(13) + '| ' + e.message);
});

console.log('-'.repeat(100));
console.log(`Total entries: ${entries.length}`);

// Also save to a readable CSV file
const csv = ['datetime,type,message'];
entries.forEach(e => {
  csv.push(`"${e.datetime}","${e.type}","${e.message.replace(/"/g, '""')}"`);
});
fs.writeFileSync('supabase-logs-readable.csv', csv.join('\n'));
console.log('\n✅ Saved readable CSV to: supabase-logs-readable.csv');
