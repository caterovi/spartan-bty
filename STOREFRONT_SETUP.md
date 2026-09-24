# Storefront setup

The storefront reads its catalog from the existing `products` table and its
availability from active `finished_product` rows in `inventory_items`. It does
not expose inventory movements, customer data, or staff-only endpoints.

## One-time schema setup

From `backend/`, run these against the intended non-production database first:

```sh
npm run setup:storefront
npm run setup:customer-auth
npm run setup:customer-commerce
```

`setup:storefront` adds nullable `description`, `storefront_category`, and
`image_url` columns to `products`. It does not update existing rows and prints
a count of missing storefront values.

`setup:customer-auth` creates `customer_accounts`, with a unique one-to-one
foreign key to `customers`. It does not seed accounts or add role/department
columns.

`setup:customer-commerce` creates customer carts, adds online-order source,
delivery snapshot, Sales-review, and idempotency fields to `orders`, and creates
the append-only Sales review audit table. Existing orders default to staff
orders and do not enter the online Sales-review queue.

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

## Online ordering and stock policy

Customer order placement always derives the customer from the verified token,
loads prices from `products.default_price`, and checks active finished-product
inventory. The submitted request cannot choose a customer, price, total, role,
or status. An idempotency key prevents a retry from creating the same order
twice. Contact and address values are copied onto the order at placement so a
later profile edit does not change the historical delivery instructions.

Online orders enter the Sales queue as a storefront draft with a separate
`pending` Sales-review state. A Sales specialist can submit it unchanged,
correct only delivery snapshots and quantities with an audit reason, or reject
it with a customer-facing reason. Only the explicit submit action changes the
existing order status to `for_confirmation` for CDM.

This phase intentionally uses a **check-without-reservation** stock policy:

- Cart changes and order placement check current stock but do not deduct or
  reserve it.
- Sales review checks stock again before sending the order to CDM.
- Fulfillment remains the only automatic deduction point. Packing completion
  locks and rechecks inventory, records the movement, and uses
  `inventory_deducted_at` to prevent a second deduction.
- Concurrent accepted orders can therefore exceed stock before packing. The
  customer UI discloses this and Sales/Fulfillment must reject or resolve an
  order that later becomes unavailable.
- Cancellation before packing needs no stock restoration because nothing was
  deducted. A return after packing is not automatically restocked; Supply Chain
  must inspect it and record an appropriate stock-in or adjustment.

This release does not add payments, ratings, reviews, or customer feedback.
