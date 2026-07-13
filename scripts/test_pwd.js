const bcrypt = require('bcryptjs');
async function test() {
  const isMatch = await bcrypt.compare('12345678', '$2a$12$PV76tbpr1jmtlJ1WIc7jOOjUfbPaijG8v6LkEg994wq1yiKQSf7YS');
  console.log("Is Match:", isMatch);
}
test();
