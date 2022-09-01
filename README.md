# 🐘 NextAuth Slonik Adapter

A Slonik adapter for NextAuth. The heavy work for this project was done in this PR: https://github.com/nextauthjs/next-auth/pull/4933

## Install

```bash
npm i nextauth-slonik
# or yarn
yarn add nextauth-slonik
# or pnpm
pnpm install nextauth-slonik
```

## Usage

```ts
import NextAuth from "next-auth";
import SlonikAdapter from "nextauth-slonik/dist/adapter";
import { createPool } from "slonik";

const pool = createPool("postgres://").then((pool) => {
  return pool;
});

export default NextAuth({
  adapter: SlonikAdapter(pool),
  providers: [
    ...
  ],
});

```

## Example Schema

```sql
create table if not exists verification_token (
  identifier text not null,
  expires timestamptz not null,
  token text not null,

  primary key (identifier, token)
);

create table if not exists accounts (
  id serial primary key,
  user_id integer not null,
  "type" varchar(255) not null,
  provider varchar(255) not null,
  provider_account_id varchar(255) not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  id_token text,
  scope text,
  session_state text,
  token_type text
);

create table if not exists sessions (
  id serial primary key,
  user_id integer not null,
  expires timestamptz not null,
  session_token varchar(255) not null
);

create table if not exists users (
  id serial primary key,
  name varchar(255),
  email varchar(255),
  email_verified timestamptz,
  image text
);

```
