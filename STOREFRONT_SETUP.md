# Storefront setup

The storefront reads its catalog from the existing `products` table and its
availability from active `finished_product` rows in `inventory_items`. It does
not expose inventory movements, customer data, or staff-only endpoints.

## One-time schema setup

From `backend/`, run these against the intended non-production database first:

```sh
npm run setup:storefront
npm run setup:customer-auth
```

`setup:storefront` adds nullable `description`, `storefront_category`, and
`image_url` columns to `products`. It does not update existing rows and prints
a count of missing storefront values.

`setup:customer-auth` creates `customer_accounts`, with a unique one-to-one
foreign key to `customers`. It does not seed accounts or add role/department
columns.

## Required environment values

Customer tokens use keys separate from staff tokens. Configure both before
enabling customer signup or login:

```text
CUSTOMER_JWT_SECRET=<long-random-secret>
CUSTOMER_JWT_REFRESH_SECRET=<different-long-random-secret>
```

Do not reuse `JWT_SECRET` or `JWT_REFRESH_SECRET`.

## Existing product records

Existing active products already provide the public name, SKU, status, and
`default_price`. Review the price before treating it as a public selling price.
Populate the new fields only with approved product content, for example:

```sql
UPDATE products
SET
  description = ?,
  storefront_category = ?,
  image_url = ?
WHERE id = ?;
```

`image_url` may be an HTTP(S) URL or a path under `/uploads/`. There is no product
image upload/editor workflow in this release, so these values must be managed
through an approved database migration or a future staff product editor.

Availability is reported as:

- `In stock` when active finished-product inventory has a positive total.
- `Out of stock` when matching active inventory rows exist but total quantity
  is zero.
- `Availability unavailable` when there is no matching active inventory row or
  the inventory table has not been set up.

## Existing customer records

Public signup creates a new `customers` row and its linked customer account in
one transaction. It will not automatically claim a customer record with an
existing contact number. Linking a pre-existing customer must wait for a
staff-verified account-linking workflow so that a visitor cannot take over a
record by knowing its contact details.

## Authentication boundary

- Staff continues to sign in through `/api/auth/login` and is issued a token
  with the `staff` audience and account type.
- Customers use `/api/customer-auth/*` and are issued tokens with the
  `customer` audience and account type.
- Staff middleware accepts only the three existing staff roles. Customer
  middleware accepts only customer tokens and derives the customer record from
  the verified token.
- Existing staff sessions must sign in again after rollout because older tokens
  do not carry the new issuer, audience, and account-type claims.

This release does not add cart, checkout, payment, customer order history, or
feedback workflows.
