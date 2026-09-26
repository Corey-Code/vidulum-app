# Data Storage

Vidulum stores non-sensitive configuration and user preferences locally using
`chrome.storage` / browser storage APIs.

## What is stored

- Chain registry metadata
- User preferences (e.g., selected networks)

## What is never stored

- Wallet seeds
- Private keys
- Signing secrets

Any feature that would require storing sensitive key material is out of scope.
