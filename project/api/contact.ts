import { contactSettings, createNodeContactHandler } from '../server/contact.ts';

export default createNodeContactHandler(contactSettings(
  process.env,
  process.env.VERCEL_ENV !== 'production' && process.env.CONTACT_EMAIL_TEST_MODE === '1',
));