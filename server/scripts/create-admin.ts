import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../src/config/env';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { UserModel } from '../src/models/user.model';

async function main() {
  const args = process.argv.slice(2);
  let email = '';
  let mobile = '';
  let password = '';
  let displayName = 'System Administrator';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      email = args[i + 1].toLowerCase().trim();
      i++;
    } else if (args[i] === '--mobile' && args[i + 1]) {
      mobile = args[i + 1].trim();
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1];
      i++;
    } else if (args[i] === '--name' && args[i + 1]) {
      displayName = args[i + 1].trim();
      i++;
    }
  }

  if (!email && !mobile) {
    console.error('Usage: npx ts-node scripts/create-admin.ts --email <admin_email> --password <secure_password> [--name <name>] [--mobile <10_digit_mobile>]');
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  await connectDatabase();

  const passwordHash = bcrypt.hashSync(password, 10);

  // Check if user already exists
  const existingUser = await UserModel.findOne({
    $or: [
      ...(email ? [{ email }] : []),
      ...(mobile ? [{ mobile }] : []),
    ],
  });

  if (existingUser) {
    existingUser.role = 'admin';
    existingUser.status = 'active';
    existingUser.passwordHash = passwordHash;
    if (displayName) existingUser.displayName = displayName;
    if (email && !existingUser.email) existingUser.email = email;
    if (mobile && !existingUser.mobile) existingUser.mobile = mobile;

    await existingUser.save();
    console.log(`===============================================`);
    console.log(`  SUCCESS: Existing user promoted to Administrator!`);
    console.log(`  ID: ${existingUser._id}`);
    console.log(`  Email: ${existingUser.email || 'N/A'}`);
    console.log(`  Mobile: ${existingUser.mobile || 'N/A'}`);
    console.log(`  Role: ${existingUser.role}`);
    console.log(`===============================================`);
  } else {
    const newUser = await UserModel.create({
      email: email || undefined,
      mobile: mobile || undefined,
      displayName,
      passwordHash,
      role: 'admin',
      status: 'active',
      profileFor: 'myself',
      hasProfile: false,
      consent: {
        agreedAt: new Date(),
        termsVersion: 'v1.0',
        ipAddress: '127.0.0.1',
      },
    });

    console.log(`===============================================`);
    console.log(`  SUCCESS: New Administrator account created!`);
    console.log(`  ID: ${newUser._id}`);
    console.log(`  Email: ${newUser.email || 'N/A'}`);
    console.log(`  Mobile: ${newUser.mobile || 'N/A'}`);
    console.log(`  Role: ${newUser.role}`);
    console.log(`===============================================`);
  }

  await disconnectDatabase();
}

main().catch((err) => {
  console.error('Fatal error in create-admin script:', err.message);
  process.exit(1);
});
