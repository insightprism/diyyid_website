# Hetzner VPS Server Setup & Maintenance Guide

## Overview

This document describes the production server setup for hosting websites on a Hetzner Cloud VPS.

**Setup Date:** December 3, 2025

---

## Server Information

| Item | Value |
|------|-------|
| **Provider** | [Hetzner Cloud](https://www.hetzner.com/cloud) |
| **Plan** | CCX23 (Dedicated General Purpose) |
| **Specs** | 4 vCPU, 16GB RAM, 160GB NVMe SSD |
| **Location** | Ashburn, VA (USA) |
| **IP Address** | 5.161.70.13 |
| **OS** | Ubuntu 24.04 LTS |
| **Monthly Cost** | ~$29.59/mo |

---

## Access Credentials

### SSH Access (from main development machine)
```bash
ssh root@5.161.70.13
```
Uses SSH key authentication (no password required).

### SSH Access (from any other computer)
```bash
ssh root@5.161.70.13
# Password: HetznerVPS2024!
```

> **IMPORTANT:** Change this password after first login:
> ```bash
> passwd
> ```

---

## Server Architecture

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────┐
│                 Hetzner VPS (5.161.70.13)           │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │           nginx-proxy (ports 80/443)         │   │
│  │         Handles SSL & routing                │   │
│  └─────────────────────────────────────────────┘   │
│                        │                            │
│           ┌────────────┼────────────┐              │
│           ▼            ▼            ▼              │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│    │ diyyid.io│  │ (future) │  │ (future) │       │
│    │ website  │  │  sites   │  │  sites   │       │
│    └──────────┘  └──────────┘  └──────────┘       │
│                                                     │
│  Docker Network: sales_ai_net                      │
└─────────────────────────────────────────────────────┘
```

---

## Installed Software

| Software | Version | Purpose |
|----------|---------|---------|
| Docker | 29.1.2 | Container runtime |
| Docker Compose | 5.0.0 | Container orchestration |
| Node.js | 20.19.6 | JavaScript runtime |
| npm | 10.8.2 | Package manager |
| nginx-proxy | latest | Reverse proxy |
| acme-companion | latest | Auto SSL certificates |
| ufw | - | Firewall |

---

## Directory Structure

```
/opt/docker/
├── reverse-proxy/
│   └── docker-compose.yml      # nginx-proxy + acme-companion
├── diyyid-website/
│   ├── docker-compose.yml      # diyyid.io container config
│   └── nginx.conf              # nginx config for SPA
└── diyyid_website/
    ├── src/                    # Source code (cloned from GitHub)
    ├── dist/                   # Built static files (served by nginx)
    ├── package.json
    └── ...
```

---

## Hosted Websites

### diyyid.io

| Item | Value |
|------|-------|
| **URL** | https://diyyid.io |
| **GitHub Repo** | https://github.com/insightprism/diyyid_website.git |
| **Tech Stack** | React + Vite + TypeScript + Firebase |
| **Container** | diyyid-website |
| **Static Files** | /var/www/diyyid_website/dist |

---

## Firewall Rules (ufw)

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH access |
| 80 | TCP | HTTP (redirects to HTTPS) |
| 443 | TCP | HTTPS |

---

## Update Instructions

### Updating diyyid.io Website

#### Method 1: Quick Update (SSH into server)

```bash
# 1. SSH into the server
ssh root@5.161.70.13

# 2. Navigate to the project directory
cd /var/www/diyyid_website

# 3. Pull latest code from GitHub
git pull origin main

# 4. Install any new dependencies
npm install

# 5. Rebuild the static files
npm run build

# 6. (Optional) Restart the container if needed
docker restart diyyid-website

# 7. Verify the site is working
curl -I https://diyyid.io
```

#### Method 2: Full Redeployment

```bash
# SSH into server
ssh root@5.161.70.13

# Stop and remove the container
cd /opt/docker/diyyid-website
docker compose down

# Remove old code and re-clone
cd /opt/docker
rm -rf diyyid_website
git clone https://github.com/insightprism/diyyid_website.git

# Rebuild
cd diyyid_website
npm install
npm run build

# Start the container
cd /opt/docker/diyyid-website
docker compose up -d
```

---

## Development Workflow

The recommended workflow for making changes:

```
┌─────────────────┐      git push      ┌─────────────┐      git pull      ┌─────────────┐
│ Local Computer  │  ───────────────►  │   GitHub    │  ◄───────────────  │  VPS        │
│  (Development)  │                    │   (Repo)    │                    │ (Production)│
└─────────────────┘                    └─────────────┘                    └─────────────┘
```

1. **Develop locally** on your computer
2. **Test locally** with `npm run dev`
3. **Commit and push** to GitHub
4. **SSH into VPS** and pull + rebuild

---

## Adding a New Website

To add a new website to the server:

### 1. Create the project directory

```bash
ssh root@5.161.70.13
mkdir -p /opt/docker/new-website
cd /opt/docker
git clone https://github.com/your-repo/new-website.git
```

### 2. Build the project (if needed)

```bash
cd /opt/docker/new-website
npm install
npm run build
```

### 3. Create docker-compose.yml

```bash
cat > /opt/docker/new-website-container/docker-compose.yml << 'EOF'
services:
  new-website:
    image: nginx:alpine
    container_name: new-website
    restart: always
    environment:
      - VIRTUAL_HOST=newsite.com,www.newsite.com
      - LETSENCRYPT_HOST=newsite.com,www.newsite.com
      - LETSENCRYPT_EMAIL=your-email@example.com
    volumes:
      - /opt/docker/new-website/dist:/usr/share/nginx/html:ro
    networks:
      - web

networks:
  web:
    external: true
    name: sales_ai_net
EOF
```

### 4. Start the container

```bash
cd /opt/docker/new-website-container
docker compose up -d
```

### 5. Update DNS

Point your domain's A record to `5.161.70.13`

SSL certificate will be automatically generated!

---

## Maintenance Commands

### Check running containers
```bash
docker ps
```

### View container logs
```bash
docker logs diyyid-website
docker logs nginx-proxy
docker logs nginx-proxy-acme
```

### Restart all services
```bash
cd /opt/docker/reverse-proxy && docker compose restart
cd /opt/docker/diyyid-website && docker compose restart
```

### Check disk usage
```bash
df -h
```

### Check memory usage
```bash
free -h
```

### Update system packages
```bash
apt update && apt upgrade -y
```

### Renew SSL certificates (automatic, but manual trigger)
```bash
docker restart nginx-proxy-acme
```

---

## Backup Recommendations

### What to backup:
- `/opt/docker/` - All Docker configurations and website code
- `/etc/docker/certs/` - SSL certificates

### Backup command:
```bash
tar -czvf backup-$(date +%Y%m%d).tar.gz /opt/docker /etc/docker/certs
```

### Hetzner Snapshots:
You can also create server snapshots in the Hetzner Console for full server backups.

---

## Troubleshooting

### Website not loading
```bash
# Check if containers are running
docker ps

# Check nginx-proxy logs
docker logs nginx-proxy

# Check if DNS is pointing to correct IP
dig yourdomain.com
```

### SSL certificate issues
```bash
# Check acme-companion logs
docker logs nginx-proxy-acme

# Force certificate renewal
docker restart nginx-proxy-acme
```

### Cannot SSH into server
- Verify your IP hasn't changed
- Check Hetzner Console for server status
- Use Hetzner Console's web-based console for emergency access

---

## Hetzner Cloud Console

Access your server management at: https://console.hetzner.cloud

From there you can:
- View server status and metrics
- Access web-based console (emergency access)
- Create snapshots/backups
- Upgrade/downgrade server plan
- Manage firewalls
- View bandwidth usage

---

## Cost Summary

| Item | Cost |
|------|------|
| CCX23 VPS | $29.59/mo |
| SSL Certificates | Free (Let's Encrypt) |
| **Total** | **$29.59/mo** |

---

## Support & Resources

- **Hetzner Documentation:** https://docs.hetzner.com/
- **Docker Documentation:** https://docs.docker.com/
- **nginx-proxy:** https://github.com/nginx-proxy/nginx-proxy
- **acme-companion:** https://github.com/nginx-proxy/acme-companion

---

*Last updated: December 3, 2025*
