import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/** Mail endpoints use `portal_api_url` in CI (`VITE_EMAIL_API_URL`); falls back to `VITE_API_URL` for local dev. */
const emailApiRoot =
  typeof import.meta.env.VITE_EMAIL_API_URL === 'string' &&
  import.meta.env.VITE_EMAIL_API_URL.trim() !== ''
    ? import.meta.env.VITE_EMAIL_API_URL.trim().replace(/\/+$/, '')
    : import.meta.env.VITE_API_URL;

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: emailApiRoot }),
  endpoints: (build) => ({
    sendEmail: build.mutation({
      query: (body) => ({
        url: '/api/emails/send-email',
        method: 'POST',
        body,
      }),
    }),
    subscribeUser: build.mutation({
      query: (body) => ({
        url: '/api/emails/subscribe-user-request',
        method: 'POST',
        body,
      }),
    }),
  }),
});

// These export hooks are automatically defined by createApi, they
// can be imported in functional components to fetch data, see fetch
// status and get the data from the redux store.
export const { useSendEmailMutation, useSubscribeUserMutation } = api;
