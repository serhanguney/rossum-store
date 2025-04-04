import { createElisClient } from '@rossum/api-client';

const token = process.env.ROSSUM_AUTHORIZATION_TOKEN ?? '';
const baseUrl = process.env.BASE_URL ?? '';

export const api = createElisClient({ baseUrl, getAuthToken: () => token });
