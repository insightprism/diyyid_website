# DNS Configuration for diyyid.io

## Required DNS Records

Add these records at your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | 68.32.2.33 | 300 |
| A | www | 68.32.2.33 | 300 |

## Explanation

- **A record for @**: Points the root domain (diyyid.io) to your server IP
- **A record for www**: Points www.diyyid.io to your server IP

## Verification

After setting DNS records, verify propagation:

```bash
# Check A record for root domain
dig diyyid.io +short

# Check A record for www
dig www.diyyid.io +short

# Both should return: 68.32.2.33
```

Or use online tools:
- https://dnschecker.org/#A/diyyid.io
- https://www.whatsmydns.net/#A/diyyid.io

## Timeline

- DNS propagation typically takes 5-30 minutes
- Full global propagation can take up to 48 hours
- Most users will see changes within 1 hour

## After DNS is Set Up

1. SSH into your server: `ssh root@68.32.2.33`
2. Run the server setup script to install nginx and get SSL certificate
3. Run deploy.sh from your local machine to upload the app
