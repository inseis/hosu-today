import { hashPassword } from '../server/auth';

const pw = process.argv[2];
if (!pw || pw.length < 10) {
  console.error("사용법: npm run admin:hash -- '10자 이상 비밀번호'");
  process.exit(1);
}
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(pw)}`);
