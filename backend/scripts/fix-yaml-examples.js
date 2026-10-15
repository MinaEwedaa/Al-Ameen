const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, '../openapi/staff-management-api.yaml'),
  path.resolve(__dirname, '../../api/staff-management-api.yaml'),
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Replace integer IDs in YAML with quoted string IDs
  // e.g. room_id: 101 -> room_id: '101'
  content = content.replace(
    /(\b(?:room_id|guest_id|reservation_id|payment_id|shift_id|staff_id|task_id|issue_id):\s+)(\d+)\b/g,
    "$1'$2'"
  );

  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed example IDs in:', file);
}
