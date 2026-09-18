# Northwind Analytics — request for proposal

## Background

Northwind Analytics sells a retail demand-forecasting product to grocery
chains. Their forecasting engine is a Python monolith on a single EC2 box;
customers pull results out of a nightly CSV drop on SFTP.

## What they want built

A customer-facing web app that replaces the CSV drop:

1. Per-store forecast dashboard, refreshed nightly.
2. CSV and Parquet export, per store or per region.
3. Role-based access — a chain's regional manager sees only their region.
4. An audit log of who exported what (a grocery customer asked for this).

## Constraints given

- Must stay on AWS; their security team has already reviewed the account.
- Customers authenticate with their own Okta tenants (SSO is mandatory).
- Peak load is nightly batch, not interactive — about 40 concurrent users.
- They want a first customer live before the 2027 holiday planning cycle.

## Open

- Whether the forecasting engine itself is in scope or stays as-is.
- Whether Parquet export is v1 or can wait.
